// Importamos las librerías necesarias
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const admin = require('firebase-admin');

// --- INICIALIZACIÓN DE FIREBASE ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://peliculas-153f1-default-rtdb.firebaseio.com"
});

const db = admin.database();
const roomsRef = db.ref('rooms');
const roomStatesRef = db.ref('roomStates');
// --- FIN DE INICIALIZACIÓN DE FIREBASE ---

const app = express();
const server = http.createServer(app);

const ADMIN_SECRET = process.env.ADMIN_SECRET;

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- ESTRUCTURAS DE DATOS EN MEMORIA ---
const roomUsers = {}; // Almacena usuarios por sala: { roomId: [{ id, name }, ...] }
const lastPausedBy = {}; // Almacena quién pausó la sala
let jeanSockets = []; // Almacena los sockets del usuario "Jean"

// --- Variables de estado globales ---
let PREDEFINED_ROOMS;
let roomStates;

// --- FUNCIONES DE FIREBASE (SIN CAMBIOS) ---
async function loadRoomStates() {
  try {
    const snapshot = await roomStatesRef.once('value');
    if (snapshot.exists()) {
      roomStates = snapshot.val();
      console.log('Estados de reproducción restaurados desde Firebase.');
    } else {
      roomStates = {};
      console.log('No hay estados de reproducción en Firebase. Inicializando objeto vacío.');
    }
  } catch (e) {
    console.error('Error al cargar estados de reproducción desde Firebase:', e);
    roomStates = {};
  }
}

async function saveRoomStates() {
  try {
    await roomStatesRef.set(roomStates);
  } catch (e) {
    console.error('Error al guardar estados de reproducción en Firebase:', e);
  }
}

async function loadRooms() {
  try {
    const snapshot = await roomsRef.once('value');
    if (snapshot.exists()) {
      console.log('Salas restauradas desde Firebase.');
      return snapshot.val();
    } else {
      console.log('No hay salas en Firebase. Inicializando con valores por defecto.');
      const DEFAULT_ROOMS = {
        'sala-1': { name: 'Sala 1', movie: 'Manos de Tijera', videoUrl: 'https://pub-cd2cf2772f534ea0b1f45983378f56d8.r2.dev/manosdetijera.mp4' },
        'sala-2': { name: 'Sala 2', movie: '', videoUrl: '' },
        'sala-3': { name: 'Sala 3', movie: '', videoUrl: '' },
        'sala-4': { name: 'Sala 4', movie: '', videoUrl: '' },
        'sala-5': { name: 'Sala 5', movie: '', videoUrl: '' },
        'sala-6': { name: 'Sala 6', movie: '', videoUrl: '' },
      };
      await roomsRef.set(DEFAULT_ROOMS);
      return DEFAULT_ROOMS;
    }
  } catch (e) {
    console.error('Error al cargar salas desde Firebase:', e);
    return {};
  }
}

async function saveRooms() {
  try {
    await roomsRef.set(PREDEFINED_ROOMS);
  } catch (e) {
    console.error('Error al guardar salas en Firebase:', e);
  }
}

const PORT = process.env.PORT || 3001;

// --- LÓGICA DE AUTO-PING Y APAGADO INTELIGENTE ---
let autoPingInterval = null;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

function startAutoPing() {
  if (!autoPingInterval) {
    autoPingInterval = setInterval(() => {
      const totalUsers = Object.values(roomUsers).reduce((acc, arr) => acc + arr.length, 0);
      if (totalUsers > 0) {
        http.get(`http://localhost:${PORT}/ping`, () => {});
        console.log('Auto-ping enviado. Usuarios activos:', totalUsers);
      }
    }, 5 * 60 * 1000); // cada 5 minutos
    console.log('Sistema de Auto-ping activado.');
  }
}

function stopAutoPing() {
  if (autoPingInterval) {
    clearInterval(autoPingInterval);
    autoPingInterval = null;
    console.log('Sistema de Auto-ping detenido por inactividad.');
  }
}

