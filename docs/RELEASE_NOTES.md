# RELEASE NOTES — NeuroOS App Factory

## v0.1.0 (2026-11-13) — первая опубликованная версия

Канал: stable (публикация по решению владельца).
Артефакты: nsis exe, msi (Windows) · dmg, app.tar.gz (macOS) · AppImage, deb, rpm (Linux).
Контрольные суммы: `releases/v0.1.0/checksums-sha256.txt`.

### Новое

- **Фундамент:** pnpm-монорепозиторий (6 пакетов + 2 приложения), строгий TypeScript, CI.
- **API v0.6.0:** проекты, события жизненного цикла (14 статусов), задания с конвейером
  code_task → build_run → test_run, артефакты с SHA-256-верификацией, настройки, WebSocket.
- **Ворота качества G0–G6:** вычисление, одобрение/отклонение, owner-only G0/G6,
  RELEASED-правило (G6 + все критерии DONE).
- **AI-слой:** контракт AIProvider, MistralProvider (таймауты, 429), реестр с
  smoke-test; без ключей — честные отказы.
- **Offline/Online:** sync-engine (очередь, idempotency, LWW-конфликты), серверный
  батч-эндпоинт, fs-персистентность с атомарной записью, офлайн-кэш UI с честным
  маркером, офлайн-очередь мутаций с авто-flush.
- **Multiplatform:** Tauri 2 (конфигурация + CI-матрица на 3 ОС), PWA (манифест,
  service worker), каталог `/releases/`.
- **Testing & Security:** 87 тестов; SAST + сканер секретов в CI (блокирующие);
  аудит зависимостей (2 moderate устранены); тесты восстановления из бэкапа.
- **RELEASE HUB:** версии, каналы (stable/beta/alpha/dev) с правилами, связанными
  с воротами G5/G6; release notes.
- **UPDATE MANAGER v1:** проверка обновлений с семвер-сравнением.

### Известные ограничения

- PostgreSQL/pg-boss — NOT TESTED; AI-ключи — BLOCKED (нужны от владельца);
  Android/iOS, подпись артефактов, автообновление с загрузкой — NOT IMPLEMENTED;
  интерактивная установка на реальных ОС — NOT TESTED. Подробно: docs/AUDIT.md.

### Обновление

Проверка: Release Center → UPDATE MANAGER или `GET /api/v1/updates/latest`.
Автозагрузка — NOT IMPLEMENTED; обновление — заменой установщика.

---

## 0.7.0–0.8.0 (пост-STAGE 8, API)

- 0.7.0: аутентификация и роли (NF_AUTH_TOKENS, owner/engineer/viewer, включая /ws),
  hardening (bodyLimit 2 МиБ, security-заголовки), OpenAPI 3.1 контракт
  (docs/openapi.json + GET /api/v1/openapi.json), pg-mem smoke миграции,
  401-подсказка в UI.
- 0.8.0: GET /api/v1/artifacts/:id/download — файлы артефактов с проверкой
  SHA-256 при каждой отдаче (409 при расхождении); артефакты в деталях проекта
  и кнопка скачивания в ProjectWorkspace; OpenAPI-спека в Settings.

## 0.4.0–0.6.0 (внутренние версии API до первой публикации)

- 0.4.0: sync-эндпоинт, fs-персистентность, офлайн-кэш UI.
- 0.5.0: Tauri 2, PWA, офлайн-очередь в UI, CI-матрица десктоп-сборок.
- 0.6.0: RELEASE HUB, правила каналов ↔ G5/G6, UPDATE MANAGER v1.
