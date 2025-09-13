// Importamos las librerías necesarias
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// Creamos el servidor
const app = express();
const server = http.createServer(app);

// Configuramos socket.io con CORS
const io = new Server(server, {
  cors: {
    origin: "*", // En producción, cambiar "*" por tu dominio
    methods: ["GET", "POST"]
  }
});

// **NUEVO**: Definimos las salas de cine y sus películas
const PREDEFINED_ROOMS = {
  'sala-1': { 
    name: 'Sala 1: Manos de Tijera', 
    videoUrl: 'https://pub-cd2cf2772f534ea0b1f45983378f56d8.r2.dev/manosdetijera.mp4' 
  },
  'sala-2': { 
    name: 'Sala 2: Big Buck Bunny', 
    videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' 
  },
  'sala-3': { name: 'Sala 3: (Próximamente)', videoUrl: '' },
  'sala-4': { name: 'Sala 4: (Próximamente)', videoUrl: '' },
  'sala-5': { name: 'Sala 5: (Próximamente)', videoUrl: '' },
};

// Almacena el estado actual del video por sala (ESTO AHORA ES PERSISTENTE MIENTRAS EL SERVIDOR VIVA)
const roomStates = {}; 
// Almacena los usuarios conectados por sala
const roomUsers = {};

// Escuchamos cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log(`Usuario Conectado: ${socket.id}`);

  socket.on('join-room', ({ roomId, username }) => {
    // Validar que la sala exista
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

    // **LÓGICA MEJORADA**: Si la sala nunca ha sido usada, la inicializamos. Si ya existe, enviamos su estado actual.
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
  });

  socket.on('send-play', ({ roomId, currentTime }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].isPlaying = true;
      roomStates[roomId].currentTime = currentTime;
    }
    socket.to(roomId).emit('receive-play', currentTime);
  });

  socket.on('send-pause', ({ roomId, currentTime }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].isPlaying = false;
      roomStates[roomId].currentTime = currentTime;
    }
    socket.to(roomId).emit('receive-pause', currentTime);
  });

  socket.on('send-seek', ({ roomId, time }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].currentTime = time;
    }
    socket.to(roomId).emit('receive-seek', time);
  });

  // El cambio de video ya no es necesario si las salas son fijas, pero lo mantenemos por si acaso
  socket.on('send-video-change', ({ roomId, newUrl }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].videoUrl = newUrl;
      roomStates[roomId].currentTime = 0;
      roomStates[roomId].isPlaying = false;
      io.in(roomId).emit('receive-video-change', newUrl);
      io.in(roomId).emit('chat-message', {
        username: 'Sistema',
        message: `El video de la sala ha cambiado.`,
        timestamp: Date.now(),
        isSystem: true
      });
    }
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
        
        // **LÓGICA MEJORADA**: Si la sala queda vacía, pausamos el video pero NO borramos el estado.
        if (roomUsers[roomId].length === 0) {
          console.log(`Sala ${roomId} vacía. Pausando video y limpiando lista de usuarios.`);
          if(roomStates[roomId]) {
            roomStates[roomId].isPlaying = false;
          }
          delete roomUsers[roomId];
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