const { v4: uuidv4 } = require('uuid');

// Map<clientId, { res, connectedAt }>
const clients = new Map();

function addClient(res) {
  const clientId = uuidv4();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial retry interval
  res.write('retry: 3000\n\n');

  clients.set(clientId, { res, connectedAt: Date.now() });
  console.log(`[${new Date().toISOString()}] SSE client connected: ${clientId} (total: ${clients.size})`);

  // Broadcast updated online count
  broadcastOnlineCount();

  // Handle disconnect
  res.on('close', () => {
    clients.delete(clientId);
    console.log(`[${new Date().toISOString()}] SSE client disconnected: ${clientId} (total: ${clients.size})`);
    broadcastOnlineCount();
  });

  return clientId;
}

function sendEvent(res, event, data) {
  try {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\ndata: ${payload}\n\n`);
  } catch (e) {
    // Client disconnected, ignore
  }
}

function broadcast(event, data) {
  for (const [clientId, client] of clients) {
    try {
      sendEvent(client.res, event, data);
    } catch (e) {
      clients.delete(clientId);
    }
  }
}

function broadcastNewMessage(message) {
  broadcast('message:new', message);
}

function broadcastToken(id, token) {
  broadcast('message:token', { id, token });
}

function broadcastComplete(id, alice_response, alice_image) {
  broadcast('message:complete', { id, alice_response, alice_image: alice_image || null });
}

function broadcastOnlineCount() {
  broadcast('online:count', { count: clients.size });
}

function broadcastNameUpdate(messageId, senderName) {
  broadcast('message:name', { id: messageId, sender_name: senderName });
}

function getOnlineCount() {
  return clients.size;
}

// Heartbeat every 15 seconds
let heartbeatInterval = null;

function startHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    broadcast('heartbeat', { ts: Date.now() });
  }, 15000);
  console.log(`[${new Date().toISOString()}] SSE heartbeat started (15s interval)`);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

module.exports = {
  addClient,
  broadcast,
  broadcastNewMessage,
  broadcastToken,
  broadcastComplete,
  broadcastNameUpdate,
  broadcastOnlineCount,
  getOnlineCount,
  startHeartbeat,
  stopHeartbeat
};
