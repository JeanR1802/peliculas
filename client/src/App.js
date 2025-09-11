import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Conectamos con nuestro servidor. ¡RECUERDA CAMBIAR ESTO POR LA URL DE RENDER EN PRODUCCIÓN!
// const socket = io.connect("http://localhost:3001"); // Para desarrollo local
const socket = io.connect("https://modixia-watch-party-server.onrender.com"); // ¡Cambia esta URL por la de tu servidor en Render!

// --- Estilos CSS integrados en el componente ---
const AppStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');

    :root {
      --bg-color: #1a1d24;
      --card-bg-color: #22272e;
      --text-color: #e0e0e0;
      --secondary-text-color: #8b949e;
      --primary-accent: #3392ff;
      --primary-accent-hover: #58a6ff;
      --border-color: #30363d;
      --chat-bg: #2d333b;
      --chat-message-bg: #3d424b;
      --system-message-color: #79c0ff;
    }

    body {
      margin: 0;
      font-family: 'Poppins', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
    }

    .App {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-sizing: border-box;
    }

    .App-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      max-width: 1200px;
      background-color: var(--card-bg-color);
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      padding: 30px;
    }

    .header-section {
      text-align: center;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 2.8rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
      color: var(--text-color);
      text-shadow: 2px 2px 5px rgba(0,0,0,0.2);
    }

    .room-info {
      font-size: 1.1rem;
      color: var(--secondary-text-color);
      margin-top: 5px;
    }

    .room-info b {
      color: var(--primary-accent);
      font-weight: 600;
    }

    .video-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
      flex-grow: 1;
    }

    .video-input-container {
      display: flex;
      gap: 10px;
      width: 100%;
    }

    .video-input-container input {
      flex-grow: 1;
      padding: 12px 18px;
      font-size: 1rem;
      border-radius: 8px;
      border: 2px solid var(--border-color);
      background-color: var(--bg-color);
      color: var(--text-color);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .video-input-container input:focus {
      outline: none;
      border-color: var(--primary-accent);
      box-shadow: 0 0 0 3px rgba(51, 146, 255, 0.3);
    }

    .video-input-container input::placeholder {
      color: var(--secondary-text-color);
    }

    button {
      padding: 12px 24px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      border-radius: 8px;
      border: none;
      background-color: var(--primary-accent);
      color: white;
      transition: background-color 0.2s ease, transform 0.1s ease;
    }

    button:hover {
      background-color: var(--primary-accent-hover);
      transform: translateY(-1px);
    }

    button:active {
      transform: translateY(0);
    }

    video {
      width: 100%;
      max-width: 100%; /* Asegura que el video no se salga del contenedor */
      min-height: 250px; /* Altura mínima para que siempre sea visible */
      background-color: black;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    }

    .chat-section {
      background-color: var(--chat-bg);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      padding: 15px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    }

    .chat-messages {
      flex-grow: 1;
      height: 250px; /* Altura fija para el chat */
      overflow-y: auto;
      margin-bottom: 15px;
      padding-right: 10px; /* Espacio para la barra de desplazamiento */
      scroll-behavior: smooth; /* Desplazamiento suave */
    }

    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: var(--card-bg-color);
      border-radius: 10px;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 10px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: var(--secondary-text-color);
    }

    .chat-message {
      margin-bottom: 8px;
      word-wrap: break-word; /* Para que los mensajes largos no desborden */
    }

    .chat-message.system {
      color: var(--system-message-color);
      font-style: italic;
      text-align: center;
      font-size: 0.9em;
    }

    .chat-message.me .username {
        color: var(--primary-accent);
        font-weight: 600;
    }
    
    .chat-message .username {
        color: var(--primary-accent-hover);
        font-weight: 600;
        margin-right: 5px;
    }
    
    .chat-message .text {
        color: var(--text-color);
    }


    .chat-input-container {
      display: flex;
      gap: 10px;
    }

    .chat-input-container input {
      flex-grow: 1;
      padding: 12px 18px;
      font-size: 1rem;
      border-radius: 8px;
      border: 2px solid var(--border-color);
      background-color: var(--bg-color);
      color: var(--text-color);
    }

    /* Modal de Nombre de Usuario */
    .username-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .username-modal {
        background-color: var(--card-bg-color);
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        text-align: center;
        width: 90%;
        max-width: 400px;
        animation: fadeIn 0.3s ease-out;
    }

    .username-modal h2 {
        color: var(--primary-accent);
        margin-bottom: 20px;
        font-size: 2rem;
    }

    .username-modal input {
        width: calc(100% - 36px); /* padding 18px a cada lado */
        margin-bottom: 20px;
    }

    /* Responsive adjustments */
    @media (min-width: 768px) {
      .App-container {
        flex-direction: row;
        padding: 40px;
      }

      .video-section {
        width: 65%;
      }

      .chat-section {
        width: 35%;
        margin-left: 20px; /* Ajuste para el espaciado en desktop */
        height: auto; /* El chat toma la altura disponible */
      }

      .chat-messages {
        height: 400px; /* Ajuste para desktop */
      }
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
  `}</style>
);


function App() {
  const [roomId, setRoomId] = useState('mi-sala-secreta');
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [videoUrl, setVideoUrl] = useState(''); // Se inicializa vacío y el servidor lo enviará
  const [inputUrl, setInputUrl] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [usersInRoom, setUsersInRoom] = useState([]);
  
  const playerRef = useRef(null);
  const isSocketAction = useRef(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of chat messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!username) return; // No se une hasta que no haya nombre de usuario

    // --- Unirse a la sala con el nombre de usuario ---
    socket.emit('join-room', { roomId, username });

    // --- Definimos los manejadores de eventos del servidor ---
    const handleReceivePlay = (currentTime) => {
      console.log("Recibido: Play");
      if (playerRef.current && playerRef.current.paused) {
        isSocketAction.current = true;
        playerRef.current.currentTime = currentTime; // Asegura la posición antes de play
        playerRef.current.play();
      }
    };

    const handleReceivePause = (currentTime) => {
      console.log("Recibido: Pause");
      if (playerRef.current && !playerRef.current.paused) {
        isSocketAction.current = true;
        playerRef.current.currentTime = currentTime; // Asegura la posición antes de pause
        playerRef.current.pause();
      }
    };
    
    const handleReceiveSeek = (time) => {
      console.log(`Recibido: Seek a ${time}`);
      if (playerRef.current && Math.abs(playerRef.current.currentTime - time) > 1) {
        isSocketAction.current = true;
        playerRef.current.currentTime = time;
      }
    };
    
    const handleReceiveVideoChange = (newUrl) => {
      console.log(`Recibido cambio de video: ${newUrl}`);
      setVideoUrl(newUrl);
    };

    const handleReceiveChatMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleReceiveVideoState = (state) => {
        console.log("Recibido estado del video al unirse:", state);
        if (playerRef.current) {
            playerRef.current.src = state.videoUrl;
            playerRef.current.currentTime = state.currentTime;
            // Vercel / Chrome pueden bloquear el auto-play si no hay interacción previa.
            // Solo pausamos/reproducimos si el usuario ya interactuó o si el video ya cargó.
            if (state.isPlaying) {
                // Intentar reproducir, pero puede ser bloqueado por el navegador
                playerRef.current.play().catch(e => console.log("Autoplay bloqueado:", e));
            } else {
                playerRef.current.pause();
            }
            setVideoUrl(state.videoUrl); // Actualiza la URL en el estado local de React
        }
    };

    const handleUserJoined = ({ name, users }) => {
      setUsersInRoom(users);
      // No añadimos el mensaje aquí, ya lo hace el servidor con 'chat-message'
    };

    const handleUserLeft = ({ name, users }) => {
      setUsersInRoom(users);
      // No añadimos el mensaje aquí, ya lo hace el servidor con 'chat-message'
    };


    // --- Nos suscribimos a los eventos ---
    socket.on('receive-play', handleReceivePlay);
    socket.on('receive-pause', handleReceivePause);
    socket.on('receive-seek', handleReceiveSeek);
    socket.on('receive-video-change', handleReceiveVideoChange);
    socket.on('chat-message', handleReceiveChatMessage);
    socket.on('receive-video-state', handleReceiveVideoState); // Para sincronización inicial
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);


    // --- Limpieza de listeners al desmontar el componente ---
    return () => {
      socket.off('receive-play', handleReceivePlay);
      socket.off('receive-pause', handleReceivePause);
      socket.off('receive-seek', handleReceiveSeek);
      socket.off('receive-video-change', handleReceiveVideoChange);
      socket.off('chat-message', handleReceiveChatMessage);
      socket.off('receive-video-state', handleReceiveVideoState);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [roomId, username]); // Depende del username para unirse

  // --- Funciones que envían nuestras acciones al servidor ---
  
  const handlePlay = () => {
    if (isSocketAction.current) {
      isSocketAction.current = false;
      return;
    }
    socket.emit('send-play', { roomId, currentTime: playerRef.current.currentTime });
  };

  const handlePause = () => {
    if (isSocketAction.current) {
      isSocketAction.current = false;
      return;
    }
    socket.emit('send-pause', { roomId, currentTime: playerRef.current.currentTime });
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

  const handleSendChatMessage = () => {
    if (chatInput.trim()) {
      socket.emit('send-chat-message', { roomId, username, message: chatInput });
      setChatInput('');
    }
  };

  const handleSetUsername = () => {
    if (inputUsername.trim()) {
      setUsername(inputUsername.trim());
    }
  };

  // Si no hay nombre de usuario, muestra el modal para introducirlo
  if (!username) {
    return (
      <>
        <AppStyles />
        <div className="username-modal-overlay">
          <div className="username-modal">
            <h2>¡Bienvenido a Modixia Watch Party!</h2>
            <input 
              type="text" 
              placeholder="Introduce tu nombre de usuario"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSetUsername()}
            />
            <button onClick={handleSetUsername}>Unirme a la Sala</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppStyles />
      <div className="App">
        <div className="App-container">
          <div className="video-section">
            <div className="header-section">
              <h1>Watch Party 🍿</h1>
              <p className="room-info">Estás en la sala: <b>{roomId}</b> como <b>{username}</b></p>
              <p className="room-info">Usuarios en la sala: {usersInRoom.map(u => u.name).join(', ')}</p>
            </div>
            
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
              width="100%" 
              src={videoUrl}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeeked}
            >
              Tu navegador no soporta el tag de video.
            </video>
          </div>

          <div className="chat-section">
            <h3>Chat de la Sala</h3>
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <p key={index} className={`chat-message ${msg.isSystem ? 'system' : ''} ${msg.username === username ? 'me' : ''}`}>
                  {msg.isSystem ? (
                    msg.message
                  ) : (
                    <>
                      <span className="username">{msg.username}:</span> <span className="text">{msg.message}</span>
                    </>
                  )}
                </p>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-container">
              <input 
                type="text" 
                placeholder="Escribe un mensaje..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
              />
              <button onClick={handleSendChatMessage}>Enviar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;