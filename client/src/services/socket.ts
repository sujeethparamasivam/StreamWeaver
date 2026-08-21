import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// A single shared socket for the whole app. Connects lazily on first use
// and is proxied through Vite in dev (see vite.config.ts) to the API
// server's Socket.IO endpoint.
export const getSocket = (): Socket => {
  if (!socket) {
    socket = io({ transports: ['websocket', 'polling'] });
  }
  return socket;
};

export const joinRoom = (room: string) => {
  getSocket().emit('join', room);
};

export interface ImportProgressPayload {
  uploadId: string;
  stage?: 'upload' | 'transform' | 'import';
  progress?: number;
  fileSize?: number;
  totalRows?: number;
  rowsProcessed?: number;
  rowsFailed?: number;
  rowsPerSecond?: number;
  durationMs?: number;
  batchSize?: number;
  memoryUsage?: Record<string, number>;
  error?: string;
}

export const onImportProgress = (handler: (payload: ImportProgressPayload) => void) => {
  const s = getSocket();
  s.on('import-progress', handler);
  return () => {
    s.off('import-progress', handler);
  };
};
