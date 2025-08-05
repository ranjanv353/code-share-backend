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

// Proxy socket.io → room-service
app.use(
  "/socket.io",
  createProxyMiddleware({
    target: "http://localhost:4000", // room-service
    changeOrigin: true,
    ws: true, // Required for WebSocket proxying
  })
);

// Health check
app.get("/health", (req, res) => res.send("Gateway API is running"));

// Error handling
app.use(errorHandler);

// Use native HTTP server to allow 'upgrade' event for WebSocket
const server = http.createServer(app);

// Upgrade required by http-proxy-middleware for WebSocket support
server.on("upgrade", (req, socket, head) => {
  // This is a stub — no action needed unless multiple proxies
  // http-proxy-middleware handles this internally
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Gateway API listening on port ${PORT}`);
});
