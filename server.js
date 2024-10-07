const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const ACTIONS = require("./ACTIONS");

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("build"));
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
  const clients = []; // Initialize an empty array for clients
  const connectedSockets = io.sockets.adapter.rooms.get(roomId) || new Set(); // Get connected sockets or an empty Set

  // Loop through each connected socket ID
  connectedSockets.forEach((socketId) => {
    clients.push({
      // Add client info to the array
      socketId: socketId,
      username: userSocketMap[socketId], // Get username from userSocketMap
    });
  });

  return clients; // Return the array of connected clients
}



io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username; // Map the socket ID to the username
    socket.join(roomId); // Join the specified room

    const clients = getAllConnectedClients(roomId); // Get all connected clients in the room

    clients.forEach((client) => {
      io.to(client.socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });


  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
