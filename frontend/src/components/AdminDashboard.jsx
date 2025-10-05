import {
  IconAdjustments,
  IconApi,
  IconChecklist,
  IconDeviceFloppy,
  IconLayoutGrid,
  IconPlus,
  IconRefresh,
  IconShieldLock,
  IconUpload,
  IconUsersGroup,
} from '@tabler/icons-react';

const instrumentRows = [
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    exchange: 'NSE',
    segment: 'EQ',
    status: 'Active',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    exchange: 'NSE',
    segment: 'EQ',
    status: 'Active',
  },
  {
    symbol: 'NIFTY 50',
    name: 'Nifty Index',
    exchange: 'NSE',
    segment: 'Index',
    status: 'Tracked',
  },
];

const tokens = [
  { label: 'Primary Trading Token', value: 'kite_live_x1h8...', scope: 'Trading APIs', expires: '3 hrs' },
  { label: 'Historical Data Token', value: 'historical_e9k2...', scope: 'Data APIs', expires: '12 hrs' },
];

const auditEvents = [
  { actor: 'Admin', action: 'Updated margin requirements', time: '2 mins ago' },
  { actor: 'Deal Desk', action: 'Approved access token refresh', time: '14 mins ago' },
  { actor: 'Ops Bot', action: 'Synced 152 new NSE instruments', time: '38 mins ago' },
];

export default function AdminDashboard() {
  return (
    <div className="admin-dashboard">
      <header className="section-card admin-dashboard__hero">
        <div>
          <div className="tag tag--brand">
            <IconShieldLock size={14} />
            Admin Control Centre
          </div>
          <h2 className="section-card__title">Operational oversight in one place</h2>
          <p className="section-card__subtitle">
            Manage market instruments, API credentials, user access, and system automations with
            enterprise-grade safety.
          </p>
        </div>
        <div className="admin-dashboard__hero-actions">
          <button type="button" className="chip chip--primary">
            <IconPlus size={16} />
            New Instrument
          </button>
          <button type="button" className="chip">
            <IconRefresh size={16} />
            Sync with Exchange
          </button>
        </div>
      </header>

      <section className="admin-grid">
        <article className="section-card admin-card admin-card--wide" aria-label="Instrument catalogue">
          <header>
            <div>
              <h3>
                <IconLayoutGrid size={18} /> Instruments catalogue
              </h3>
              <p className="section-card__subtitle">
                Curate tradable symbols and instantly publish changes to the trading experience.
              </p>
            </div>
            <button type="button" className="ghost-button">
              <IconUpload size={18} />
              Bulk import CSV
            </button>
          </header>

          <div className="table">
            <div className="table__head">
              <span>Symbol</span>
              <span>Name</span>
              <span>Exchange</span>
              <span>Segment</span>
              <span>Status</span>
            </div>
            {instrumentRows.map((row) => (
              <div key={row.symbol} className="table__row">
                <span>{row.symbol}</span>
                <span>{row.name}</span>
                <span>{row.exchange}</span>
                <span>{row.segment}</span>
                <span>
                  <span className="pill pill--success">{row.status}</span>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card admin-card" aria-label="Access tokens">
          <header>
            <div>
              <h3>
                <IconApi size={18} /> Zerodha access tokens
              </h3>
              <p className="section-card__subtitle">
                Rotate secrets and monitor expiry across live and sandbox environments.
              </p>
            </div>
            <button type="button" className="ghost-button">
              <IconDeviceFloppy size={18} />
              Generate new token
            </button>
          </header>

          <ul className="token-list">
            {tokens.map((token) => (
              <li key={token.value}>
                <div>
                  <strong>{token.label}</strong>
                  <p>{token.scope}</p>
                </div>
                <div>
                  <code>{token.value}</code>
                  <span className="muted">Expires in {token.expires}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="section-card admin-card" aria-label="User administration">
          <header>
            <div>
              <h3>
                <IconUsersGroup size={18} /> Active users
              </h3>
              <p className="section-card__subtitle">
                Review permissions, last login, and compliance checklists instantly.
              </p>
            </div>
            <button type="button" className="ghost-button">
              <IconAdjustments size={18} />
              Manage roles
            </button>
          </header>

          <div className="stat-grid">
            <div>
              <span className="muted">Total users</span>
              <strong>248</strong>
            </div>
            <div>
              <span className="muted">Pending KYC</span>
              <strong className="negative">6</strong>
            </div>
            <div>
              <span className="muted">2FA Enabled</span>
              <strong className="positive">96%</strong>
            </div>
          </div>

          <footer className="admin-card__footer">
            <IconChecklist size={18} />
            <span>Automations run every 15 minutes to reconcile user entitlements.</span>
          </footer>
        </article>

        <article className="section-card admin-card admin-card--activity" aria-label="Audit trail">
          <header>
            <div>
              <h3>Latest automation &amp; audit log</h3>
              <p className="section-card__subtitle">
                Every change to risk, tokens, and instruments is captured for compliance.
              </p>
            </div>
          </header>

          <ul className="audit-list">
            {auditEvents.map((event) => (
              <li key={`${event.actor}-${event.time}`}>
                <div>
                  <strong>{event.actor}</strong>
                  <span className="muted">{event.time}</span>
                </div>
                <p>{event.action}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
