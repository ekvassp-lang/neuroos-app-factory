import { useEffect, useState } from 'react';
import { useApi } from '../hooks.js';
import { api, ApiError, getApiToken, setApiToken } from '../api.js';
import type { FactorySettings } from '@neuroos/core-contracts';
import { Card, ErrorBox, Field, Loader } from '../components/ui.js';

export function Settings() {
  const { data, error, loading, reload } = useApi<FactorySettings>(() => api.settings());
  const [form, setForm] = useState<FactorySettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const [activeToken, setActiveToken] = useState(getApiToken());

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (loading) return <Loader />;
  if (error || !data) return <ErrorBox message={error ?? 'нет данных'} onRetry={reload} />;
  if (!form) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await api.updateSettings({
        theme: form.theme,
        offlineModeEnabled: form.offlineModeEnabled,
        aiEnabled: form.aiEnabled,
      });
      setForm(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
    }
  };

  return (
    <div>
      <h1>Settings</h1>
      <Card title="Настройки фабрики">
        <form className="nf-form" onSubmit={save}>
          <Field label="Тема">
            <select
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value as 'dark' | 'light' })}
            >
              <option value="dark">Тёмная</option>
              <option value="light">Светлая</option>
            </select>
          </Field>
          <Field label="Offline-режим (STAGE 4)">
            <input
              type="checkbox"
              checked={form.offlineModeEnabled}
              onChange={(e) => setForm({ ...form, offlineModeEnabled: e.target.checked })}
            />
          </Field>
          <Field label="ИИ-провайдеры (требуют smoke-тест)">
            <input
              type="checkbox"
              checked={form.aiEnabled}
              onChange={(e) => setForm({ ...form, aiEnabled: e.target.checked })}
            />
          </Field>
          <button type="submit" className="nf-button">
            Сохранить
          </button>
          {saved && <p className="nf-ok-text">Сохранено</p>}
          {saveError && (
            <p className="nf-error-text" role="alert">
              {saveError}
            </p>
          )}
        </form>
      </Card>
      <Card title="Доступ (токен API)">
        <form
          className="nf-form"
          onSubmit={(e) => {
            e.preventDefault();
            setApiToken(tokenInput);
            setActiveToken(getApiToken());
            setTokenInput('');
            setTokenSaved(true);
          }}
        >
          <Field label="Токен (Bearer; роль задаётся на сервере в NF_AUTH_TOKENS)">
            <input
              type="password"
              value={tokenInput}
              data-testid="token-input"
              placeholder={activeToken ? 'токен задан — введите новый для замены' : 'токен не задан'}
              onChange={(e) => setTokenInput(e.target.value)}
            />
          </Field>
          <button type="submit" className="nf-button" data-testid="token-save">
            Сохранить токен
          </button>
          {activeToken && (
            <button
              type="button"
              className="nf-button"
              data-testid="token-clear"
              onClick={() => {
                setApiToken('');
                setActiveToken('');
                setTokenSaved(true);
              }}
            >
              Удалить токен
            </button>
          )}
          {tokenSaved && <p className="nf-ok-text">Токен обновлён</p>}
          <p className="nf-muted-text">
            Токен хранится в localStorage этого браузера и отправляется как
            Authorization: Bearer для API и WebSocket. Без токена, при включённой
            аутентификации на сервере, API отвечает 401.
          </p>
        </form>
      </Card>
      <Card title="API-контракт (OpenAPI)">
        <p className="nf-muted-text">
          Сервер публикует машинночитаемую спецификацию API v0.8.0 (OpenAPI 3.1,
          20 путей) — открытый эндпоинт, токен не требуется.
        </p>
        <a
          className="nf-button nf-button-link"
          href="/api/v1/openapi.json"
          download="neuroos-app-factory-openapi.json"
          data-testid="openapi-download"
        >
          Скачать OpenAPI-спеку
        </a>
      </Card>
    </div>
  );
}