// Nueva función que revisa si el servidor debe "dormirse"
function checkIdleServerState() {
    const totalUsers = Object.values(roomUsers).reduce((acc, arr) => acc + arr.length, 0);
    if (totalUsers > 0) {
        // Si hay usuarios, nos aseguramos de que el ping esté activo y no hacemos nada más.
        startAutoPing();
        return;
    }

    // Si no hay usuarios, revisamos las salas.
    let shouldStop = true;
    for (const roomId in roomStates) {
        const state = roomStates[roomId];
        // Si una sala está reproduciéndose, no apagamos.
        if (state.isPlaying) {
            shouldStop = false;
            break;
        }
        // Si una sala está pausada, pero no ha pasado el tiempo de inactividad, no apagamos.
        if (!state.isPlaying && state.lastPausedTimestamp) {
            if (Date.now() - state.lastPausedTimestamp < IDLE_TIMEOUT_MS) {
                shouldStop = false;
                break;
            }
        }
    }

    if (shouldStop) {
        console.log('Condiciones de inactividad cumplidas. Deteniendo auto-ping.');
        stopAutoPing();
    }
}

app.get('/ping', (req, res) => res.send('pong'));

// --- FUNCIÓN PRINCIPAL DE ARRANQUE ---
async function startServer() {
  if (!ADMIN_SECRET) {
    console.error("FATAL ERROR: La variable de entorno ADMIN_SECRET no está definida.");
    process.exit(1);
  }

  PREDEFINED_ROOMS = await loadRooms();
  await loadRoomStates();

  // --- TAREAS PERIÓDICAS DEL SERVIDOR ---
  // 1. Revisa si el servidor debe irse a dormir.
  setInterval(checkIdleServerState, 60 * 1000); // Cada minuto

  // 2. Envía estado a la consola de Jean.
  setInterval(() => {
    if (jeanSockets.length > 0) {
      const message = `Ok, ok ok ok - ${new Date().toLocaleTimeString()}`;
      jeanSockets.forEach(socketId => {
        io.to(socketId).emit('backend-status-ping', message);
      });
    }
  }, 5000); // Cada 5 segundos

  io.on('connection', (socket) => {
    console.log(`Usuario Conectado: ${socket.id}`);
    socket.emit('initial-lobby-data', PREDEFINED_ROOMS);

    socket.on('join-room', ({ roomId, username }) => {
      if (!PREDEFINED_ROOMS[roomId]) return;
      
      socket.join(roomId);
      console.log(`Usuario ${username} (${socket.id}) se unió a la sala: ${roomId}`);

      if (!roomUsers[roomId]) roomUsers[roomId] = [];
      roomUsers[roomId].push({ id: socket.id, name: username });

      // Si el usuario es "Jean", lo guardamos para la consola.
      if (username.toLowerCase() === 'jean') {
        jeanSockets.push(socket.id);
        console.log(`Usuario 'Jean' detectado. Socket ID: ${socket.id}`);
      }

      io.in(roomId).emit('user-joined', { id: socket.id, name: username, users: roomUsers[roomId] });

      if (!roomStates[roomId]) {
        roomStates[roomId] = { videoUrl: PREDEFINED_ROOMS[roomId].videoUrl, currentTime: 0, isPlaying: false, lastPausedTimestamp: null };
      }
      
      socket.emit('receive-video-state', roomStates[roomId]);

      io.in(roomId).emit('chat-message', {
        username: 'Sistema',
        message: `${username} se ha unido a la sala.`,
        timestamp: Date.now(),
        isSystem: true
      });

      // Al unirse el primer usuario, activamos el ping.
      startAutoPing();
    });

    socket.on('send-play', async ({ roomId, currentTime }) => {
      if (roomStates[roomId]) {
        roomStates[roomId].isPlaying = true;
        roomStates[roomId].lastPausedTimestamp = null; // Limpiamos el timestamp de pausa
        await saveRoomStates();
      }
      socket.to(roomId).emit('receive-play', currentTime);
    });

    socket.on('send-pause', async ({ roomId, currentTime }) => {
      if (roomStates[roomId]) {
        roomStates[roomId].isPlaying = false;
        roomStates[roomId].currentTime = currentTime;
        roomStates[roomId].lastPausedTimestamp = Date.now(); // Guardamos cuándo se pausó
        const user = (roomUsers[roomId] || []).find(u => u.id === socket.id);
        lastPausedBy[roomId] = user ? user.name : 'Desconocido';
        await saveRoomStates();
        io.in(roomId).emit('chat-message', {
          username: 'Sistema',
          message: `Pausado por ${user ? user.name : 'Desconocido'}`,
          timestamp: Date.now(),
          isSystem: true
        });
      }
      socket.to(roomId).emit('receive-pause', currentTime);
    });

    socket.on('send-seek', async ({ roomId, time }) => {
      if (roomStates[roomId]) {
        roomStates[roomId].currentTime = time;
        await saveRoomStates();
      }
      socket.to(roomId).emit('receive-seek', time);
    });

    socket.on('send-chat-message', ({ roomId, username, message }) => {
      const chatMessage = { username, message, timestamp: Date.now() };
      io.in(roomId).emit('chat-message', chatMessage);
    });

    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.id}`);
      // Lo sacamos de la lista de Jean si estaba.
      jeanSockets = jeanSockets.filter(id => id !== socket.id);

      for (const roomId in roomUsers) {
        const userIndex = roomUsers[roomId].findIndex(user => user.id === socket.id);
        if (userIndex !== -1) {
          const [disconnectedUser] = roomUsers[roomId].splice(userIndex, 1);
          console.log(`Usuario ${disconnectedUser.name} desconectado de la sala ${roomId}`);
          
          io.in(roomId).emit('user-left', { id: disconnectedUser.id, name: disconnectedUser.name, users: roomUsers[roomId] });
          io.in(roomId).emit('chat-message', {
            username: 'Sistema',
            message: `${disconnectedUser.name} ha abandonado la sala.`,
            timestamp: Date.now(),
            isSystem: true
          });
          
          // Si la sala queda vacía, lo gestionará la tarea periódica `checkIdleServerState`.
          if (roomUsers[roomId].length === 0) {
            console.log(`Sala ${roomId} ha quedado vacía.`);
            delete roomUsers[roomId];
          }
          break;
        }
      }
    });

    // --- Eventos de Admin (sin cambios) ---
    socket.on('admin-update-room', async ({ roomId, newMovie, newUrl, adminPassword }) => {
        if (adminPassword !== ADMIN_SECRET) return socket.emit('admin-error', 'Contraseña de administrador incorrecta.');
        if (!PREDEFINED_ROOMS[roomId]) return socket.emit('admin-error', 'La sala no existe.');

        console.log(`Admin actualizando la sala ${roomId}`);
        const room = PREDEFINED_ROOMS[roomId];
        const roomState = roomStates[roomId];
        
        if (typeof newMovie === 'string') room.movie = newMovie;
        if (typeof newUrl === 'string') room.videoUrl = newUrl;
        
        if (roomState && newUrl && roomState.videoUrl !== newUrl) {
            roomState.videoUrl = newUrl;
            roomState.currentTime = 0;
            roomState.isPlaying = false;
            roomState.lastPausedTimestamp = Date.now();
            await saveRoomStates();
            io.in(roomId).emit('receive-video-change', newUrl);
            io.in(roomId).emit('chat-message', { username: 'Sistema', message: 'Un administrador ha cambiado la película.', timestamp: Date.now(), isSystem: true });
        }
        
        await saveRooms();
        io.emit('update-lobby-data', PREDEFINED_ROOMS);
    });

    socket.on('admin-request-room-status', (adminPassword) => {
        if (adminPassword !== ADMIN_SECRET) return socket.emit('admin-room-status', { error: 'Contraseña incorrecta.' });
        
        const status = {};
        for (const roomId in PREDEFINED_ROOMS) {
            status[roomId] = {
                name: PREDEFINED_ROOMS[roomId].name,
                movie: PREDEFINED_ROOMS[roomId].movie,
                users: roomUsers[roomId] || [],
                videoState: roomStates[roomId] || { currentTime: 0, isPlaying: false, videoUrl: PREDEFINED_ROOMS[roomId].videoUrl, lastPausedTimestamp: null },
                lastPausedBy: lastPausedBy[roomId] || null
            };
        }
        socket.emit('admin-room-status', status);
    });
  });

  server.listen(PORT, () => {
    console.log(`Servidor de Cine Virtual escuchando en el puerto ${PORT}`);
  });
}

startServer();