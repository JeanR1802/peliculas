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
      --system-message-color: #79c0ff;
      --success-color: #28a745;
    }

    body {
      margin: 0;
      font-family: 'Poppins', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      overflow: hidden; /* Evita el scroll en toda la página */
    }

    /* Contenedor principal a pantalla completa */
    .App {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      background-color: var(--bg-color);
    }

    /* Sección de Video (arriba) */
    .video-section {
      flex: 1; /* Ocupa todo el espacio vertical disponible */
      display: flex;
      flex-direction: column;
      padding: 15px 20px 10px 20px;
      box-sizing: border-box;
      overflow: hidden; /* Previene desbordamientos */
      gap: 15px;
    }
    
    .header-and-input {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      flex-shrink: 0;
    }

    .header-section { text-align: center; margin-bottom: 0; }
    h1 { font-size: 1.5rem; margin: 0; }
    .room-info { font-size: 0.9rem; margin: 0; }
    .room-info b { color: var(--primary-accent); font-weight: 600; }
    .video-input-container { display: flex; gap: 10px; width: 100%; max-width: 800px; }

    /* Nuevo contenedor para centrar el video */
    .video-wrapper {
        flex-grow: 1;
        background-color: black;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0; /* Clave para que el flex-item se encoja correctamente */
    }

    video {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain; /* Mantiene la relación de aspecto del video */
    }
    
    /* Contenedor inferior (Chat y Lista de Usuarios) */
    .bottom-section {
      height: 40vh; /* Aumentamos un poco la altura */
      flex-shrink: 0;
      display: flex;
      background-color: var(--card-bg-color);
      border-top: 2px solid var(--border-color);
    }
    
    /* Sección de Chat */
    .chat-section {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      padding: 15px;
      box-sizing: border-box;
      border-right: 1px solid var(--border-color);
    }

    .chat-messages {
      flex-grow: 1;
      overflow-y: auto;
      margin-bottom: 15px;
      padding-right: 10px;
      display: flex;
      flex-direction: column;
    }

    /* Estilos de la barra de scroll */
    .chat-messages::-webkit-scrollbar { width: 8px; }
    .chat-messages::-webkit-scrollbar-track { background: var(--chat-bg); border-radius: 10px; }
    .chat-messages::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
    .chat-messages::-webkit-scrollbar-thumb:hover { background: var(--secondary-text-color); }

    .chat-message { 
      padding: 8px 12px;
      border-radius: 12px;
      margin-bottom: 8px; 
      word-wrap: break-word; 
      max-width: 70%;
      display: flex;
      flex-direction: column;
    }
    .chat-message.system { 
      color: var(--system-message-color); 
      font-style: italic; 
      text-align: center; 
      font-size: 0.9em;
      background: none;
      align-self: center;
    }
    .chat-message.me {
      background-color: var(--primary-accent);
      color: white;
      align-self: flex-end; /* Alinea a la derecha */
    }
    .chat-message.other {
      background-color: var(--chat-bg);
      align-self: flex-start; /* Alinea a la izquierda */
    }
    .chat-message .username { font-weight: 600; margin-bottom: 3px; font-size: 0.9em; }
    .chat-message.me .username { color: #f0f0f0; } /* Nombre de usuario en mensajes propios */
    .chat-message.other .username { color: var(--primary-accent-hover); }

    .timestamp {
      font-size: 0.75em;
      color: var(--secondary-text-color);
      text-align: right;
      margin-top: 4px;
    }
    .chat-message.me .timestamp { color: rgba(255, 255, 255, 0.7); }

    .chat-input-container { display: flex; gap: 10px; }
    
    /* Lista de Usuarios */
    .user-list-section {
      width: 250px;
      padding: 15px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .user-list-section h3 {
      margin: 0 0 15px 0;
      text-align: center;
      color: var(--secondary-text-color);
    }
    .user-list {
      list-style-type: none;
      padding: 0;
      margin: 0;
      overflow-y: auto;
    }
    .user-list-item {
      padding: 8px;
      border-radius: 5px;
      margin-bottom: 5px;
      color: var(--text-color);
    }
    .user-list-item::before {
      content: '●';
      color: var(--success-color);
      margin-right: 10px;
    }
    
    .generic-input {
      flex-grow: 1; padding: 12px 18px; font-size: 1rem; border-radius: 8px;
      border: 2px solid var(--border-color); background-color: var(--bg-color);
      color: var(--text-color); transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .generic-input:focus { outline: none; border-color: var(--primary-accent); box-shadow: 0 0 0 3px rgba(51, 146, 255, 0.3); }
    .generic-input::placeholder { color: var(--secondary-text-color); }

    button {
      padding: 10px 20px; font-size: 0.9rem; font-weight: bold; cursor: pointer;
      border-radius: 8px; border: none; background-color: var(--primary-accent);
      color: white; transition: background-color 0.2s ease, transform 0.1s ease;
    }
    button:hover { background-color: var(--primary-accent-hover); transform: translateY(-1px); }
    button:active { transform: translateY(0); }
    button:disabled { background-color: var(--border-color); cursor: not-allowed; transform: none; }

    .control-buttons {
        display: flex;
        gap: 10px;
        margin-top: auto; /* Empuja los botones al final */
    }
    .copy-btn.copied {
        background-color: var(--success-color);
    }
    
    /* Modal de Unirse a la Sala (sin cambios) */
    .join-modal-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center;
        align-items: center; z-index: 1000; backdrop-filter: blur(5px);
    }
    .join-modal {
        background-color: var(--card-bg-color); padding: 40px; border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); text-align: center;
        width: 90%; max-width: 450px; animation: fadeIn 0.3s ease-out;
    }
    .join-modal h2 { color: var(--text-color); margin-bottom: 10px; font-size: 2.2rem; }
    .join-modal p { color: var(--secondary-text-color); margin-bottom: 30px; }
    .join-modal-inputs { display: flex; flex-direction: column; gap: 15px; margin-bottom: 30px; }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    /* Responsive para pantallas pequeñas */
    @media (max-width: 768px) {
        .user-list-section { display: none; } /* Ocultamos la lista de usuarios en móvil */
        .chat-section { border-right: none; }
        h1 { font-size: 1.2rem; }
    }
  `}</style>
);


function App() {
  // --- Estados de la aplicación ---
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Copiar Enlace');
  const [, setIsFullscreen] = useState(false); // **NUEVO**: Estado para forzar re-render

  // Estados para los inputs del modal
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  
  // Estados de la sala
  const [videoUrl, setVideoUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [usersInRoom, setUsersInRoom] = useState([]);
  
  // --- Refs para controlar elementos directamente ---
  const playerRef = useRef(null);
  const isSocketAction = useRef(false);
  const messagesEndRef = useRef(null);

  // Scroll automático al final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // **NUEVO**: Efecto para manejar el cambio a pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Simplemente actualizamos un estado para forzar a React a re-renderizar.
      // Esto ayuda al navegador a recalcular el layout correctamente.
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Limpieza del listener
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);


  // Efecto principal para la comunicación con el socket
  useEffect(() => {
    // No hacer nada si no estamos en una sala
    if (!isInRoom) return;

    socket.emit('join-room', { roomId, username });

    // --- Definimos los manejadores de eventos del servidor ---
    const handleReceivePlay = (currentTime) => {
      if (playerRef.current && playerRef.current.paused) {
        isSocketAction.current = true;
        playerRef.current.currentTime = currentTime;
        playerRef.current.play();
      }
    };
    const handleReceivePause = (currentTime) => {
      if (playerRef.current && !playerRef.current.paused) {
        isSocketAction.current = true;
        playerRef.current.currentTime = currentTime;
        playerRef.current.pause();
      }
    };
    const handleReceiveSeek = (time) => {
      if (playerRef.current && Math.abs(playerRef.current.currentTime - time) > 1) {
        isSocketAction.current = true;
        playerRef.current.currentTime = time;
      }
    };
    const handleReceiveVideoChange = (newUrl) => setVideoUrl(newUrl);
    const handleReceiveChatMessage = (message) => setMessages((prev) => [...prev, message]);
    const handleReceiveVideoState = (state) => {
        if (playerRef.current) {
            setVideoUrl(state.videoUrl);
            playerRef.current.currentTime = state.currentTime;
            if (state.isPlaying) {
                playerRef.current.play().catch(e => console.log("Autoplay bloqueado:", e));
            } else {
                playerRef.current.pause();
            }
        }
    };
    const handleUserUpdate = ({ users }) => setUsersInRoom(users);

    // --- Nos suscribimos a los eventos ---
    socket.on('receive-play', handleReceivePlay);
    socket.on('receive-pause', handleReceivePause);
    socket.on('receive-seek', handleReceiveSeek);
    socket.on('receive-video-change', handleReceiveVideoChange);
    socket.on('chat-message', handleReceiveChatMessage);
    socket.on('receive-video-state', handleReceiveVideoState);
    socket.on('user-joined', handleUserUpdate);
    socket.on('user-left', handleUserUpdate);

    // --- Limpieza de listeners ---
    return () => {
      socket.off('receive-play', handleReceivePlay);
      socket.off('receive-pause', handleReceivePause);
      socket.off('receive-seek', handleReceiveSeek);
      socket.off('receive-video-change', handleReceiveVideoChange);
      socket.off('chat-message', handleReceiveChatMessage);
      socket.off('receive-video-state', handleReceiveVideoState);
      socket.off('user-joined', handleUserUpdate);
      socket.off('user-left', handleUserUpdate);
    };
  }, [isInRoom, roomId, username]);

  // --- Funciones de control y de envío de eventos ---
  const handlePlay = () => {
    if (isSocketAction.current) { isSocketAction.current = false; return; }
    socket.emit('send-play', { roomId, currentTime: playerRef.current.currentTime });
  };
  const handlePause = () => {
    if (isSocketAction.current) { isSocketAction.current = false; return; }
    socket.emit('send-pause', { roomId, currentTime: playerRef.current.currentTime });
  };
  const handleSeeked = () => {
    if (isSocketAction.current) { isSocketAction.current = false; return; }
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
  const handleJoinRoom = () => {
    if (inputRoomId.trim() && inputUsername.trim()) {
      setRoomId(inputRoomId.trim());
      setUsername(inputUsername.trim());
      setIsInRoom(true);
    }
  };
  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyButtonText('¡Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Enlace'), 2000);
  };
  const leaveRoom = () => {
    window.location.reload();
  };
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --- Renderizado Condicional ---

  if (!isInRoom) {
    return (
      <>
        <AppStyles />
        <div className="join-modal-overlay">
          <div className="join-modal">
            <h2>Modixia Watch Party 🍿</h2>
            <p>Crea o únete a una sala para ver videos con tus amigos.</p>
            <div className="join-modal-inputs">
              <input 
                type="text" 
                placeholder="Nombre o código de la sala"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                className="generic-input"
              />
              <input 
                type="text" 
                placeholder="Tu nombre de usuario"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                className="generic-input"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            </div>
            <button 
              onClick={handleJoinRoom} 
              disabled={!inputRoomId.trim() || !inputUsername.trim()}>
              Unirse
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppStyles />
      <div className="App">
        <div className="video-section">
          <div className="header-and-input">
            <div className="header-section">
              <h1>Watch Party 🍿</h1>
              <p className="room-info">Sala: <b>{roomId}</b> | Usuario: <b>{username}</b></p>
            </div>
            <div className="video-input-container">
              <input 
                type="text" 
                placeholder="Pega la URL del video aquí"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChangeVideo()}
                className="generic-input"
              />
              <button onClick={handleChangeVideo}>Cambiar Video</button>
            </div>
          </div>
          <div className="video-wrapper">
            <video 
              ref={playerRef}
              controls
              src={videoUrl}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeeked}
            >
              Tu navegador no soporta el tag de video.
            </video>
          </div>
        </div>

        <div className="bottom-section">
            <div className="chat-section">
                <div className="chat-messages">
                    {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.isSystem ? 'system' : (msg.username === username ? 'me' : 'other')}`}>
                        {!msg.isSystem && <span className="username">{msg.username}</span>}
                        <span className="text">{msg.message}</span>
                        {!msg.isSystem && <span className="timestamp">{formatTimestamp(msg.timestamp)}</span>}
                    </div>
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
                    className="generic-input"
                    />
                    <button onClick={handleSendChatMessage}>Enviar</button>
                </div>
            </div>
            <div className="user-list-section">
                <h3>Conectados ({usersInRoom.length})</h3>
                <ul className="user-list">
                  {usersInRoom.map(user => (
                    <li key={user.id} className="user-list-item">{user.name}</li>
                  ))}
                </ul>
                <div className="control-buttons">
                    <button onClick={copyRoomLink} className={`copy-btn ${copyButtonText === '¡Copiado!' ? 'copied' : ''}`}>{copyButtonText}</button>
                    <button onClick={leaveRoom}>Salir</button>
                </div>
            </div>
        </div>
      </div>
    </>
  );
}

export default App;

