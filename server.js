const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : '*' },
  maxHttpBufferSize: 1e5
});
const PORT = Number(process.env.PORT || 3000);
const players = new Map();
const MAX_PLAYERS = 24;
app.use(express.static(path.join(__dirname)));
app.get('/health', (_req, res) => res.json({ ok: true, players: players.size }));
app.get('/api/status', (_req, res) => res.json({ game: 'Browser Arena', players: players.size, maxPlayers: MAX_PLAYERS }));

function cleanName(value) {
  return String(value || 'Player').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 18) || 'Player';
}
function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-45, Math.min(45, n)) : fallback;
}
function broadcastState() {
  io.emit('state', { players: [...players.entries()].map(([id, p]) => ({ id, name: p.name, x: p.x, z: p.z, yaw: p.yaw })) });
}
io.on('connection', socket => {
  if (players.size >= MAX_PLAYERS) {
    socket.emit('notice', 'Room is full. Try again later.');
    socket.disconnect(true);
    return;
  }
  socket.on('join', data => {
    const p = players.get(socket.id);
    if (!p) return;
    p.name = cleanName(data?.name);
    socket.emit('notice', 'Welcome to Browser Arena, ' + p.name + '!');
    broadcastState();
  });
  players.set(socket.id, { name: 'Player', x: 0, z: 8, yaw: 0, lastMove: 0 });
  socket.on('move', data => {
    const p = players.get(socket.id);
    if (!p || !data || Date.now() - p.lastMove < 30) return;
    p.lastMove = Date.now();
    p.x = finiteNumber(data.x);
    p.z = finiteNumber(data.z);
    p.yaw = Math.max(-Math.PI, Math.min(Math.PI, Number(data.yaw) || 0));
    broadcastState();
  });
  socket.on('shot', data => {
    const p = players.get(socket.id);
    if (!p || !data) return;
    // Visual event only; authoritative hit validation is a future server-side improvement.
    socket.broadcast.emit('playerShot', { id: socket.id, x: finiteNumber(data.x), z: finiteNumber(data.z) });
  });
  socket.on('shoot', () => {
    // Do not accept client-reported kills or damage; server-authoritative combat is a next step.
  });
  socket.on('disconnect', () => {
    players.delete(socket.id);
    broadcastState();
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Browser Arena listening on port ${PORT}`));
