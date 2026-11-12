import { useState } from 'react';
import { useApi } from '../hooks.js';
import { api, ApiError } from '../api.js';
import type { Job, Project } from '@neuroos/core-contracts';
import { Card, EmptyState, ErrorBox, Field, Loader, StatusBadge } from '../components/ui.js';

const KINDS: Job['kind'][] = [
  'spec_generate', 'arch_generate', 'code_task', 'test_run',
  'build_run', 'audit_run', 'release', 'update_publish', 'ai_task',
];

export function BuildCenter() {
  const jobs = useApi<{ items: Job[] }>(() => api.jobs());
  const projects = useApi<{ items: Project[] }>(() => api.projects());
  const [projectId, setProjectId] = useState('');
  const [kind, setKind] = useState<Job['kind']>('build_run');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (jobs.loading || projects.loading) return <Loader />;
  if (jobs.error) return <ErrorBox message={jobs.error} onRetry={jobs.reload} />;
  if (projects.error) return <ErrorBox message={projects.error} onRetry={projects.reload} />;

  const items = jobs.data?.items ?? [];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      await api.createJob(projectId, kind);
      jobs.reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    setFormError(null);
    try {
      await api.cancelJob(id);
      jobs.reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
    }
  };

  const run = async (id: string) => {
    setFormError(null);
    try {
      const result = await api.runJob(id);
      if (result.error) {
        setFormError(`Задача завершилась с ошибкой: ${result.error}`);
      }
      jobs.reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
    }
  };

  return (
    <div>
      <h1>Build Center</h1>
      <Card title={`Очередь задач (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState text="Очередь пуста" />
        ) : (
          <table className="nf-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Статус</th>
                <th>Попытки</th>
                <th>Создана</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => (
                <tr key={j.id}>
                  <td>
                    {j.kind}
                    {j.error && (
                      <p className="nf-error-text" role="alert">
                        {j.error}
                      </p>
                    )}
                  </td>
                  <td>
                    <StatusBadge value={j.status} />
                  </td>
                  <td>
                    {j.attempts}/{j.maxAttempts}
                  </td>
                  <td>{j.createdAt ? new Date(j.createdAt).toLocaleString('ru-RU') : '—'}</td>
                  <td>
                    {j.status === 'queued' && (
                      <button type="button" className="nf-button" onClick={() => run(j.id)}>
                        Запустить
                      </button>
                    )}
                    {(j.status === 'queued' || j.status === 'running') && (
                      <button type="button" className="nf-button" onClick={() => cancel(j.id)}>
                        Отменить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {formError && (
          <p className="nf-error-text" role="alert">
            {formError}
          </p>
        )}
      </Card>
      <Card title="Поставить задачу в очередь">
        <form className="nf-form" onSubmit={create}>
          <Field label="Проект">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="" disabled>
                выберите проект
              </option>
              {(projects.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Тип задачи">
            <select value={kind} onChange={(e) => setKind(e.target.value as Job['kind'])}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className="nf-button" disabled={busy}>
            {busy ? 'Отправка…' : 'В очередь'}
          </button>
        </form>
        <p className="nf-empty">
          code_task создаёт каркас проекта (package.json, index.js, тест, git init), build_run и
          test_run исполняются через RUNNER; AI-задачи требуют подключённого провайдера
          (smoke-тест + key_ref) и честно падают без него.
        </p>
      </Card>
    </div>
  );
}
