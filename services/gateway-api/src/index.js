import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import roomsRouter from "./routes/rooms.js";
import errorHandler from "./middlewares/errorHandler.js";
import { optionalAuthenticateJWT } from "./middlewares/auth.js";
import { createProxyMiddleware } from "http-proxy-middleware";
import http from "http";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// REST route
app.use("/rooms", optionalAuthenticateJWT, roomsRouter);

app.use(
  "/socket.io",
  createProxyMiddleware({
    target: "http://localhost:4000", // room-service
    changeOrigin: true,
    ws: true,
  })
);

// Health check
app.get("/health", (req, res) => res.send("Gateway API is running"));

// Error handling
app.use(errorHandler);

const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Gateway API listening on port ${PORT}`);
});
