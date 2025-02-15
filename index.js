// server.js
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const EVENT_THRESHOLD = process.env.THRESHOLD || 50;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

// Initialize state
let state = {
  userCount: 0,
  eventStarted: false,
  startTime: null,
  threshold: EVENT_THRESHOLD
};

app.use(express.static(path.join(__dirname, 'public')));

// Configure Express
app.use(express.json());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'user.html')));
app.get('/projector', (req, res) => res.sendFile(path.join(__dirname, 'projector.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const pathname = req.url;

  switch(pathname) {
    case '/ws/user':
      handleUserConnection(ws);
      break;
      
    case '/ws/projector':
      handleProjectorConnection(ws);
      break;
      
    case '/ws/admin':
      handleAdminConnection(ws);
      break;
  }
});

function handleUserConnection(ws) {
  state.userCount++;
  checkThreshold();
  broadcastStatus();

  ws.on('close', () => {
    state.userCount = Math.max(0, state.userCount - 1);
    checkThreshold();
    broadcastStatus();
  });
}

function handleProjectorConnection(ws) {
  ws.send(JSON.stringify(getStateData()));
}

function handleAdminConnection(ws) {
  ws.on('message', (message) => {
    try {
      const { action, pin, value } = JSON.parse(message);
      
      // Verify PIN first
      if (pin !== ADMIN_PIN) {
        ws.send(JSON.stringify({ error: 'Invalid PIN' }));
        return;
      }
      
      // Handle actions
      switch(action) {
        case 'start':
          state.eventStarted = true;
          state.startTime = Date.now();
          ws.send(JSON.stringify({ success: 'Event started manually' }));
          break;
          
        case 'reset':
          state.eventStarted = false;
          state.userCount = 0;
          state.startTime = null;
          ws.send(JSON.stringify({ success: 'System reset successfully' }));
          break;
          
        case 'setThreshold':
          const newThreshold = Math.max(1, parseInt(value));
          if (isNaN(newThreshold)) {
            ws.send(JSON.stringify({ error: 'Invalid threshold value' }));
          } else {
            state.threshold = newThreshold;
            ws.send(JSON.stringify({ 
              success: `Threshold updated to ${newThreshold}` 
            }));
          }
          break;
          
        default:
          ws.send(JSON.stringify({ error: 'Invalid action' }));
      }
      
      broadcastStatus();
    } catch(e) {
      console.error('Admin error:', e);
      ws.send(JSON.stringify({ error: 'Invalid command format' }));
    }
  });
}

function checkThreshold() {
  if (!state.eventStarted && state.userCount >= state.threshold) {
    state.eventStarted = true;
    state.startTime = Date.now();
  }
}

function getStateData() {
  return {
      ...state,
      timeRemaining: state.eventStarted
          ? Math.max(0, 129600 - Math.floor((Date.now() - state.startTime) / 1000))
          : null
  };
}

function broadcastStatus() {
  const data = JSON.stringify(getStateData());
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}