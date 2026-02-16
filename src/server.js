// ========== ENV SETUP ========== //
require("dotenv").config();

// ========== IMPORTS ========== //
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const { connectDatabase } = require("./config/db");

// ========== CONFIG ========== //
const port = Number(process.env.PORT) || 3000;

// ========== STARTUP ========== //
async function startServer() {
  try {
    await connectDatabase();

    // ========== HTTP + SOCKET SERVER ========== //
    const server = http.createServer(app);
    const io = new Server(server);

    app.set("io", io);

    // ========== SOCKET EVENTS ========== //
    io.on("connection", (socket) => {
      socket.on("poll:join", (pollId) => {
        if (typeof pollId !== "string" || !pollId) {
          return;
        }

        socket.join(`poll:${pollId}`);
      });
    });

    // ========== LISTEN ========== //
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

// ========== ENTRYPOINT ========== //
startServer();
