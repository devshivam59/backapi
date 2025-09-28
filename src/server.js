require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDatabase = require('./config/database');
const PriceSimulator = require('./utils/priceSimulator');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const priceSimulator = new PriceSimulator(io);
priceSimulator.start();

io.on('connection', (socket) => {
  socket.on('subscribe', (symbol) => {
    if (symbol) {
      priceSimulator.subscribe(socket, symbol);
    }
  });

  socket.on('unsubscribe', (symbol) => {
    if (symbol) {
      priceSimulator.unsubscribe(socket, symbol);
    }
  });

  socket.on('disconnect', () => {
    priceSimulator.removeSocket(socket.id);
  });
});

const startServer = async () => {
  await connectDatabase(process.env.MONGO_URI);
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

startServer();
