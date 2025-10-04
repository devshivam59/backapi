import { useMemo, useState } from 'react';
import {
  IconBell,
  IconList,
  IconMenu2,
  IconStack2,
  IconUser,
  IconWallet,
} from '@tabler/icons-react';
import WatchlistTab from './components/WatchlistTab.jsx';
import OrdersTab from './components/OrdersTab.jsx';
import PortfolioTab from './components/PortfolioTab.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import './App.css';

const tabs = [
  {
    key: 'watchlist',
    label: 'Watchlist',
    icon: IconList,
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: IconStack2,
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    icon: IconWallet,
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: IconUser,
  },
];

const tabComponents = {
  watchlist: WatchlistTab,
  orders: OrdersTab,
  portfolio: PortfolioTab,
  profile: ProfileTab,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('watchlist');
  const TabComponent = useMemo(() => tabComponents[activeTab], [activeTab]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__left">
          <button className="ghost-button" aria-label="Menu">
            <IconMenu2 size={22} />
          </button>
          <div>
            <h1>BackAPI Trader</h1>
            <p>Smart investing, inspired by Zerodha &amp; Upstox</p>
          </div>
        </div>
        <button className="ghost-button" aria-label="Notifications">
          <IconBell size={22} />
          <span className="notification-dot" aria-hidden="true" />
        </button>
      </header>

      <main className="app-content">
        <TabComponent />
      </main>

      <nav className="app-tabbar" aria-label="Main navigation">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = key === activeTab;
          return (
            <button
              key={key}
              type="button"
              className={`tabbar-item ${isActive ? 'tabbar-item--active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
              {isActive && <span className="tabbar-highlight" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
