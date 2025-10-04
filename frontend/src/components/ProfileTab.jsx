import { IconDeviceMobile, IconLogout, IconSettings, IconShieldLock } from '@tabler/icons-react';

const profileDetails = [
  {
    title: 'Account tier',
    value: 'Prime Investor',
    description: 'Enjoy priority support, zero AMC and enhanced charting.',
  },
  {
    title: 'Linked accounts',
    value: '4 broker connections',
    description: 'Zerodha, Upstox, Angel One and Groww synced in real-time.',
  },
  {
    title: '2FA status',
    value: 'Secure with Authenticator',
    description: 'Biometric fallback active, device trusted for 30 days.',
  },
  {
    title: 'API usage',
    value: '12,480 calls today',
    description: 'Automations and webhooks are running efficiently.',
  },
];

export default function ProfileTab() {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <div>
          <div className="tag">
            <IconShieldLock size={14} />
            Secure
          </div>
          <h2 className="section-card__title">Profile &amp; preferences</h2>
          <p className="section-card__subtitle">
            Manage accounts, devices and API keys across brokers.
          </p>
        </div>
        <div className="profile-actions">
          <button type="button" className="ghost-button" aria-label="Security settings">
            <IconSettings size={18} />
          </button>
          <button type="button" className="ghost-button" aria-label="Logout">
            <IconLogout size={18} />
          </button>
        </div>
      </div>

      <div className="profile-summary">
        <article>
          <h3>Ananya Sharma</h3>
          <p className="muted">Client ID: BA12345</p>
          <div className="tag tag--success">
            <IconDeviceMobile size={14} />
            Mobile verified
          </div>
        </article>
        <div className="profile-summary__cta">
          <button type="button">Switch to paper trading</button>
          <button type="button" className="outline">Generate API token</button>
        </div>
      </div>

      <div className="profile-grid">
        {profileDetails.map((detail) => (
          <article key={detail.title} className="profile-card">
            <h4>{detail.title}</h4>
            <p>{detail.value}</p>
            <p>{detail.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
