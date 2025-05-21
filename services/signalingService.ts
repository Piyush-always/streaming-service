import { SignalMessage, ClientSignalMessage } from '../types';

// IMPORTANT: Replace with your server's actual WebSocket URL
// For local development with the Node.js server on port 3001:
const SIGNALING_SERVER_URL = 'ws://localhost:3001'; 
// For deployment, use wss://your-domain.com/signaling (if using a reverse proxy with SSL)
// or ws://your-server-ip:port

let socket: WebSocket | null = null;
let onMessageCallback: ((message: SignalMessage) => void) | null = null;
let onOpenCallback: (() => void) | null = null;
let onCloseCallback: ((event: CloseEvent) => void) | null = null;
let onErrorCallback: ((event: Event) => void) | null = null;

const connect = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('Signaling: Already connected.');
      resolve();
      return;
    }
    if (socket && socket.readyState === WebSocket.CONNECTING) {
        console.log('Signaling: Connection attempt in progress.');
        // You might want to queue this promise or handle it differently
        // For now, let it try to connect, but a more robust solution would manage multiple calls to connect()
        return;
    }


    console.log(`Signaling: Attempting to connect to ${SIGNALING_SERVER_URL}`);
    socket = new WebSocket(SIGNALING_SERVER_URL);

    socket.onopen = () => {
      console.log('Signaling: Connected to server');
      if (onOpenCallback) onOpenCallback();
      resolve();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as SignalMessage;
        console.log('Signaling: Received message:', message);
        if (onMessageCallback) {
          onMessageCallback(message);
        }
      } catch (error) {
        console.error('Signaling: Error parsing message from server:', event.data, error);
      }
    };

    socket.onerror = (event) => {
      console.error('Signaling: WebSocket error:', event);
      if (onErrorCallback) onErrorCallback(event);
      if (socket && socket.readyState !== WebSocket.OPEN) { // Only reject if not already open
        reject(new Error('WebSocket connection error.'));
      }
    };

    socket.onclose = (event) => {
      console.log(`Signaling: Disconnected from server (Code: ${event.code}, Reason: ${event.reason}, WasClean: ${event.wasClean})`);
      socket = null; // Important to allow reconnect
      if (onCloseCallback) onCloseCallback(event);
    };
  });
};

const sendMessage = (message: ClientSignalMessage) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('Signaling: Sending message:', message);
    socket.send(JSON.stringify(message));
  } else {
    console.error('Signaling: WebSocket not connected. Cannot send message:', message);
    // Optionally, queue the message or attempt to reconnect
  }
};

const close = () => {
  if (socket) {
    console.log('Signaling: Closing WebSocket connection.');
    socket.onclose = null; // Prevent onCloseCallback from firing during manual close if not desired
    socket.close();
    socket = null;
  }
};

const setOnMessage = (callback: (message: SignalMessage) => void) => {
  onMessageCallback = callback;
};

const setOnOpen = (callback: () => void) => {
  onOpenCallback = callback;
};
const setOnClose = (callback: (event: CloseEvent) => void) => {
  onCloseCallback = callback;
};
const setOnError = (callback: (event: Event) => void) => {
  onErrorCallback = callback;
};

export const signalingService = {
  connect,
  sendMessage,
  setOnMessage,
  setOnOpen,
  setOnClose,
  setOnError,
  close,
  isOpen: () => socket !== null && socket.readyState === WebSocket.OPEN,
};
