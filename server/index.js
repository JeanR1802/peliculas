// Importamos las librerías necesarias
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// --- INICIALIZACIÓN DE FIREBASE ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://peliculas-153f1-default-rtdb.firebaseio.com"
});

const db = admin.database();
const roomsRef = db.ref('rooms');
// --- FIN DE INICIALIZACIÓN DE FIREBASE ---

// Creamos el servidor
const app = express();
const server = http.createServer(app);

// **NUEVO**: Contraseña secreta para acciones de administrador
const ADMIN_SECRET = 'supersecreto123'; // ¡Cambia esto por una contraseña más segura!

// Configuramos socket.io con CORS
const io = new Server(server, {
  cors: {
    origin: "*", // En producción, cambiar "*" por tu dominio
    methods: ["GET", "POST"]
  }
});

// Salas predefinidas por defecto (para la primera vez que se usa la DB)
const DEFAULT_ROOMS = {
  'sala-1': { 
    name: 'Sala 1', 
    movie: 'Manos de Tijera',
    videoUrl: 'https://pub-cd2cf2772f534ea0b1f45983378f56d8.r2.dev/manosdetijera.mp4' 
  },
  'sala-2': { name: 'Sala 2', movie: '', videoUrl: '' },
  'sala-3': { name: 'Sala 3', movie: '', videoUrl: '' },
  'sala-4': { name: 'Sala 4', movie: '', videoUrl: '' },
  'sala-5': { name: 'Sala 5', movie: '', videoUrl: '' },
  'sala-6': { name: 'Sala 6', movie: '', videoUrl: '' },
};

// Almacena el estado actual del video por sala (persistente mientras el servidor viva)
const roomStates = {}; 
// Almacena los usuarios conectados por sala
const roomUsers = {};
// Guardar quién pausó la sala
const lastPausedBy = {};

const ROOM_STATES_FILE = path.join(__dirname, 'roomStates.json');

// Cargar estado persistente de las salas al iniciar
function loadRoomStates() {
  if (fs.existsSync(ROOM_STATES_FILE)) {
    try {
      const data = fs.readFileSync(ROOM_STATES_FILE, 'utf8');
      const parsed = JSON.parse(data);
      Object.assign(roomStates, parsed);
      console.log('Estado de salas restaurado desde roomStates.json');
    } catch (e) {
      console.error('Error al leer roomStates.json:', e);
    }
  }
}

// Guardar estado persistente de las salas
function saveRoomStates() {
  try {
    fs.writeFileSync(ROOM_STATES_FILE, JSON.stringify(roomStates, null, 2), 'utf8');
  } catch (e) {
    console.error('Error al guardar roomStates.json:', e);
  }
}

// --- NUEVAS FUNCIONES DE FIREBASE ---
async function loadRooms() {
  try {
    const snapshot = await roomsRef.once('value');
    if (snapshot.exists()) {
      console.log('Salas restauradas desde Firebase.');
      return snapshot.val();
    } else {
      console.log('No hay salas en Firebase. Inicializando con valores por defecto.');
      await roomsRef.set(DEFAULT_ROOMS);
      return DEFAULT_ROOMS;
    }
  } catch (e) {
    console.error('Error al cargar salas desde Firebase, usando valores por defecto:', e);
    return { ...DEFAULT_ROOMS };
  }
}

async function saveRooms() {
  try {
    await roomsRef.set(PREDEFINED_ROOMS);
  } catch (e) {
    console.error('Error al guardar salas en Firebase:', e);
  }
}
// --- FIN DE NUEVAS FUNCIONES ---

// Variable para almacenar las salas cargadas
let PREDEFINED_ROOMS;

const PORT = process.env.PORT || 3001;

// --- Auto-ping para evitar que el server se duerma ---
let autoPingInterval = null;
function startAutoPing() {
  if (!autoPingInterval) {
    autoPingInterval = setInterval(() => {
      const totalUsers = Object.values(roomUsers).reduce((acc, arr) => acc + arr.length, 0);
      if (totalUsers > 0) {
        http.get('http://localhost:' + PORT + '/ping', () => {});
      }
    }, 5 * 60 * 1000); // cada 5 minutos
    console.log('Auto-ping activado');
  }
}
function stopAutoPing() {
  if (autoPingInterval) {
    clearInterval(autoPingInterval);
    autoPingInterval = null;
    console.log('Auto-ping detenido');
  }
}

// Endpoint para auto-ping
app.get('/ping', (req, res) => res.send('pong'));


