// server.js
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
});

app.get('/projector', (req, res) => {
  res.sendFile(path.join(__dirname, 'projector.html'));
});

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

let userCount = 0;
let eventStarted = false;

wss.on('connection', (ws, req) => {
  const pathname = req.url;

  if (pathname === '/ws/user') {
    userCount++;
    if (userCount > 2 && !eventStarted) {
      eventStarted = true;
    }
    broadcastStatus();

    ws.on('close', () => {
      userCount = Math.max(0, userCount - 1);
      broadcastStatus();
    });
  } else if (pathname === '/ws/projector') {
    ws.send(JSON.stringify({ userCount, eventStarted }));
  }
});

function broadcastStatus() {
  const data = JSON.stringify({ userCount, eventStarted });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}