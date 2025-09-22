// Importamos las librerías necesarias
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

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

const ROOMS_FILE = path.join(__dirname, 'rooms.json');

// Salas predefinidas por defecto
const DEFAULT_ROOMS = {
  'sala-1': { 
    name: 'Sala 1', 
    movie: 'Manos de Tijera',
    videoUrl: 'https://pub-cd2cf2772f534ea0b1f45983378f56d8.r2.dev/manosdetijera.mp4' 
  },
  'sala-2': { 
    name: 'Sala 2', 
    movie: 'Big Buck Bunny',
    videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' 
  },
  'sala-3': { name: 'Sala 3', movie: '(Próximamente)', videoUrl: '' },
  'sala-4': { name: 'Sala 4', movie: '(Próximamente)', videoUrl: '' },
  'sala-5': { name: 'Sala 5', movie: '(Próximamente)', videoUrl: '' },
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

// Cargar salas desde archivo o usar las predefinidas
function loadRooms() {
  if (fs.existsSync(ROOMS_FILE)) {
    try {
      const data = fs.readFileSync(ROOMS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error al leer rooms.json:', e);
      return { ...DEFAULT_ROOMS };
    }
  } else {
    return { ...DEFAULT_ROOMS };
  }
}

// Guardar salas en archivo
function saveRooms() {
  try {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(PREDEFINED_ROOMS, null, 2), 'utf8');
  } catch (e) {
    console.error('Error al guardar rooms.json:', e);
  }
}

// Usar las salas cargadas
let PREDEFINED_ROOMS = loadRooms();

// Llamar al cargar el servidor
loadRoomStates();

// --- Auto-ping para evitar que el server se duerma ---
let autoPingInterval = null;
function startAutoPing() {
  if (!autoPingInterval) {
    autoPingInterval = setInterval(() => {
      // Solo hacer ping si hay usuarios conectados
      const totalUsers = Object.values(roomUsers).reduce((acc, arr) => acc + arr.length, 0);
      if (totalUsers > 0) {
        // Hacer un request HTTP a sí mismo
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

// Escuchamos cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log(`Usuario Conectado: ${socket.id}`);
  
  // **NUEVO**: Al conectarse un usuario, le enviamos la lista de salas actualizada.
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

    // Iniciar auto-ping si hay usuarios
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
      // Guardar quién pausó
      const user = (roomUsers[roomId] || []).find(u => u.id === socket.id);
      lastPausedBy[roomId] = user ? user.name : 'Desconocido';
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

  // **NUEVO**: Evento para que un admin actualice una sala
  socket.on('admin-update-room', ({ roomId, newName, newMovie, newUrl, adminPassword }) => {
    // 1. Verificar contraseña
    if (adminPassword !== ADMIN_SECRET) {
      console.log(`Intento fallido de admin para actualizar la sala ${roomId}`);
      socket.emit('admin-error', 'Contraseña de administrador incorrecta.');
      return;
    }

    // 2. Validar que la sala exista
    if (!PREDEFINED_ROOMS[roomId]) {
      socket.emit('admin-error', 'La sala que intentas actualizar no existe.');
      return;
    }

    console.log(`Admin actualizando la sala ${roomId}`);
    const room = PREDEFINED_ROOMS[roomId];
    const roomState = roomStates[roomId];
    
    // 3. Actualizar datos en memoria
    if (newName) room.name = newName;
    if (newMovie) room.movie = newMovie;
    if (newUrl && room.videoUrl !== newUrl) {
      room.videoUrl = newUrl;
      if (roomState) {
        roomState.videoUrl = newUrl;
        roomState.currentTime = 0;
        roomState.isPlaying = false;
        saveRoomStates();
        // Notificar a los que están DENTRO de la sala sobre el cambio de video
        io.in(roomId).emit('receive-video-change', newUrl);
        io.in(roomId).emit('chat-message', {
          username: 'Sistema',
          message: `Un administrador ha cambiado la película de la sala.`,
          timestamp: Date.now(),
          isSystem: true
        });
      }
    }
    saveRooms(); // Guardar cambios en archivo

    // 4. Notificar a TODOS los clientes conectados (incluso los del lobby) sobre los cambios
    io.emit('update-lobby-data', PREDEFINED_ROOMS);
    console.log(`Datos del lobby actualizados y enviados a todos los clientes.`);
  });

  // Evento para que el admin solicite el estado de todas las salas
  socket.on('admin-request-room-status', (adminPassword) => {
    if (adminPassword !== ADMIN_SECRET) {
      socket.emit('admin-room-status', { error: 'Contraseña de administrador incorrecta.' });
      return;
    }
    // Construir el estado de todas las salas
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
          }
          delete roomUsers[roomId];
        }
        // Si ya no hay usuarios en ninguna sala, detener auto-ping
        const totalUsers = Object.values(roomUsers).reduce((acc, arr) => acc + arr.length, 0);
        if (totalUsers === 0) {
          stopAutoPing();
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor de Cine Virtual escuchando en el puerto ${PORT}`);
});

