import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import {
  IconBolt,
  IconChevronRight,
  IconPlus,
  IconSearch,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useLivePrices } from '../hooks/useLivePrices.js';

const watchlistItems = [
  {
    symbol: 'NIFTY 50',
    instrument: 'NSE:NIFTY 50',
    name: 'NSE Index',
    price: '22,200.60',
    previousClose: 22110.15,
    change: '+0.84%',
    direction: 'up',
    volume: '1.2M',
  },
  {
    symbol: 'RELIANCE',
    instrument: 'NSE:RELIANCE',
    name: 'Reliance Industries',
    price: '2,398.35',
    previousClose: 2390.1,
    change: '-0.42%',
    direction: 'down',
    volume: '845K',
  },
  {
    symbol: 'TCS',
    instrument: 'NSE:TCS',
    name: 'Tata Consultancy',
    price: '3,462.10',
    previousClose: 3420.95,
    change: '+1.26%',
    direction: 'up',
    volume: '412K',
  },
  {
    symbol: 'HDFCBANK',
    instrument: 'NSE:HDFCBANK',
    name: 'HDFC Bank',
    price: '1,501.85',
    previousClose: 1496.03,
    change: '+0.32%',
    direction: 'up',
    volume: '615K',
  },
];

const quickFilters = ['All', 'NSE', 'BSE', 'F&O', 'Crypto'];

const fuseOptions = {
  includeScore: true,
  threshold: 0.32,
  keys: [
    { name: 'symbol', weight: 0.6 },
    { name: 'name', weight: 0.4 },
  ],
};

const formatPrice = (value) =>
  Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatChange = (percent) =>
  `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;

export default function WatchlistTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const fuse = useMemo(() => new Fuse(watchlistItems, fuseOptions), []);
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return watchlistItems;
    }
    return fuse.search(searchQuery).map((result) => result.item);
  }, [fuse, searchQuery]);

  const { prices, status, error } = useLivePrices(
    filteredItems.map((item) => item.instrument),
    {
      refreshInterval: 4000,
    },
  );

  const enrichedItems = filteredItems.map((item) => {
    const livePrice = prices[item.instrument];
    if (livePrice == null) {
      return item;
    }

    const priceNumber = Number(livePrice);
    const changePercent = item.previousClose
      ? ((priceNumber - item.previousClose) / item.previousClose) * 100
      : null;
    return {
      ...item,
      price: formatPrice(priceNumber),
      change: changePercent != null ? formatChange(changePercent) : item.change,
      direction: changePercent != null && changePercent < 0 ? 'down' : 'up',
    };
  });

  const liveStatusText = error
    ? 'Live feed unavailable'
    : status === 'loading'
    ? 'Refreshing prices…'
    : 'Streaming live prices';

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

      <div className="watchlist-toolbar">
        <div className="watchlist-search">
          <IconSearch aria-hidden size={16} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            type="search"
            placeholder="Search by symbol or name"
            aria-label="Search instruments"
          />
        </div>
        <div className={`live-indicator live-indicator--${error ? 'error' : 'active'}`}>
          <IconBolt size={14} />
          <span>{liveStatusText}</span>
        </div>
      </div>

      <div className="quick-filters">
        {quickFilters.map((filter) => (
          <button key={filter} type="button" className="chip">
            {filter}
          </button>
        ))}
      </div>

      <div className="watchlist-grid">
        {enrichedItems.map((item) => (
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
