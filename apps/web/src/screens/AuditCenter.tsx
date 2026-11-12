import { useApi } from '../hooks.js';
import { api } from '../api.js';
import type { LifecycleEvent } from '@neuroos/core-contracts';
import { Card, EmptyState, ErrorBox, Loader } from '../components/ui.js';

export function AuditCenter() {
  const { data, error, loading, reload } = useApi<{ items: LifecycleEvent[] }>(() => api.events());

  if (loading) return <Loader />;
  if (error || !data) return <ErrorBox message={error ?? 'нет данных'} onRetry={reload} />;

  return (
    <div>
      <h1>Audit Center</h1>
      <Card title={`Журнал событий (${data.items.length})`}>
        {data.items.length === 0 ? (
          <EmptyState text="Событий пока нет" />
        ) : (
          <table className="nf-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Переход</th>
                <th>Причина</th>
                <th>Актор</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString('ru-RU')}</td>
                  <td>
                    <code>
                      {e.fromStatus} → {e.toStatus}
                    </code>
                  </td>
                  <td>{e.reason}</td>
                  <td>{e.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
