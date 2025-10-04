import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import {
  IconBolt,
  IconChevronRight,
  IconInfoCircle,
  IconPlus,
  IconSearch,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useLivePrices } from '../hooks/useLivePrices.js';

const LIVE_COMPATIBLE_PATTERN = /^(NSE|BSE):/;

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
    tags: ['all', 'nse', 'index'],
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
    tags: ['all', 'nse', 'equity', 'fno'],
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
    tags: ['all', 'nse', 'equity', 'it'],
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
    tags: ['all', 'nse', 'equity', 'banking'],
  },
  {
    symbol: 'SBIN',
    instrument: 'BSE:SBIN',
    name: 'State Bank of India',
    price: '821.10',
    previousClose: 816.4,
    change: '+0.58%',
    direction: 'up',
    volume: '1.9M',
    tags: ['all', 'bse', 'equity', 'banking'],
  },
  {
    symbol: 'NIFTY FIN',
    instrument: 'NSE:NIFTY FIN SERVICE',
    name: 'Nifty Financial Services',
    price: '21,342.25',
    previousClose: 21210.33,
    change: '-0.24%',
    direction: 'down',
    volume: '362K',
    tags: ['all', 'nse', 'index', 'fno'],
  },
  {
    symbol: 'BTC-INR',
    instrument: 'CRYPTO:BTC-INR',
    name: 'Bitcoin',
    price: '5,841,220.00',
    previousClose: 5798220,
    change: '+2.42%',
    direction: 'up',
    volume: '32.1K',
    tags: ['all', 'crypto'],
  },
];

const quickFilters = [
  { label: 'All', value: 'all' },
  { label: 'NSE', value: 'nse' },
  { label: 'BSE', value: 'bse' },
  { label: 'F&O', value: 'fno' },
  { label: 'Crypto', value: 'crypto' },
];

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
  const [selectedFilter, setSelectedFilter] = useState('all');
  const fuse = useMemo(() => new Fuse(watchlistItems, fuseOptions), []);
  const searchedItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return watchlistItems;
    }
    return fuse.search(searchQuery).map((result) => result.item);
  }, [fuse, searchQuery]);

  const filteredItems = useMemo(() => {
    if (selectedFilter === 'all') {
      return searchedItems;
    }
    return searchedItems.filter((item) => item.tags?.includes(selectedFilter));
  }, [searchedItems, selectedFilter]);

  const liveEligibleInstruments = useMemo(
    () =>
      filteredItems
        .map((item) => item.instrument)
        .filter((instrument) => LIVE_COMPATIBLE_PATTERN.test(instrument ?? '')),
    [filteredItems],
  );

  const { prices, status, error } = useLivePrices(liveEligibleInstruments, {
    refreshInterval: 4000,
    simulateOnError: true,
  });

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

  const indicatorState = error
    ? 'error'
    : status === 'degraded'
    ? 'degraded'
    : status === 'loading'
    ? 'pending'
    : status === 'success'
    ? 'active'
    : 'idle';

  const liveStatusText = (() => {
    if (error) return 'Live feed unavailable';
    switch (status) {
      case 'loading':
        return 'Refreshing prices…';
      case 'degraded':
        return 'Simulating prices while reconnecting';
      case 'success':
        return 'Streaming live prices';
      default:
        return 'Price feed idle';
    }
  })();

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
        <div className={`live-indicator live-indicator--${indicatorState}`} role="status" aria-live="polite">
          <IconBolt size={14} />
          <span>{liveStatusText}</span>
        </div>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <IconInfoCircle size={16} aria-hidden />
          <div>
            <strong>Realtime Zerodha feed is unavailable.</strong>
            <p>
              We are showing the latest known prices with smart simulation so you can continue
              evaluating trades while the connection recovers.
            </p>
          </div>
        </div>
      )}

      <div className="quick-filters">
        {quickFilters.map((filter) => {
          const isActive = selectedFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              className={`chip ${isActive ? 'chip--active' : ''}`}
              onClick={() => setSelectedFilter(filter.value)}
              aria-pressed={isActive}
            >
              {filter.label}
          </button>
          );
        })}
      </div>

      {enrichedItems.length === 0 ? (
        <div className="watchlist-empty" role="status" aria-live="polite">
          <strong>No instruments match your filters.</strong>
          <p>Try clearing the search or switching segments to keep trading opportunities in view.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
