import { IconClockHour4, IconDownload } from '@tabler/icons-react';

const orders = [
  {
    id: 'ORD-98231',
    symbol: 'INFY',
    type: 'Buy',
    qty: 40,
    price: '1,455.20',
    status: 'Executed',
    time: '09:17 AM',
  },
  {
    id: 'ORD-98221',
    symbol: 'RELIANCE',
    type: 'Sell',
    qty: 10,
    price: '2,398.00',
    status: 'Pending',
    time: '09:12 AM',
  },
  {
    id: 'ORD-98192',
    symbol: 'NIFTY23APR22600CE',
    type: 'Buy',
    qty: 75,
    price: '132.40',
    status: 'Partially Filled',
    time: '09:04 AM',
  },
];

export default function OrdersTab() {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <div>
          <div className="tag tag--warning">
            <IconClockHour4 size={14} />
            Today
          </div>
          <h2 className="section-card__title">Order flow</h2>
          <p className="section-card__subtitle">
            Monitor filled, pending and rejected orders in real time.
          </p>
        </div>
        <button type="button" className="ghost-button" aria-label="Download report">
          <IconDownload size={18} />
        </button>
      </div>

      <div className="orders-list">
        {orders.map((order) => (
          <article key={order.id} className="orders-card">
            <header>
              <div>
                <h3>{order.symbol}</h3>
                <p className="muted">{order.id}</p>
              </div>
              <span className={`chip chip--${order.type === 'Buy' ? 'buy' : 'sell'}`}>
                {order.type}
              </span>
            </header>
            <dl>
              <div>
                <dt>Quantity</dt>
                <dd>{order.qty}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{order.price}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{order.status}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{order.time}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
