// signaling-server.js
const WebSocket = require('ws');

// --- Configuration ---
const PORT = process.env.PORT || 3001; // Use environment variable for port or default to 3001

const wss = new WebSocket.Server({ port: PORT });

// --- State Management ---
let broadcasterWs = null; // Holds the WebSocket of the current broadcaster
const viewers = new Map(); // Stores viewer WebSockets, mapping ws to their generated viewerId

// Helper to generate unique string IDs for clients (broadcaster/viewers)
// In a production app, consider using UUIDs for more robustness.
const wsClientData = new Map(); // Maps WebSocket instance to its { id, type }
let nextId = 1;

function generateUniqueId(ws, type) {
  if (!wsClientData.has(ws)) {
    const id = String(nextId++);
    wsClientData.set(ws, { id: id, type: type });
    if (type === 'viewer') {
      ws.viewerId = id; // Attach viewerId directly for convenience in some cases
    } else if (type === 'broadcaster') {
      ws.broadcasterId = id; // Attach broadcasterId
    }
    return id;
  }
  return wsClientData.get(ws).id;
}

function getClientId(ws) {
    return wsClientData.has(ws) ? wsClientData.get(ws).id : null;
}

function getClientType(ws) {
    return wsClientData.has(ws) ? wsClientData.get(ws).type : null;
}


console.log(`StreamHub Signaling Server started on port ${PORT}`);

