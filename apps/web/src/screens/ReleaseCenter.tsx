import { useState } from 'react';
import { useApi } from '../hooks.js';
import { api, ApiError, type Release, type UpdateCheck } from '../api.js';
import { Card, EmptyState, ErrorBox, Field, Loader } from '../components/ui.js';

const CHANNELS = ['stable', 'beta', 'alpha', 'dev'] as const;

export function ReleaseCenter() {
  const releases = useApi<{ items: Release[] }>(() => api.releases());
  const projects = useApi<{ items: Array<{ id: string; name: string; slug: string }> }>(() => api.projects());

  const [projectId, setProjectId] = useState('');
  const [version, setVersion] = useState('');
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('dev');
  const [notes, setNotes] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [checkChannel, setCheckChannel] = useState<(typeof CHANNELS)[number]>('stable');
  const [currentVersion, setCurrentVersion] = useState('0.1.0');
  const [update, setUpdate] = useState<UpdateCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (releases.loading || projects.loading) return <Loader />;
  if (releases.error || !releases.data) return <ErrorBox message={releases.error ?? 'нет данных'} onRetry={releases.reload} />;

  const items = releases.data.items;

  async function handleCreate() {
    setCreateError(null);
    setCreateOk(null);
    if (!projectId) {
      setCreateError('выберите проект');
      return;
    }
    setCreating(true);
    try {
      const created = await api.createRelease(projectId, version.trim(), channel, notes);
      setCreateOk(`релиз ${created.version} (${created.channel}) зарегистрирован`);
      setVersion('');
      setNotes('');
      await releases.reload();
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.message : 'не удалось создать релиз');
    } finally {
      setCreating(false);
    }
  }

  async function handleCheck() {
    setCheckError(null);
    setUpdate(null);
    setChecking(true);
    try {
      setUpdate(await api.checkUpdates(checkChannel, currentVersion.trim()));
    } catch (error) {
      setCheckError(error instanceof ApiError ? error.message : 'проверка не удалась');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <h1>Release Center</h1>

      <Card title={`RELEASE HUB — релизы (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState text="Релизов нет — зарегистрируйте первый релиз ниже (честный пустой реестр)" />
        ) : (
          <ul className="nf-list">
            {items.map((r) => (
              <li key={r.id}>
                <strong>{r.version}</strong> · канал <strong>{r.channel}</strong> · {r.notes || 'без notes'}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Новый релиз">
        <Field label="Проект">
          <select data-testid="release-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— выберите проект —</option>
            {(projects.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Версия (x.y.z)">
          <input data-testid="release-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="0.1.0" />
        </Field>
        <Field label="Канал">
          <select data-testid="release-channel" value={channel} onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Release notes">
          <textarea data-testid="release-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
        <button data-testid="release-create" onClick={handleCreate} disabled={creating}>
          {creating ? 'Регистрация…' : 'Зарегистрировать релиз'}
        </button>
        {createError && <ErrorBox message={createError} />}
        {createOk && <p role="status">{createOk}</p>}
        <p>Правила каналов: stable требует утверждённых G5 и G6; beta — G5; alpha/dev — без ворот.</p>
      </Card>

      <Card title="UPDATE MANAGER — проверка обновлений">
        <Field label="Канал">
          <select data-testid="update-channel" value={checkChannel} onChange={(e) => setCheckChannel(e.target.value as (typeof CHANNELS)[number])}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Текущая версия (x.y.z)">
          <input data-testid="update-current" value={currentVersion} onChange={(e) => setCurrentVersion(e.target.value)} />
        </Field>
        <button data-testid="update-check" onClick={handleCheck} disabled={checking}>
          {checking ? 'Проверка…' : 'Проверить обновления'}
        </button>
        {checkError && <ErrorBox message={checkError} />}
        {update && (
          <p data-testid="update-result" role="status">
            {update.updateAvailable
              ? `Обновление доступно: ${update.latestVersion} (канал ${update.channel})`
              : `У вас актуальная версия: ${update.latestVersion}`}
          </p>
        )}
      </Card>
    </div>
  );
}
