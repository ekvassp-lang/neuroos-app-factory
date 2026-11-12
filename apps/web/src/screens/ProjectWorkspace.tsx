import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { api, ApiError } from '../api.js';
import type { GatesResponse, ProjectDetail } from '../api.js';
import type { LifecycleStatus } from '@neuroos/core-contracts';
import { Card, EmptyState, ErrorBox, Loader, StatusBadge } from '../components/ui.js';

const STATUSES: LifecycleStatus[] = [
  'IDEA', 'ANALYSIS', 'SPECIFICATION', 'ARCHITECTURE', 'DEVELOPMENT', 'TESTING',
  'AUDIT', 'APPROVED', 'BUILDING', 'RELEASE_CANDIDATE', 'RELEASED', 'MAINTENANCE',
  'BLOCKED', 'ARCHIVED',
];

export function ProjectWorkspace() {
  const { slug = '' } = useParams();
  const { data, error, loading, reload } = useApi<ProjectDetail>(() => api.project(slug), [slug]);
  const gates = useApi<GatesResponse>(() => api.gates(slug), [slug]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const changeStatus = async (status: LifecycleStatus) => {
    setSaveError(null);
    setSaving(true);
    try {
      await api.patchProject(slug, { status });
      reload();
    } catch (err) {
      setSaveError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (error || !data) return <ErrorBox message={error ?? 'нет данных'} onRetry={reload} />;

  const { project, events, jobs } = data;

  const decideGate = async (code: string, action: 'approve' | 'reject') => {
    setGateError(null);
    try {
      if (action === 'approve') {
        await api.approveGate(slug, code, 'owner');
      } else {
        await api.rejectGate(slug, code);
      }
      gates.reload();
      reload();
    } catch (err) {
      setGateError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
    }
  };

  return (
    <div>
      <h1>
        {project.name} <code className="nf-slug">/{project.slug}</code>
      </h1>
      <div className="nf-stat-grid">
        <Card title="Статус">
          <p>
            <StatusBadge value={project.status} />
          </p>
          <select
            aria-label="Изменить статус"
            value={project.status}
            disabled={saving}
            onChange={(e) => changeStatus(e.target.value as LifecycleStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {saveError && (
            <p className="nf-error-text" role="alert">
              {saveError}
            </p>
          )}
        </Card>
        <Card title="Этап">
          <p className="nf-stat">{project.currentStage} / 8</p>
        </Card>
        <Card title="Целевые платформы">
          <div className="nf-chip-row">
            {project.targetPlatforms.map((p) => (
              <span key={p} className="nf-chip">
                {p}
              </span>
            ))}
          </div>
        </Card>
        <Card title="Критерии приёмки">
          {project.acceptanceCriteria.length === 0 ? (
            <EmptyState text="Критерии не заданы" />
          ) : (
            <ul className="nf-list">
              {project.acceptanceCriteria.map((c) => (
                <li key={c.id}>
                  <StatusBadge value={c.status} /> {c.text}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Задачи проекта">
        {jobs.length === 0 ? (
          <EmptyState text="Задач нет" />
        ) : (
          <ul className="nf-list">
            {jobs.map((j) => (
              <li key={j.id}>
                <StatusBadge value={j.status} /> {j.kind}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Контрольные точки (G0–G6)">
        {gates.error && <ErrorBox message={gates.error} onRetry={gates.reload} />}
        {gateError && (
          <p className="nf-error-text" role="alert">
            {gateError}
          </p>
        )}
        {gates.data ? (
          <table className="nf-table">
            <thead>
              <tr>
                <th>Гейт</th>
                <th>Готов</th>
                <th>Недостаёт</th>
                <th>Решение</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gates.data.items.map((g) => {
                const decision = gates.data?.decisions.find((d) => d.code === g.code);
                return (
                  <tr key={g.code}>
                    <td>
                      <strong>{g.code}</strong>
                    </td>
                    <td>{g.eligible ? 'да' : 'нет'}</td>
                    <td>{g.missing.length > 0 ? g.missing.join(', ') : '—'}</td>
                    <td>{decision ? <StatusBadge value={decision.status} /> : '—'}</td>
                    <td>
                      <button type="button" className="nf-button" onClick={() => decideGate(g.code, 'approve')}>
                        Утвердить
                      </button>{' '}
                      <button type="button" className="nf-button" onClick={() => decideGate(g.code, 'reject')}>
                        Отклонить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          !gates.error && <Loader />
        )}
        <p className="nf-empty">
          Утверждение выполняется от имени owner (аутентификация ролей не реализована в STAGE 3).
        </p>
      </Card>
      <Card title="История жизненного цикла">
        {events.length === 0 ? (
          <EmptyState text="Событий нет" />
        ) : (
          <ul className="nf-list">
            {events.map((e) => (
              <li key={e.id}>
                <code>
                  {e.fromStatus} → {e.toStatus}
                </code>{' '}
                · {e.reason} · {e.actor} · {new Date(e.createdAt).toLocaleString('ru-RU')}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
