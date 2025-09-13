// Importamos las librerías necesarias
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// Creamos el servidor
const app = express();
const server = http.createServer(app);

// Configuramos socket.io con CORS para permitir la conexión desde tu app de React
const io = new Server(server, {
  cors: {
    origin: "*", // En producción, cambiar "*" por tu dominio "https://modixia.pro"
    methods: ["GET", "POST"]
  }
});

// Almacena el estado actual del video por sala
const roomStates = {}; // { roomId: { videoUrl: '...', currentTime: 0, isPlaying: false } }
// Almacena los usuarios conectados por sala
const roomUsers = {}; // { roomId: [{ id: socket.id, name: '...' }] }

// Escuchamos cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log(`Usuario Conectado: ${socket.id}`);

  // Evento para unirse a una sala y establecer el nombre de usuario
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`Usuario ${username} (${socket.id}) se unió a la sala: ${roomId}`);

    // Añadir el usuario a la lista de la sala
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }
    roomUsers[roomId].push({ id: socket.id, name: username });

    // Informar a todos en la sala que un nuevo usuario se unió
    io.in(roomId).emit('user-joined', { id: socket.id, name: username, users: roomUsers[roomId] });

    // Si la sala ya tiene un estado de video, enviárselo al nuevo usuario
    if (roomStates[roomId]) {
      socket.emit('receive-video-state', roomStates[roomId]);
    } else {
      // Si la sala es nueva, inicializar el estado
      roomStates[roomId] = {
        videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        currentTime: 0,
        isPlaying: false
      };
      socket.emit('receive-video-state', roomStates[roomId]); // Enviar estado inicial
    }

    io.in(roomId).emit('chat-message', {
      username: 'Sistema',
      message: `${username} se ha unido a la sala.`,
      timestamp: Date.now(),
      isSystem: true
    });
  });

  // Cuando un usuario da 'play', lo comunicamos a los demás en la sala
  socket.on('send-play', ({ roomId, currentTime }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].isPlaying = true;
      roomStates[roomId].currentTime = currentTime;
    }
    socket.to(roomId).emit('receive-play', currentTime);
  });

  // Cuando un usuario da 'pause'
  socket.on('send-pause', ({ roomId, currentTime }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].isPlaying = false;
      roomStates[roomId].currentTime = currentTime;
    }
    socket.to(roomId).emit('receive-pause', currentTime);
  });

  // Cuando un usuario busca un punto en el video
  socket.on('send-seek', ({ roomId, time }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].currentTime = time;
    }
    socket.to(roomId).emit('receive-seek', time);
  });

  // Cuando un usuario cambia el video
  socket.on('send-video-change', ({ roomId, newUrl }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].videoUrl = newUrl;
      roomStates[roomId].currentTime = 0;
      roomStates[roomId].isPlaying = false;
    }
    io.in(roomId).emit('receive-video-change', newUrl);
    io.in(roomId).emit('chat-message', {
      username: 'Sistema',
      message: `El video ha cambiado.`,
      timestamp: Date.now(),
      isSystem: true
    });
  });

  // Cuando un usuario envía un mensaje de chat
  socket.on('send-chat-message', ({ roomId, username, message }) => {
    const chatMessage = {
      username,
      message,
      timestamp: Date.now()
    };
    io.in(roomId).emit('chat-message', chatMessage);
  });
  
  // **NUEVO**: Listener para mantener el servidor despierto
  socket.on('ping', () => {
    // No necesita hacer nada, solo recibir la conexión es suficiente
    // console.log(`Ping recibido de ${socket.id}`);
  });

  // Cuando un usuario se desconecta
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
          delete roomUsers[roomId];
          delete roomStates[roomId];
          console.log(`Sala ${roomId} vacía. Estado y usuarios eliminados.`);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor de Watch Party escuchando en el puerto ${PORT}`);
});