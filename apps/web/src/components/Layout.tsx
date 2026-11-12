import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useLiveEvents } from '../hooks.js';

const NAV = [
  { to: '/', label: 'Global Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/ai', label: 'AI Workspace' },
  { to: '/builds', label: 'Build Center' },
  { to: '/audit', label: 'Audit Center' },
  { to: '/releases', label: 'Release Center' },
  { to: '/settings', label: 'Settings' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { connected, lastEvent } = useLiveEvents();

  return (
    <div className="nf-layout">
      <aside className="nf-sidebar">
        <div className="nf-brand">
          <span className="nf-brand-accent">NeuroOS</span> App Factory
        </div>
        <nav className="nf-nav" aria-label="Основная навигация">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nf-nav-item${isActive ? ' nf-nav-item--active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nf-sidebar-footer">
          <span
            className={`nf-ws-dot ${connected ? 'nf-ws-dot--online' : 'nf-ws-dot--offline'}`}
            title={connected ? 'WebSocket подключён' : 'WebSocket отключён'}
          />
          <span className="nf-ws-label">
            {connected ? 'статусы в реальном времени' : 'offline: статусы недоступны'}
          </span>
        </div>
      </aside>
      <main className="nf-content">
        {lastEvent && (
          <div className="nf-live-banner" data-testid="live-event">
            событие: {lastEvent.type}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