wss.on('connection', (ws) => {
  const newClientLogId = `Client (Temp ID ${nextId})`; // Log before permanent ID assigned
  console.log(`${newClientLogId}: Connected.`);

  ws.on('message', (messageBuffer) => {
    let parsedMessage;
    const clientId = getClientId(ws) || newClientLogId; // Use assigned ID if available

    try {
      parsedMessage = JSON.parse(messageBuffer.toString());
      console.log(`${clientId}: Received message:`, parsedMessage);
    } catch (e) {
      console.error(`${clientId}: Failed to parse message or message is not JSON:`, messageBuffer.toString(), e);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
      return;
    }

    switch (parsedMessage.type) {
      case 'broadcast_start':
        if (broadcasterWs) {
          console.log(`${clientId}: Attempted to start broadcast, but broadcaster already exists.`);
          ws.send(JSON.stringify({ type: 'error', message: 'Another user is already broadcasting.' }));
          return;
        }
        broadcasterWs = ws;
        const broadcasterId = generateUniqueId(ws, 'broadcaster');
        broadcasterWs.streamName = parsedMessage.streamName || `Stream from ${broadcasterId}`;
        console.log(`Broadcaster ${broadcasterId} registered with stream name: "${broadcasterWs.streamName}"`);
        ws.send(JSON.stringify({ type: 'broadcast_accepted', broadcasterId: broadcasterId }));

        // Notify existing viewers (if any connect before broadcaster fully establishes)
        viewers.forEach((viewer_id, viewerWs) => {
          viewerWs.send(JSON.stringify({
            type: 'broadcast_started',
            broadcasterId: broadcasterId,
            streamName: broadcasterWs.streamName
          }));
        });
        break;

      case 'watch_request':
        if (!broadcasterWs) {
          console.log(`${clientId}: Watch request failed, no active broadcaster.`);
          ws.send(JSON.stringify({ type: 'error', message: 'No active broadcast to watch.' }));
          return;
        }
        const viewerId = generateUniqueId(ws, 'viewer');
        viewers.set(ws, viewerId); // Add to viewers map
        console.log(`Viewer ${viewerId} registered to watch broadcaster ${getClientId(broadcasterWs)}.`);
        ws.send(JSON.stringify({ type: 'watch_accepted', viewerId: viewerId }));

        // Tell broadcaster to initiate an offer to this new viewer
        if (broadcasterWs.readyState === WebSocket.OPEN) {
          broadcasterWs.send(JSON.stringify({ type: 'initiate_offer', viewerId: viewerId }));
        }
        break;

      case 'offer': // From broadcaster to a specific viewer
        const targetViewerWsOffer = Array.from(viewers.keys()).find(vw => viewers.get(vw) === parsedMessage.viewerId);
        if (targetViewerWsOffer && targetViewerWsOffer.readyState === WebSocket.OPEN) {
          console.log(`Broadcaster ${getClientId(ws)}: Relaying offer to viewer ${parsedMessage.viewerId}`);
          targetViewerWsOffer.send(JSON.stringify({
            type: 'offer',
            sdp: parsedMessage.sdp,
            broadcasterId: getClientId(ws) // The broadcaster sending the offer
          }));
        } else {
          console.warn(`Broadcaster ${getClientId(ws)}: Could not relay offer. Target viewer ${parsedMessage.viewerId} not found or not open.`);
        }
        break;

      case 'answer': // From viewer to the broadcaster
        if (broadcasterWs && broadcasterWs.readyState === WebSocket.OPEN) {
          const viewerIdAnswer = getClientId(ws);
          console.log(`Viewer ${viewerIdAnswer}: Relaying answer to broadcaster ${getClientId(broadcasterWs)}.`);
          broadcasterWs.send(JSON.stringify({
            type: 'answer',
            sdp: parsedMessage.sdp,
            viewerId: viewerIdAnswer // The viewer sending the answer
          }));
        } else {
          console.warn(`Viewer ${getClientId(ws)}: Could not relay answer. Broadcaster not available.`);
        }
        break;

      case 'candidate': // ICE candidate from either party
        const senderIdCandidate = getClientId(ws);
        if (parsedMessage.target === 'broadcaster') { // Candidate for the broadcaster (from a viewer)
          if (broadcasterWs && broadcasterWs.readyState === WebSocket.OPEN) {
            console.log(`Viewer ${senderIdCandidate}: Relaying ICE candidate to broadcaster.`);
            broadcasterWs.send(JSON.stringify({
              type: 'candidate',
              candidate: parsedMessage.candidate,
              fromViewerId: senderIdCandidate
            }));
          }
        } else if (parsedMessage.target === 'viewer' && parsedMessage.targetId) { // Candidate for a specific viewer (from broadcaster)
          const targetViewerWsCandidate = Array.from(viewers.keys()).find(vw => viewers.get(vw) === parsedMessage.targetId);
          if (targetViewerWsCandidate && targetViewerWsCandidate.readyState === WebSocket.OPEN) {
            console.log(`Broadcaster ${senderIdCandidate}: Relaying ICE candidate to viewer ${parsedMessage.targetId}.`);
            targetViewerWsCandidate.send(JSON.stringify({
              type: 'candidate',
              candidate: parsedMessage.candidate,
              fromBroadcasterId: senderIdCandidate
            }));
          } else {
             console.warn(`Broadcaster ${senderIdCandidate}: Failed to relay ICE candidate. Target viewer ${parsedMessage.targetId} not found/open.`);
          }
        } else {
            console.warn(`${senderIdCandidate}: Invalid candidate message structure:`, parsedMessage);
        }
        break;

      case 'broadcast_stop':
        if (ws === broadcasterWs) {
          const broadcasterIdStop = getClientId(ws);
          console.log(`Broadcaster ${broadcasterIdStop}: Stopped stream.`);
          viewers.forEach((viewer_id, viewerWs) => {
            viewerWs.send(JSON.stringify({ type: 'broadcast_ended', broadcasterId: broadcasterIdStop }));
          });
          viewers.clear(); // Clear all viewers for this broadcast session
          broadcasterWs = null;
          wsClientData.delete(ws); // Clean up broadcaster data
        }
        break;

      default:
        console.log(`${clientId}: Received unknown message type:`, parsedMessage.type);
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${parsedMessage.type}` }));
    }
  });

  ws.on('close', (code, reason) => {
    const closedClientId = getClientId(ws);
    const closedClientType = getClientType(ws);
    console.log(`${closedClientType || 'Client'} ${closedClientId || newClientLogId}: Disconnected (Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}).`);

    if (ws === broadcasterWs) {
      console.log(`Broadcaster ${closedClientId} disconnected. Notifying viewers.`);
      broadcasterWs = null;
      viewers.forEach((viewer_id, viewerWs) => {
        viewerWs.send(JSON.stringify({ type: 'broadcast_ended', broadcasterId: closedClientId }));
      });
      viewers.clear();
    } else if (viewers.has(ws)) {
      const viewerIdLeft = viewers.get(ws);
      viewers.delete(ws);
      console.log(`Viewer ${viewerIdLeft} disconnected.`);
      if (broadcasterWs && broadcasterWs.readyState === WebSocket.OPEN) {
        broadcasterWs.send(JSON.stringify({ type: 'viewer_left', viewerId: viewerIdLeft }));
      }
    }
    wsClientData.delete(ws); // Clean up data for the disconnected client
  });

  ws.on('error', (error) => {
    const errorClientId = getClientId(ws) || newClientLogId;
    console.error(`WebSocket error for ${getClientType(ws) || 'Client'} ${errorClientId}:`, error);
    // Consider 'close' event will likely follow, handling cleanup there.
  });
});

process.on('SIGINT', () => {
    console.log('Server shutting down...');
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'error', message: 'Server is shutting down.' }));
        client.close();
    });
    wss.close(() => {
        console.log('WebSocket server closed.');
        process.exit(0);
    });
});