import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";

import roomRoutes from "./routes/rooms.js";
import registerSocketHandlers from "./sockets/index.js"; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/rooms', roomRoutes);

app.get('/health', (req, res) => {
  res.send("Room service is running");
});

app.use((err, req, res, next) => {
  console.error('[Room Service Error]', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});


const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});


registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Room service listening on port ${PORT}`);
});
