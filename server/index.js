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
    origin: "*", // Puedes cambiar "*" por "http://localhost:3000" para más seguridad
    methods: ["GET", "POST"]
  }
});

// Escuchamos cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log(`Usuario Conectado: ${socket.id}`);

  // Evento para unirse a una sala
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Usuario ${socket.id} se unió a la sala: ${roomId}`);
  });

  // Cuando un usuario da 'play', lo comunicamos a los demás en la sala
  socket.on('send-play', ({ roomId }) => {
    // 'socket.to(roomId)' emite a todos en la sala EXCEPTO al que envió el evento
    socket.to(roomId).emit('receive-play');
    console.log(`Evento 'play' enviado a la sala: ${roomId}`);
  });

  // Cuando un usuario da 'pause'
  socket.on('send-pause', ({ roomId }) => {
    socket.to(roomId).emit('receive-pause');
    console.log(`Evento 'pause' enviado a la sala: ${roomId}`);
  });

  // Cuando un usuario busca un punto en el video
  socket.on('send-seek', ({ roomId, time }) => {
    socket.to(roomId).emit('receive-seek', time);
    console.log(`Evento 'seek' a ${time}s enviado a la sala: ${roomId}`);
  });

  // Cuando un usuario cambia el video
  socket.on('send-video-change', ({ roomId, newUrl }) => {
    // 'io.in(roomId)' emite a TODOS en la sala, incluido el que lo envió.
    // Esto asegura que la URL cambie para todos de forma consistente.
    io.in(roomId).emit('receive-video-change', newUrl);
    console.log(`Evento 'video-change' a ${newUrl} enviado a la sala: ${roomId}`);
  });

  // Cuando un usuario se desconecta
  socket.on('disconnect', () => {
    console.log(`Usuario Desconectado: ${socket.id}`);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Servidor de Watch Party escuchando en el puerto ${PORT}`);
});
