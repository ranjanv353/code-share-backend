export default function registerRoomSocketHandlers(io, socket) {
  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);
    console.log(`👥 ${socket.userEmail} joined room ${roomId}`);
    console.log(`Rooms for ${socket.id}:`, Array.from(socket.rooms));

    socket.to(roomId).emit("user-joined", {
      userEmail: socket.userEmail,
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    console.log(`✏️ code-change from ${socket.userEmail} in ${roomId}`);
    socket.to(roomId).emit("code-update", {
      code,
      from: socket.userEmail,
    });
  });
  
  socket.on("language-change", ({ roomId, language }) => {
  socket.to(roomId).emit("language-update", {
    language,
    from: socket.userEmail,
  });
});
}

