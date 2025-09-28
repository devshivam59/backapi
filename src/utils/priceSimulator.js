const Instrument = require('../models/Instrument');

class PriceSimulator {
  constructor(io) {
    this.io = io;
    this.interval = null;
    this.subscriptions = new Map(); // symbol -> Set(socketId)
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(async () => {
      const symbols = Array.from(this.subscriptions.keys());
      if (!symbols.length) {
        return;
      }

      const instruments = await Instrument.find({ symbol: { $in: symbols } });
      instruments.forEach(async (instrument) => {
        const change = (Math.random() - 0.5) * 2; // random change
        instrument.lastPrice = Math.max(0, instrument.lastPrice + change);
        instrument.dailyChange = change;
        await instrument.save();
        this.io.to(instrument.symbol).emit('price:update', {
          symbol: instrument.symbol,
          lastPrice: instrument.lastPrice,
          change,
          time: new Date().toISOString(),
        });
      });
    }, 2000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  subscribe(socket, symbol) {
    const upperSymbol = symbol.toUpperCase();
    if (!this.subscriptions.has(upperSymbol)) {
      this.subscriptions.set(upperSymbol, new Set());
    }
    socket.join(upperSymbol);
    this.subscriptions.get(upperSymbol).add(socket.id);
  }

  unsubscribe(socket, symbol) {
    const upperSymbol = symbol.toUpperCase();
    if (this.subscriptions.has(upperSymbol)) {
      const set = this.subscriptions.get(upperSymbol);
      set.delete(socket.id);
      socket.leave(upperSymbol);
      if (!set.size) {
        this.subscriptions.delete(upperSymbol);
      }
    }
  }

  removeSocket(socketId) {
    this.subscriptions.forEach((set, symbol) => {
      if (set.has(socketId)) {
        set.delete(socketId);
        if (!set.size) {
          this.subscriptions.delete(symbol);
        }
      }
    });
  }
}

module.exports = PriceSimulator;
