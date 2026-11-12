import { useApi } from '../hooks.js';
import { api } from '../api.js';
import type { Job, Project } from '@neuroos/core-contracts';
import { Card, EmptyState, ErrorBox, Loader, StatusBadge } from '../components/ui.js';

export function AIWorkspace() {
  const jobs = useApi<{ items: Job[] }>(() => api.jobs());
  const settings = useApi(() => api.settings());

  if (jobs.loading || settings.loading) return <Loader />;
  if (jobs.error) return <ErrorBox message={jobs.error} onRetry={jobs.reload} />;
  if (settings.error) return <ErrorBox message={settings.error} onRetry={settings.reload} />;

  const aiJobs = (jobs.data?.items ?? []).filter((j) => j.kind === 'ai_task' || j.kind === 'spec_generate' || j.kind === 'arch_generate');

  return (
    <div>
      <h1>AI Workspace</h1>
      <Card title="Состояние ИИ-провайдеров">
        <p>
          Провайдеры:{' '}
          <StatusBadge value={settings.data?.aiEnabled ? 'DONE' : 'BLOCKED'} />{' '}
          {settings.data?.aiEnabled
            ? 'включены в настройках'
            : 'отключены — ключи не подключены и smoke-тест не пройден (честный статус)'}
        </p>
        <p className="nf-empty">
          Выполнение ИИ-задач будет реализовано на STAGE 3 (Provider Layer + SPECIFICATION ENGINE).
          Созданные здесь задачи остаются в очереди без исполнения.
        </p>
      </Card>
      <Card title={`ИИ-задачи (${aiJobs.length})`}>
        {aiJobs.length === 0 ? (
          <EmptyState text="ИИ-задач нет" />
        ) : (
          <ul className="nf-list">
            {aiJobs.map((j) => (
              <li key={j.id}>
                <StatusBadge value={j.status} /> {j.kind} · попыток: {j.attempts}/{j.maxAttempts}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
