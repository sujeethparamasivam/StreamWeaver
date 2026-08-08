import { Server } from 'socket.io';

export const registerSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    socket.on('join', (room: string) => socket.join(room));

    socket.on('progress', (payload: { room: string; progress: number; rowsProcessed: number; rowsFailed: number }) => {
      io.to(payload.room).emit('import-progress', payload);
    });
  });
};
