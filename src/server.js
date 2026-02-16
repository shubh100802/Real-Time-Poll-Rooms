require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const { connectDatabase } = require("./config/db");

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await connectDatabase();

    const server = http.createServer(app);
    const io = new Server(server);

    app.set("io", io);

    io.on("connection", (socket) => {
      socket.on("poll:join", (pollId) => {
        if (typeof pollId !== "string" || !pollId) {
          return;
        }

        socket.join(`poll:${pollId}`);
      });
    });

    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();