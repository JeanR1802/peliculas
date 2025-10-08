import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Conectamos con nuestro servidor. ¡RECUERDA CAMBIAR ESTO POR LA URL DE RENDER EN PRODUCCIÓN!
// const socket = io.connect("http://localhost:3001"); // Para desarrollo local
const socket = io.connect("https://modixia-watch-party-server.onrender.com"); // ¡Cambia esta URL por la de tu servidor en Render!

// --- Estilos CSS (con añadidos para el panel de admin) ---
const AppStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');
    :root {
      --bg-color: #1a1d24; --card-bg-color: #22272e; --text-color: #e0e0e0;
      --secondary-text-color: #8b949e; --primary-accent: #3392ff; --primary-accent-hover: #58a6ff;
      --border-color: #30363d; --chat-bg: #2d333b; --system-message-color: #79c0ff;
      --success-color: #28a745; --danger-color: #da3633;
    }
    body {
      margin: 0; font-family: 'Poppins', sans-serif; -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale; background-color: var(--bg-color);
      color: var(--text-color); line-height: 1.6; overflow: hidden;
    }
    .App {
      display: flex; flex-direction: column; width: 100vw; background-color: var(--bg-color);
    }
    .video-section {
      flex: 1; display: flex; flex-direction: column; padding: 15px 20px 10px 20px;
      box-sizing: border-box; overflow: hidden; gap: 15px;
    }
    .header-and-input { display: flex; flex-direction: column; align-items: center; gap: 15px; flex-shrink: 0; }
    .header-section { text-align: center; margin-bottom: 0; }
    h1 { font-size: 1.5rem; margin: 0; }
    .room-info { font-size: 0.9rem; margin: 0; }
    .room-info b { color: var(--primary-accent); font-weight: 600; }
    .video-input-container { display: flex; gap: 10px; width: 100%; max-width: 800px; }
    .video-wrapper {
        flex-grow: 1; background-color: black; border-radius: 10px; display: flex;
        align-items: center; justify-content: center; min-height: 0;
    }
    video { max-width: 100%; max-height: 100%; object-fit: contain; }
    .bottom-section {
      height: 40vh; flex-shrink: 0; display: flex; background-color: var(--card-bg-color);
      border-top: 2px solid var(--border-color);
    }
    .chat-section {
      flex-grow: 1; display: flex; flex-direction: column; padding: 15px;
      box-sizing: border-box; border-right: 1px solid var(--border-color); min-width: 0;
    }
    .chat-messages {
      flex-grow: 1; overflow-y: auto; margin-bottom: 15px; padding-right: 10px;
      display: flex; flex-direction: column; min-height: 0;
    }
    .chat-messages::-webkit-scrollbar { width: 8px; }
    .chat-messages::-webkit-scrollbar-track { background: var(--chat-bg); border-radius: 10px; }
    .chat-messages::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
    .chat-messages::-webkit-scrollbar-thumb:hover { background: var(--secondary-text-color); }
    .chat-message { 
      padding: 8px 12px; border-radius: 12px; margin-bottom: 8px; 
      word-wrap: break-word; max-width: 70%; display: flex; flex-direction: column;
    }
    .chat-message.system { 
      color: var(--system-message-color); font-style: italic; text-align: center; font-size: 0.9em;
      background: none; align-self: center; max-width: 90%; word-break: break-all;
    }
    .chat-message.me { background-color: var(--primary-accent); color: white; align-self: flex-end; }
    .chat-message.other { background-color: var(--chat-bg); align-self: flex-start; }
    .chat-message .username { font-weight: 600; margin-bottom: 3px; font-size: 0.9em; }
    .chat-message.me .username { color: #f0f0f0; }
    .chat-message.other .username { color: var(--primary-accent-hover); }
    .timestamp { font-size: 0.75em; color: var(--secondary-text-color); text-align: right; margin-top: 4px; }
    .chat-message.me .timestamp { color: rgba(255, 255, 255, 0.7); }
    .chat-input-container { display: flex; gap: 10px; }
    .user-list-section {
      width: 250px; padding: 15px; box-sizing: border-box; display: flex;
      flex-direction: column; flex-shrink: 0;
    }
    .user-list-section h3 { margin: 0 0 15px 0; text-align: center; color: var(--secondary-text-color); }
    .user-list { list-style-type: none; padding: 0; margin: 0; overflow-y: auto; }
    .user-list-item { padding: 8px; border-radius: 5px; margin-bottom: 5px; color: var(--text-color); }
    .user-list-item::before { content: '●'; color: var(--success-color); margin-right: 10px; }
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
    .control-buttons { display: flex; gap: 10px; margin-top: auto; }
    .copy-btn.copied { background-color: var(--success-color); }
    .modal-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center;
        align-items: center; z-index: 1000; backdrop-filter: blur(5px);
    }
    .modal-content {
        background-color: var(--card-bg-color); padding: 30px; border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); text-align: center;
        width: 90%; max-width: 450px; animation: fadeIn 0.3s ease-out;
    }
    .modal-content h2 { color: var(--text-color); margin-bottom: 10px; font-size: 2rem; }
    .modal-content p { color: var(--secondary-text-color); margin-bottom: 25px; }
    .modal-inputs { display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px; }
    .lobby-container {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        width: 100%; height: 100vh; padding: 20px; box-sizing: border-box;
    }
    .lobby-header { text-align: center; margin-bottom: 40px; position: relative; width: 100%; max-width: 1000px; }
    .admin-button {
      position: absolute; top: 0; right: 0; background: none; border: none;
      cursor: pointer; padding: 10px;
    }
    .admin-button svg { width: 24px; height: 24px; fill: var(--secondary-text-color); transition: fill 0.2s ease; }
    .admin-button:hover svg { fill: var(--primary-accent); }
    .room-selection-container {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px; width: 100%; max-width: 1000px;
    }
    .room-card {
        background-color: var(--card-bg-color); padding: 20px; border-radius: 10px;
        text-align: center; cursor: pointer; border: 2px solid var(--border-color);
        transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .room-card:hover { transform: translateY(-5px); border-color: var(--primary-accent); }
    .room-card h3 { margin: 0 0 10px 0; color: var(--primary-accent); }
    .room-card p { margin: 0; color: var(--secondary-text-color); }
    .modal-inputs label { font-size: 0.9rem; text-align: left; color: var(--secondary-text-color); }
    .modal-inputs select { width: 100%; }
    .admin-error-message { color: var(--danger-color); margin-top: 15px; min-height: 20px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    .header-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 10px;
    }
    .admin-button, .stats-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 10px;
      border-radius: 50%;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .admin-button:hover, .stats-button:hover {
      background: var(--border-color);
    }
    .stats-button svg { width: 24px; height: 24px; fill: var(--primary-accent); }
    .admin-button svg { width: 24px; height: 24px; fill: var(--secondary-text-color); }
    @media (max-width: 768px) {
      .header-buttons { justify-content: center; gap: 18px; }
      .admin-button, .stats-button { padding: 8px; }
    }
    .modal-content.admin-modal-content {
      max-width: 340px;
      min-width: 220px;
      width: 90vw;
      padding: 24px 18px 18px 18px;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      position: fixed;
      background: var(--background-color);
      border-radius: 12px;
      box-shadow: 0 2px 16px #0008;
      z-index: 1002;
      overflow-y: auto;
      max-height: 90vh;
    }
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.45);
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-inputs label {
      margin-top: 10px;
      font-size: 0.95em;
      color: var(--secondary-text-color);
    }
    .modal-inputs input, .modal-inputs select {
      width: 100%;
      margin-bottom: 8px;
      padding: 7px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--background-color);
      color: var(--primary-text-color);
    }
    .admin-error-message { color: #e74c3c; font-size: 0.95em; text-align: center; margin: 8px 0; }
    @media (max-width: 768px) {
        .user-list-section { display: none; } .chat-section { border-right: none; }
        h1 { font-size: 1.2rem; }
        .header-buttons { justify-content: center; gap: 18px; }
        .admin-button, .stats-button { padding: 8px; }
    }
    .admin-sidebar-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.45);
      z-index: 1001;
      display: flex;
      align-items: stretch;
      justify-content: flex-end;
    }
    .admin-sidebar {
      width: 340px;
      max-width: 95vw;
      background: var(--background-color);
      height: 100vh;
      box-shadow: -2px 0 16px #0008;
      display: flex;
      flex-direction: column;
      padding: 0 0 0 0;
      position: relative;
      animation: slideInSidebar 0.2s;
    }
    @keyframes slideInSidebar {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    .admin-sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 18px 0 18px;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 2rem;
      color: var(--secondary-text-color);
      cursor: pointer;
      margin-left: 10px;
    }
    .admin-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      margin: 0 18px;
    }
    .admin-tabs button {
      flex: 1;
      background: none;
      border: none;
      padding: 12px 0;
      font-size: 1.05em;
      cursor: pointer;
      color: var(--secondary-text-color);
      border-bottom: 2px solid transparent;
      transition: border 0.2s, color 0.2s;
    }
    .admin-tabs button.active {
      color: var(--primary-accent);
      border-bottom: 2px solid var(--primary-accent);
      font-weight: bold;
    }
    .admin-tab-content {
      padding: 18px;
      flex: 1;
      overflow-y: auto;
    }
    .loading-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--bg-color);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 2000;
      transition: opacity 0.5s ease;
    }
    .loading-spinner {
      border: 4px solid var(--border-color);
      border-top: 4px solid var(--primary-accent);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    .loading-text {
      color: var(--secondary-text-color);
      font-size: 1.2rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @media (max-width: 600px) {
      .admin-sidebar { width: 100vw; max-width: 100vw; }
      .admin-sidebar-header { padding: 12px 10px 0 10px; }
      .admin-tabs { margin: 0 10px; }
      .admin-tab-content { padding: 10px; }
    }
  `}</style>
);

// --- Componente de la Pantalla de Carga ---
const LoadingScreen = () => (
  <div className="loading-overlay">
    <div className="loading-spinner"></div>
    <p className="loading-text">Despertando el servidor, por favor espera...</p>
  </div>
);

// --- Componente de la Sidebar de Administración ---
const AdminSidebar = ({
  predefinedRooms,
  adminSelectedRoomId, setAdminSelectedRoomId,
  adminNewMovie, setAdminNewMovie,
  adminNewUrl, setAdminNewUrl,
  adminPassword, setAdminPassword,
  adminError,
  handleAdminUpdate,
  setIsAdminPanelOpen
}) => {
  const [activeTab, setActiveTab] = useState('salas');
  const [roomStatus, setRoomStatus] = useState({});
  const [statusError, setStatusError] = useState('');
  const [backendStatus, setBackendStatus] = useState('Desconocido');
  const [statsPassword, setStatsPassword] = useState('');
  const [statsPasswordOk, setStatsPasswordOk] = useState(false);
  const intervalRef = useRef(null);

  // Efecto para auto-rellenar los campos cuando se cambia de sala
  useEffect(() => {
    if (predefinedRooms && predefinedRooms[adminSelectedRoomId]) {
      const room = predefinedRooms[adminSelectedRoomId];
      setAdminNewMovie(room.movie || '');
      setAdminNewUrl(room.videoUrl || '');
    }
  }, [adminSelectedRoomId, predefinedRooms, setAdminNewMovie, setAdminNewUrl]);

  useEffect(() => {
    if (activeTab !== 'estadisticas' || !statsPasswordOk) return;
    let isMounted = true;
    function fetchStatus() {
      fetch('/ping').then(() => setBackendStatus('Despierto')).catch(() => setBackendStatus('Dormido/Desconectado'));
      try {
        socket.emit('admin-request-room-status', statsPassword);
      } catch (e) {
        setStatusError('No se pudo conectar con el servidor.');
      }
    }
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 5000);
    function handleStatus(data) {
      if (!isMounted) return;
      if (data.error) setStatusError(data.error);
      else { setRoomStatus(data); setStatusError(''); }
    }
    socket.on('admin-room-status', handleStatus);
    return () => {
      isMounted = false;
      clearInterval(intervalRef.current);
      socket.off('admin-room-status', handleStatus);
    };
  }, [activeTab, statsPassword, statsPasswordOk]);

  return (
    <div className="admin-sidebar-overlay">
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>Administración</h2>
          <button className="close-btn" onClick={() => setIsAdminPanelOpen(false)}>&times;</button>
        </div>
        <div className="admin-tabs">
          <button className={activeTab === 'estadisticas' ? 'active' : ''} onClick={() => setActiveTab('estadisticas')}>Estadísticas</button>
          <button className={activeTab === 'salas' ? 'active' : ''} onClick={() => setActiveTab('salas')}>Salas</button>
        </div>
        <div className="admin-tab-content">
          {activeTab === 'estadisticas' ? (
            !statsPasswordOk ? (
              <div style={{marginBottom: 20}}>
                <input type="password" className="generic-input" placeholder="Contraseña de admin" value={statsPassword} onChange={e => setStatsPassword(e.target.value)} />
                <button style={{marginTop:10}} onClick={() => setStatsPasswordOk(true)}>Ver estadísticas</button>
              </div>
            ) : statusError && statusError.includes('Contraseña') ? (
              <div style={{color:'red', marginBottom: 20}}>{statusError}<br/><button onClick={()=>{setStatsPasswordOk(false);setStatsPassword('');}}>Reintentar</button></div>
            ) : (
              <div style={{maxHeight: '60vh', overflowY: 'auto'}}>
                <div style={{marginBottom: 10}}>Estado del backend: <b style={{color: backendStatus === 'Despierto' ? 'green' : 'red'}}>{backendStatus}</b></div>
                {Object.entries(roomStatus).map(([id, status]) => (
                  <div key={id} style={{border: '1px solid #444', borderRadius: 8, margin: '10px 0', padding: 10}}>
                    <b>{status.name}</b> <span style={{color:'#888'}}>({id})</span><br/>
                    Película: <b>{status.movie}</b><br/>
                    Usuarios conectados: {status.users.length > 0 ? status.users.map(u => u.name).join(', ') : 'Ninguno'}<br/>
                    Tiempo actual: {status.videoState.currentTime ? status.videoState.currentTime.toFixed(1) + 's' : '0s'}<br/>
                    Estado: {status.videoState.isPlaying ? 'Reproduciendo' : 'Pausado'}<br/>
                    Último en pausar: {status.lastPausedBy || 'Nadie'}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="modal-inputs">
              <label>Sala:</label>
              <select value={adminSelectedRoomId} onChange={e => setAdminSelectedRoomId(e.target.value)}>
                {Object.entries(predefinedRooms).map(([roomId, room]) => (
                  <option key={roomId} value={roomId}>{room.name}</option>
                ))}
              </select>
              <label>Nombre de la película:</label>
              <input type="text" className="generic-input" placeholder="(Vacío)" value={adminNewMovie} onChange={e => setAdminNewMovie(e.target.value)} />
              <label>Link de la película:</label>
              <input type="text" className="generic-input" placeholder="(Vacío)" value={adminNewUrl} onChange={e => setAdminNewUrl(e.target.value)} />
              <label>Contraseña de admin:</label>
              <input type="password" className="generic-input" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
              <p className="admin-error-message">{adminError}</p>
              <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: 10}}>
                <button onClick={handleAdminUpdate}>Guardar</button>
                <button onClick={() => setIsAdminPanelOpen(false)} style={{backgroundColor: 'var(--secondary-text-color)'}}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente principal
function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [predefinedRooms, setPredefinedRooms] = useState({});
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [username, setUsername] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  
  const [videoUrl, setVideoUrl] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [usersInRoom, setUsersInRoom] = useState([]);
  const [copyButtonText, setCopyButtonText] = useState('Copiar Enlace');
  const [appHeight, setAppHeight] = useState('100vh');
  
  // Estados para el panel de admin
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminSelectedRoomId, setAdminSelectedRoomId] = useState('sala-1');
  const [adminNewMovie, setAdminNewMovie] = useState('');
  const [adminNewUrl, setAdminNewUrl] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [backendStatus, setBackendStatus] = useState(''); // <-- AÑADIDO PARA JEAN
  
  const playerRef = useRef(null);
  const isSocketAction = useRef(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // --- Heartbeat para mantener el servidor de Render despierto ---
  useEffect(() => {
    const backendUrl = "https://modixia-watch-party-server.onrender.com/ping";
    
    const keepAlive = () => {
      fetch(backendUrl)
        .then(res => {
          if (res.ok) {
            console.log("Ping al servidor exitoso.");
          } else {
            console.error("Ping al servidor falló con status:", res.status);
          }
        })
        .catch(err => {
          console.error("Error en el ping al servidor:", err);
        });
    };

    const keepAliveInterval = setInterval(keepAlive, 4 * 60 * 1000); // Ping cada 4 minutos

    // Limpieza al desmontar el componente
    return () => {
      clearInterval(keepAliveInterval);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setAppHeight(`${window.innerHeight}px`);
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleInitialData = (rooms) => {
      setPredefinedRooms(rooms);
      setIsLoading(false);
    };

    socket.on('initial-lobby-data', handleInitialData);
    socket.on('update-lobby-data', (rooms) => setPredefinedRooms(rooms));
    socket.on('admin-error', (errorMessage) => setAdminError(errorMessage));
    
    return () => {
      socket.off('initial-lobby-data', handleInitialData);
      socket.off('update-lobby-data');
      socket.off('admin-error');
    };
  }, []);

  // <-- AÑADIDO PARA JEAN
  useEffect(() => {
    const handleStatusPing = (message) => {
      setBackendStatus(message);
    };
    socket.on('backend-status-ping', handleStatusPing);
    return () => {
      socket.off('backend-status-ping', handleStatusPing);
    };
  }, []);

  useEffect(() => {
    if (!isInRoom) return;

    socket.emit('join-room', { roomId: selectedRoom.id, username });
    const pingInterval = setInterval(() => socket.emit('ping'), 5 * 60 * 1000);

    const handleReceivePlay = (currentTime) => {
      if (playerRef.current && playerRef.current.paused) { isSocketAction.current = true; playerRef.current.currentTime = currentTime; playerRef.current.play(); }
    };
    const handleReceivePause = (currentTime) => {
      if (playerRef.current && !playerRef.current.paused) { isSocketAction.current = true; playerRef.current.currentTime = currentTime; playerRef.current.pause(); }
    };
    const handleReceiveSeek = (time) => {
      if (playerRef.current && Math.abs(playerRef.current.currentTime - time) > 1) { isSocketAction.current = true; playerRef.current.currentTime = time; }
    };
    const handleReceiveVideoChange = (newUrl) => setVideoUrl(newUrl);
    const handleReceiveChatMessage = (message) => setMessages((prev) => [...prev, message]);
    const handleReceiveVideoState = (state) => {
      if (playerRef.current) {
        setVideoUrl(state.videoUrl);
        playerRef.current.currentTime = state.currentTime;
        if (state.isPlaying) { playerRef.current.play().catch(e => console.log("Autoplay bloqueado:", e)); } 
        else { playerRef.current.pause(); }
      }
    };
    const handleUserUpdate = ({ users }) => setUsersInRoom(users);

    socket.on('receive-play', handleReceivePlay);
    socket.on('receive-pause', handleReceivePause);
    socket.on('receive-seek', handleReceiveSeek);
    socket.on('receive-video-change', handleReceiveVideoChange);
    socket.on('chat-message', handleReceiveChatMessage);
    socket.on('receive-video-state', handleReceiveVideoState);
    socket.on('user-joined', handleUserUpdate);
    socket.on('user-left', handleUserUpdate);

    return () => {
      clearInterval(pingInterval);
      socket.off('receive-play'); socket.off('receive-pause'); socket.off('receive-seek');
      socket.off('receive-video-change'); socket.off('chat-message'); socket.off('receive-video-state');
      socket.off('user-joined'); socket.off('user-left');
    };
  }, [isInRoom, selectedRoom, username]);

  const handlePlay = () => { if (!isSocketAction.current) { socket.emit('send-play', { roomId: selectedRoom.id, currentTime: playerRef.current.currentTime }); } isSocketAction.current = false; };
  const handlePause = () => { if (!isSocketAction.current) { socket.emit('send-pause', { roomId: selectedRoom.id, currentTime: playerRef.current.currentTime }); } isSocketAction.current = false; };
  const handleSeeked = () => { if (!isSocketAction.current) { socket.emit('send-seek', { roomId: selectedRoom.id, time: playerRef.current.currentTime }); } isSocketAction.current = false; };
  const handleSendChatMessage = () => { if (chatInput.trim()) { socket.emit('send-chat-message', { roomId: selectedRoom.id, username, message: chatInput }); setChatInput(''); } };
  const handleJoinRoom = () => { if (inputUsername.trim()) { setUsername(inputUsername.trim()); setIsInRoom(true); } };
  const copyRoomLink = () => { navigator.clipboard.writeText(window.location.href); setCopyButtonText('¡Copiado!'); setTimeout(() => setCopyButtonText('Copiar Enlace'), 2000); };
  const leaveRoom = () => window.location.reload();
  const formatTimestamp = (timestamp) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const handleAdminUpdate = () => {
    setAdminError('');
    if (!adminPassword) {
        setAdminError('La contraseña es requerida.');
        return;
    }
    socket.emit('admin-update-room', {
        roomId: adminSelectedRoomId,
        newMovie: adminNewMovie,
        newUrl: adminNewUrl,
        adminPassword: adminPassword,
    });
  };

  // --- Renderizado Condicional ---
  if (isLoading) {
    return (
      <>
        <AppStyles />
        <LoadingScreen />
      </>
    );
  }

  if (!selectedRoom) {
    return (
      <>
        <AppStyles />
        {isAdminPanelOpen && <AdminSidebar
            predefinedRooms={predefinedRooms}
            adminSelectedRoomId={adminSelectedRoomId}
            setAdminSelectedRoomId={setAdminSelectedRoomId}
            adminNewMovie={adminNewMovie}
            setAdminNewMovie={setAdminNewMovie}
            adminNewUrl={adminNewUrl}
            setAdminNewUrl={setAdminNewUrl}
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            adminError={adminError}
            handleAdminUpdate={handleAdminUpdate}
            setIsAdminPanelOpen={setIsAdminPanelOpen}
        />}
        <div className="lobby-container">
            <div className="lobby-header">
                <div className="header-buttons">
                  <button className="admin-button" onClick={() => setIsAdminPanelOpen(true)} title="Configuración">
                    <svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.2,5.77C8.61,6.01,8.08,6.33,7.58,6.71L5.19,5.75C4.97,5.68,4.72,5.75,4.6,5.97L2.68,9.29 c-0.11,0.2-0.06,0.47,0.12,0.61l2.03,1.58C4.78,11.69,4.76,12,4.76,12.31c0,0.31,0.02,0.62,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48-0.41l0.36-2.54c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0.01,0.59-0.22l1.92-3.32c0.11-0.2,0.06-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
                  </button>
                </div>
                <h1>Bienvenido al Cine Virtual 🍿</h1>
                <p>Selecciona una sala para entrar</p>
            </div>
            <div className="room-selection-container">
                {Object.entries(predefinedRooms).map(([id, room]) => (
                    <div key={id} className="room-card" onClick={() => setSelectedRoom({id, ...room})}>
                        <h3>{room.name}</h3>
                        <p>{room.movie || '(Vacía)'}</p>
                    </div>
                ))}
            </div>
        </div>
      </>
    );
  }

  if (!isInRoom) {
    return (
      <>
        <AppStyles />
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Entrando a {selectedRoom.name}</h2>
            <p>Por favor, introduce tu nombre de usuario para continuar.</p>
            <div className="modal-inputs">
              <input 
                type="text" 
                placeholder="Tu nombre de usuario"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                className="generic-input"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            </div>
            <button onClick={handleJoinRoom} disabled={!inputUsername.trim()}>Entrar</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppStyles />
      {/* AÑADIDO PARA JEAN */}
      {username.toLowerCase() === 'jean' && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#00FF00',
          padding: '5px 10px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '14px',
          zIndex: 1000
        }}>
          {backendStatus}
        </div>
      )}
      <div className="App" style={{ height: appHeight }}>
        <div className="video-section">
          <div className="header-and-input">
            <div className="header-section">
              <h1>{selectedRoom.name}</h1>
              <p className="room-info">Película: <b>{selectedRoom.movie}</b> | Usuario: <b>{username}</b></p>
            </div>
          </div>
          <div className="video-wrapper">
            <video ref={playerRef} controls src={videoUrl} onPlay={handlePlay} onPause={handlePause} onSeeked={handleSeeked} />
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
                    <input type="text" placeholder="Escribe un mensaje..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()} className="generic-input"/>
                    <button onClick={handleSendChatMessage}>Enviar</button>
                </div>
            </div>
            <div className="user-list-section">
                <h3>Conectados ({usersInRoom.length})</h3>
                <ul className="user-list">
                  {usersInRoom.map(user => (<li key={user.id} className="user-list-item">{user.name}</li>))}
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