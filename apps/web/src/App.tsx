import { useEffect, useState } from 'react';

interface Health {
  status: string;
  version: string;
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/healthz')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main
      style={{
        fontFamily: 'var(--nf-font)',
        background: 'var(--nf-bg)',
        color: 'var(--nf-text)',
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--nf-surface)',
          borderRadius: 'var(--nf-radius)',
          padding: '2rem 3rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: 'var(--nf-accent)', margin: 0 }}>NeuroOS App Factory</h1>
        <p>Universal Software Production System — foundation v0.1.0</p>
        {health && <p>API: {health.status} (v{health.version})</p>}
        {error && <p style={{ color: 'var(--nf-special)' }}>API недоступен: {error}</p>}
      </div>
    </main>
  );
}
