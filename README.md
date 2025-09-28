# Mock Trading Backend API

A complete Express.js + MongoDB backend for a mock trading application supporting authentication, market data, watchlists, orders, trades, portfolio, funds management, and admin monitoring. Includes a Socket.IO server that simulates live price streaming for subscribed instruments.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and update values as needed:

```bash
cp .env.example .env
```

3. Start the development server:

```bash
npm run dev
```

The API will run on `http://localhost:4000` by default and expose all routes under `/api`.

## API Overview

- `POST /api/auth/register` – Create a new user account.
- `POST /api/auth/login` – Authenticate and obtain a JWT token.
- `GET /api/market/instruments?search=...` – Search for instruments by symbol, name, or ISIN.
- `POST /api/market/instruments/import` – Admin CSV import for the instrument master.
- `GET /api/market/live/:symbol` – Retrieve the latest simulated price for a symbol.
- `POST /api/watchlist` – Add an instrument to the authenticated user's watchlist.
- `GET /api/watchlist` – Fetch the authenticated user's watchlist entries.
- `DELETE /api/watchlist/:id` – Remove an instrument from the watchlist.
- `POST /api/orders` – Place a mock buy or sell order (immediately executed in the simulator).
- `PUT /api/orders/:id` – Modify a pending order.
- `DELETE /api/orders/:id` – Cancel an existing order.
- `GET /api/orders` – List the authenticated user's orders.
- `GET /api/trades` – Retrieve the authenticated user's trade history.
- `GET /api/portfolio/holdings` – Current holdings with mark-to-market data.
- `GET /api/portfolio/positions` – Open positions derived from holdings.
- `GET /api/portfolio/pnl` – Profit and loss summary (realised/unrealised).
- `GET /api/account/funds` – Fetch the user's virtual funds balance.
- `POST /api/account/funds/add` – Add virtual funds and log a transaction.
- `GET /api/account/transactions` – List funds transactions.
- `GET /api/admin/users` – Admin list of users.
- `PUT /api/admin/users/:id/block` – Toggle block state of a user.
- `GET /api/admin/monitor/orders` – Overview of recent orders and trades.

## WebSocket Streaming

The Socket.IO server exposes a lightweight streaming channel. Connect to the Socket.IO endpoint and emit `subscribe` with a symbol (e.g. `"AAPL"`) to receive `price:update` events every two seconds. Emit `unsubscribe` to stop receiving updates.

## CSV Instrument Import

The admin CSV import endpoint accepts files with headers matching typical broker dumps (e.g. `symbol`, `tradingsymbol`, `lot_size`, `tick_size`, etc.). Data is normalized and upserted into MongoDB.

## Error Handling

The API returns:

- `401` for missing/invalid authentication tokens.
- `403` when blocked users or non-admins access protected resources.
- `404` for missing resources.
- `400` with validation error details.

Global error and not-found handlers ensure consistent JSON responses.

## Mock Trading Logic

Orders are executed immediately using the latest instrument price (or submitted price) and update holdings, trades, and the virtual funds ledger. The design keeps logic modular via controllers, services, and Mongoose models for easy extension with real broker integrations in the future.
