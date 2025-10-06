const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan('dev'));

app.get('/', (_req, res) => {
  res.json({ message: 'Trading API is running', version: 'v1' });
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
