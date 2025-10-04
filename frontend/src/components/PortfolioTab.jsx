import { IconArrowUpRight, IconChevronRight, IconMoodSmile } from '@tabler/icons-react';

const holdings = [
  {
    symbol: 'TCS',
    name: 'Tata Consultancy',
    qty: 20,
    avg: '3,210.00',
    ltp: '3,462.10',
    pnl: '+5.82%',
  },
  {
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance',
    qty: 6,
    avg: '6,720.00',
    ltp: '7,180.50',
    pnl: '+6.85%',
  },
  {
    symbol: 'ITC',
    name: 'ITC Limited',
    qty: 80,
    avg: '402.20',
    ltp: '414.80',
    pnl: '+3.11%',
  },
];

const metrics = [
  { label: 'Overall returns', value: '+₹ 46,820', trend: 'positive' },
  { label: 'Invested value', value: '₹ 7,80,000', trend: 'muted' },
  { label: 'Day change', value: '+₹ 4,280 (0.84%)', trend: 'positive' },
  { label: 'Available margin', value: '₹ 1,50,000', trend: 'muted' },
];

export default function PortfolioTab() {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <div>
          <div className="tag tag--success">
            <IconMoodSmile size={14} />
            Healthy
          </div>
          <h2 className="section-card__title">Portfolio pulse</h2>
          <p className="section-card__subtitle">
            Diversify confidently with actionable insights.
          </p>
        </div>
        <button type="button" className="ghost-button" aria-label="Rebalance">
          <IconArrowUpRight size={18} />
        </button>
      </div>

      <div className="grid-2">
        <section className="portfolio-metrics">
          {metrics.map((metric) => (
            <article key={metric.label}>
              <p className="muted">{metric.label}</p>
              <h3 className={metric.trend}>{metric.value}</h3>
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={{ width: metric.trend === 'positive' ? '82%' : '46%' }} />
              </div>
            </article>
          ))}
        </section>
        <section className="portfolio-holdings">
          <header>
            <h3>Top holdings</h3>
            <button type="button" className="link-button">
              View all
              <IconChevronRight size={16} strokeWidth={1.8} />
            </button>
          </header>
          <table className="table" role="grid">
            <thead>
              <tr>
                <th align="left">Symbol</th>
                <th align="left">Qty</th>
                <th align="left">Avg</th>
                <th align="left">LTP</th>
                <th align="left">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={holding.symbol}>
                  <td>
                    <div className="symbol">
                      <span>{holding.symbol}</span>
                      <small>{holding.name}</small>
                    </div>
                  </td>
                  <td>{holding.qty}</td>
                  <td>{holding.avg}</td>
                  <td>{holding.ltp}</td>
                  <td className="positive">{holding.pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