// --- FUNCIÓN PRINCIPAL DE ARRANQUE ---
async function startServer() {
  
  PREDEFINED_ROOMS = await loadRooms();
  loadRoomStates();

  io.on('connection', (socket) => {
    console.log(`Usuario Conectado: ${socket.id}`);
    
    socket.emit('initial-lobby-data', PREDEFINED_ROOMS);

    socket.on('join-room', ({ roomId, username }) => {
      if (!PREDEFINED_ROOMS[roomId]) {
        console.log(`Intento de unirse a sala inexistente: ${roomId}`);
        return; 
      }
      
      socket.join(roomId);
      console.log(`Usuario ${username} (${socket.id}) se unió a la sala: ${roomId}`);

      if (!roomUsers[roomId]) {
        roomUsers[roomId] = [];
      }
      roomUsers[roomId].push({ id: socket.id, name: username });

      io.in(roomId).emit('user-joined', { id: socket.id, name: username, users: roomUsers[roomId] });

      if (!roomStates[roomId]) {
        console.log(`Inicializando estado para la sala ${roomId}`);
        roomStates[roomId] = {
          videoUrl: PREDEFINED_ROOMS[roomId].videoUrl,
          currentTime: 0,
          isPlaying: false
        };
      }
      
      socket.emit('receive-video-state', roomStates[roomId]);

      io.in(roomId).emit('chat-message', {
        username: 'Sistema',
        message: `${username} se ha unido a la sala.`,
        timestamp: Date.now(),
        isSystem: true
      });

      startAutoPing();
    });

    socket.on('send-play', ({ roomId, currentTime }) => {
      if (roomStates[roomId]) {
        roomStates[roomId].isPlaying = true;
        roomStates[roomId].currentTime = currentTime;
        saveRoomStates();
      }
      socket.to(roomId).emit('receive-play', currentTime);
    });

    socket.on('send-pause', ({ roomId, currentTime }) => {
      if (roomStates[roomId]) {
        roomStates[roomId].isPlaying = false;
        roomStates[roomId].currentTime = currentTime;
        saveRoomStates();
        const user = (roomUsers[roomId] || []).find(u => u.id === socket.id);
        lastPausedBy[roomId] = user ? user.name : 'Desconocido';
        io.in(roomId).emit('chat-message', {
          username: 'Sistema',
          message: `Pausado por ${user ? user.name : 'Desconocido'}`,
          timestamp: Date.now(),
          isSystem: true
        });
      }
      socket.to(roomId).emit('receive-pause', currentTime);
    });

    socket.on('send-seek', ({ roomId, time }) => {
      if (roomStates[roomId]) {
        roomStates[roomId].currentTime = time;
        saveRoomStates();
      }
      socket.to(roomId).emit('receive-seek', time);
    });

    socket.on('admin-update-room', async ({ roomId, newName, newMovie, newUrl, adminPassword }) => {
      if (adminPassword !== ADMIN_SECRET) {
        console.log(`Intento fallido de admin para actualizar la sala ${roomId}`);
        socket.emit('admin-error', 'Contraseña de administrador incorrecta.');
        return;
      }

      if (!PREDEFINED_ROOMS[roomId]) {
        socket.emit('admin-error', 'La sala que intentas actualizar no existe.');
        return;
      }

      console.log(`Admin actualizando la sala ${roomId}`);
      const room = PREDEFINED_ROOMS[roomId];
      const roomState = roomStates[roomId];
      
      // El nombre de la sala ya no se puede editar.
      // if (typeof newName === 'string') room.name = newName;
      if (typeof newMovie === 'string') room.movie = newMovie;
      if (typeof newUrl === 'string') room.videoUrl = newUrl;
      
      if (roomState && newUrl && roomState.videoUrl !== newUrl) {
        roomState.videoUrl = newUrl;
        roomState.currentTime = 0;
        roomState.isPlaying = false;
        saveRoomStates();
        io.in(roomId).emit('receive-video-change', newUrl);
        io.in(roomId).emit('chat-message', {
          username: 'Sistema',
          message: `Un administrador ha cambiado la película de la sala.`,
          timestamp: Date.now(),
          isSystem: true
        });
      }
      
      await saveRooms();
      
      io.emit('update-lobby-data', PREDEFINED_ROOMS);
      console.log(`Datos del lobby actualizados y enviados a todos los clientes.`);
    });

    socket.on('admin-request-room-status', (adminPassword) => {
      if (adminPassword !== ADMIN_SECRET) {
        socket.emit('admin-room-status', { error: 'Contraseña de administrador incorrecta.' });
        return;
      }
      const status = {};
      for (const roomId in PREDEFINED_ROOMS) {
        status[roomId] = {
          name: PREDEFINED_ROOMS[roomId].name,
          movie: PREDEFINED_ROOMS[roomId].movie,
          videoUrl: PREDEFINED_ROOMS[roomId].videoUrl,
          users: roomUsers[roomId] || [],
          videoState: roomStates[roomId] || { currentTime: 0, isPlaying: false, videoUrl: PREDEFINED_ROOMS[roomId].videoUrl },
          lastPausedBy: lastPausedBy[roomId] || null
        };
      }
      socket.emit('admin-room-status', status);
    });

    socket.on('send-chat-message', ({ roomId, username, message }) => {
      const chatMessage = { username, message, timestamp: Date.now() };
      io.in(roomId).emit('chat-message', chatMessage);
    });
    
    socket.on('ping', () => { /* Mantiene el servidor despierto */ });

    socket.on('disconnect', () => {
      console.log(`Usuario Desconectado: ${socket.id}`);
      for (const roomId in roomUsers) {
        const userIndex = roomUsers[roomId].findIndex(user => user.id === socket.id);
        if (userIndex !== -1) {
          const [disconnectedUser] = roomUsers[roomId].splice(userIndex, 1);
          io.in(roomId).emit('user-left', { id: disconnectedUser.id, name: disconnectedUser.name, users: roomUsers[roomId] });
          io.in(roomId).emit('chat-message', {
            username: 'Sistema',
            message: `${disconnectedUser.name} ha abandonado la sala.`,
            timestamp: Date.now(),
            isSystem: true
          });
          
          if (roomUsers[roomId].length === 0) {
            console.log(`Sala ${roomId} vacía. Pausando video y limpiando lista de usuarios.`);
            if(roomStates[roomId]) {
              roomStates[roomId].isPlaying = false;
              saveRoomStates();
              lastPausedBy[roomId] = 'Backend (sala vacía)';
              io.in(roomId).emit('chat-message', {
                username: 'Sistema',
                message: 'Pausado por el sistema (sala vacía)',
                timestamp: Date.now(),
                isSystem: true
              });
            }
            delete roomUsers[roomId];
          }
          
          const totalUsers = Object.values(roomUsers).reduce((acc, arr) => acc + arr.length, 0);
          if (totalUsers === 0) {
            stopAutoPing();
          }
          break;
        }
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`Servidor de Cine Virtual escuchando en el puerto ${PORT}`);
  });
}

startServer();