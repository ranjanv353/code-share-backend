import registerRoomSocketHandlers from "./roomHandlers.js";

export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    const email = socket.handshake.headers["x-user-email"] || "Guest";
    socket.userEmail = email;
    console.log(`✅ [socket connected] ${socket.id} as ${email}`);

    registerRoomSocketHandlers(io, socket);

    socket.on("disconnect", () => {
      console.log(`❌ [socket disconnected] ${socket.id}`);
    });
  });
}
