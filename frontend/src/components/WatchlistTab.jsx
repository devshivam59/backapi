import { IconChevronRight, IconPlus, IconTrendingUp } from '@tabler/icons-react';

const watchlistItems = [
  {
    symbol: 'NIFTY 50',
    name: 'NSE Index',
    price: '22,200.60',
    change: '+0.84%',
    direction: 'up',
    volume: '1.2M',
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    price: '2,398.35',
    change: '-0.42%',
    direction: 'down',
    volume: '845K',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy',
    price: '3,462.10',
    change: '+1.26%',
    direction: 'up',
    volume: '412K',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank',
    price: '1,501.85',
    change: '+0.32%',
    direction: 'up',
    volume: '615K',
  },
];

const quickFilters = ['All', 'NSE', 'BSE', 'F&O', 'Crypto'];

export default function WatchlistTab() {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <div>
          <div className="tag">
            <IconTrendingUp size={14} />
            Live Markets
          </div>
          <h2 className="section-card__title">Your smart watchlists</h2>
          <p className="section-card__subtitle">
            Track indices, stocks &amp; derivatives with lightning-fast updates.
          </p>
        </div>
        <button type="button" className="ghost-button" aria-label="Create watchlist">
          <IconPlus size={18} />
        </button>
      </div>

      <div className="quick-filters">
        {quickFilters.map((filter) => (
          <button key={filter} type="button" className="chip">
            {filter}
          </button>
        ))}
      </div>

      <div className="watchlist-grid">
        {watchlistItems.map((item) => (
          <article key={item.symbol} className="watchlist-card">
            <header>
              <div>
                <h3>{item.symbol}</h3>
                <p>{item.name}</p>
              </div>
              <IconChevronRight size={18} strokeWidth={1.8} />
            </header>
            <div className="watchlist-card__body">
              <strong>{item.price}</strong>
              <span className={item.direction === 'up' ? 'positive' : 'negative'}>
                {item.change}
              </span>
            </div>
            <footer>
              <span className="muted">Volume</span>
              <span>{item.volume}</span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
