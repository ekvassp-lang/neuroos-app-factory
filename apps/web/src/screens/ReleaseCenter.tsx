import { useApi } from '../hooks.js';
import { api } from '../api.js';
import type { Release } from '@neuroos/core-contracts';
import { Card, EmptyState, ErrorBox, Loader } from '../components/ui.js';

export function ReleaseCenter() {
  const { data, error, loading, reload } = useApi<{ items: Release[] }>(() => api.releases());

  if (loading) return <Loader />;
  if (error || !data) return <ErrorBox message={error ?? 'нет данных'} onRetry={reload} />;

  return (
    <div>
      <h1>Release Center</h1>
      <Card title={`Релизы (${data.items.length})`}>
        {data.items.length === 0 ? (
          <EmptyState text="Релизов нет — сборки появятся на STAGE 5–7 (честный пустой реестр)" />
        ) : (
          <ul className="nf-list">
            {data.items.map((r) => (
              <li key={r.id}>
                <strong>{r.version}</strong> ({r.channel}) · {r.notes}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
