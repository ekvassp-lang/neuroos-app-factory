import { useApi } from '../hooks.js';
import { api, type Overview } from '../api.js';
import { Card, EmptyState, ErrorBox, Loader, StatusBadge } from '../components/ui.js';

export function GlobalDashboard() {
  const { data, error, loading, reload } = useApi<Overview>(() => api.overview());

  if (loading) return <Loader />;
  if (error || !data) return <ErrorBox message={error ?? 'нет данных'} onRetry={reload} />;

  return (
    <div>
      <h1>Global Dashboard</h1>
      <div className="nf-stat-grid">
        <Card title="Проекты">
          <p className="nf-stat">{data.totals.projects}</p>
        </Card>
        <Card title="Задачи (jobs)">
          <p className="nf-stat">{data.totals.jobs}</p>
        </Card>
        <Card title="Артефакты">
          <p className="nf-stat">{data.totals.artifacts}</p>
        </Card>
        <Card title="Релизы">
          <p className="nf-stat">{data.totals.releases}</p>
        </Card>
      </div>
      <Card title="Проекты по статусам">
        {Object.keys(data.byStatus).length === 0 ? (
          <EmptyState text="Пока нет проектов" />
        ) : (
          <div className="nf-chip-row">
            {Object.entries(data.byStatus).map(([status, count]) => (
              <span key={status} className="nf-chip">
                <StatusBadge value={status} /> × {count}
              </span>
            ))}
          </div>
        )}
      </Card>
      <Card title="Последние события жизненного цикла">
        {data.recentEvents.length === 0 ? (
          <EmptyState text="Событий пока нет" />
        ) : (
          <ul className="nf-list">
            {data.recentEvents.map((event) => (
              <li key={event.id}>
                <code>
                  {event.fromStatus} → {event.toStatus}
                </code>{' '}
                · {event.reason} · {new Date(event.createdAt).toLocaleString('ru-RU')}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
