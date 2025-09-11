import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// Conectamos con nuestro servidor
const socket = io.connect("http://localhost:3001");

function App() {
  const [roomId, setRoomId] = useState('mi-sala-secreta');
  const [videoUrl, setVideoUrl] = useState('http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  const [inputUrl, setInputUrl] = useState('');
  
  const playerRef = useRef(null);
  // Esta 'ref' nos ayudará a saber si una acción (play, pause) fue iniciada
  // por el usuario o recibida desde el servidor, para evitar bucles.
  const isSocketAction = useRef(false);

  useEffect(() => {
    socket.emit('join-room', roomId);

    // --- Definimos los manejadores de eventos del servidor ---
    const handleReceivePlay = () => {
      console.log("Recibido: Play");
      if (playerRef.current?.paused) {
        isSocketAction.current = true; // Marcamos que esta acción viene del socket
        playerRef.current.play();
      }
    };

    const handleReceivePause = () => {
      console.log("Recibido: Pause");
      if (!playerRef.current?.paused) {
        isSocketAction.current = true; // Marcamos que esta acción viene del socket
        playerRef.current.pause();
      }
    };
    
    const handleReceiveSeek = (time) => {
      console.log(`Recibido: Seek a ${time}`);
      if (playerRef.current && Math.abs(playerRef.current.currentTime - time) > 1) {
        isSocketAction.current = true; // Marcamos que esta acción viene del socket
        playerRef.current.currentTime = time;
      }
    };
    
    const handleReceiveVideoChange = (newUrl) => {
      console.log(`Recibido cambio de video: ${newUrl}`);
      setVideoUrl(newUrl);
    };

    // --- Nos suscribimos a los eventos ---
    socket.on('receive-play', handleReceivePlay);
    socket.on('receive-pause', handleReceivePause);
    socket.on('receive-seek', handleReceiveSeek);
    socket.on('receive-video-change', handleReceiveVideoChange);

    // --- Limpieza de listeners al desmontar el componente ---
    return () => {
      socket.off('receive-play', handleReceivePlay);
      socket.off('receive-pause', handleReceivePause);
      socket.off('receive-seek', handleReceiveSeek);
      socket.off('receive-video-change', handleReceiveVideoChange);
    };
  }, [roomId]);

  // --- Funciones que envían nuestras acciones al servidor ---
  
  const handlePlay = () => {
    // Si la acción fue por un evento del socket, la ignoramos para no crear un bucle
    if (isSocketAction.current) {
      isSocketAction.current = false;
      return;
    }
    socket.emit('send-play', { roomId });
  };

  const handlePause = () => {
    if (isSocketAction.current) {
      isSocketAction.current = false;
      return;
    }
    socket.emit('send-pause', { roomId });
  };
  
  const handleSeeked = () => {
    if (isSocketAction.current) {
      isSocketAction.current = false;
      return;
    }
    socket.emit('send-seek', { roomId, time: playerRef.current.currentTime });
  };
  
  const handleChangeVideo = () => {
    if (inputUrl) {
      socket.emit('send-video-change', { roomId, newUrl: inputUrl });
      setInputUrl('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Watch Party 🍿</h1>
        <p>Estás en la sala: <b>{roomId}</b></p>
        
        <div className="video-input-container">
          <input 
            type="text" 
            placeholder="Pega la URL del video aquí"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleChangeVideo()}
          />
          <button onClick={handleChangeVideo}>Cambiar Video</button>
        </div>

        <video 
          ref={playerRef}
          controls
          width="80%" 
          src={videoUrl}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
          // Añadimos esto para que al cambiar de video, se actualice en todos lados
          onLoadedData={() => handleSeeked()} 
        >
          Tu navegador no soporta el tag de video.
        </video>

      </header>
    </div>
  );
}

export default App;
