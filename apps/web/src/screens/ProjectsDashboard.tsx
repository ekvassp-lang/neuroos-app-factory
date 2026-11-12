import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { api, ApiError } from '../api.js';
import type { Project } from '@neuroos/core-contracts';
import { Card, EmptyState, ErrorBox, Field, Loader, StatusBadge } from '../components/ui.js';

export function ProjectsDashboard() {
  const { data, error, loading, reload } = useApi<{ items: Project[] }>(() => api.projects());
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.createProject(name, slug);
      setName('');
      setSlug('');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1>Projects Dashboard</h1>
      {loading && <Loader />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <Card title={`Проекты (${data.items.length})`}>
          {data.items.length === 0 ? (
            <EmptyState text="Проектов нет — создайте первый ниже" />
          ) : (
            <table className="nf-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Slug</th>
                  <th>Статус</th>
                  <th>Этап</th>
                  <th>Платформы</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/projects/${p.slug}`}>{p.name}</Link>
                    </td>
                    <td>
                      <code>{p.slug}</code>
                    </td>
                    <td>
                      <StatusBadge value={p.status} />
                    </td>
                    <td>{p.currentStage}</td>
                    <td>{p.targetPlatforms.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
      <Card title="Новый проект">
        <form className="nf-form" onSubmit={submit}>
          <Field label="Название">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Slug (латиницей)">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </Field>
          <button type="submit" className="nf-button" disabled={submitting}>
            {submitting ? 'Создание…' : 'Создать проект'}
          </button>
          {formError && (
            <p className="nf-error-text" role="alert">
              {formError}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
