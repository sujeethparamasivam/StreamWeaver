import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRoutes from './routes/authRoutes';
import uploadRoutes from './routes/uploadRoutes';
import debugRoutes from './routes/debugRoutes';
import importRoutes from './routes/importRoutes';
import validationRoutes from './routes/validationRoutes';
import transformedRoutes from './routes/transformedRoutes';
import { registerSocketHandlers } from './socket/socketHandler';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Make the Socket.IO server available to routes (req.app.get('io')) so the
// upload pipeline can emit live progress events as it processes a file.
app.set('io', io);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/validations', validationRoutes);
app.use('/api/transformed', transformedRoutes);

// Serve the built React client when it's been built (npm run build), so
// the whole app can run from a single process with `npm start`.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run "npm run build" first, or use "npm run dev" for local development.');
  });
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const startServer = async () => {
  try {
    if (MONGO_URI) {
      await mongoose.connect(MONGO_URI);
      console.log('MongoDB connected using environment URI');
    } else {
      const mongodb = await MongoMemoryServer.create();
      const uri = mongodb.getUri();
      await mongoose.connect(uri);
      console.log('MongoDB connected using embedded memory server');
    }
  } catch (error) {
    console.warn('MongoDB unavailable, continuing with local auth fallback:', error);
  }

  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();
