# TECHNICAL SPECIFICATION — NeuroOS App Factory

Версия: 0.1.0 · API v0.7.0 · Актуализировано по факту реализации (STAGE 8 + auth/roles)

## 1. Общие сведения

Продукт: производственная платформа, управляющая полным жизненным циклом ПО —
от идеи до релиза и обновлений. Один продукт для Web/PWA и десктоп-платформ
через единую кодовую базу.

## 2. Технологический стек (фактический)

| Слой | Технология | Статус |
|---|---|---|
| Язык | TypeScript 5.6, strict, NodeNext, ES2022 | DONE |
| Монорепозиторий | pnpm 10 workspace (apps/*, packages/*) | DONE |
| Веб-оболочка | React 18 + React Router 7.18 + Vite 5 | DONE |
| Десктоп/мобильная оболочка | Tauri 2 (Rust, schema v2) | DONE (сборки CI) |
| Сервер | Fastify 5 + @fastify/websocket 11 | DONE |
| Персистентность v1 | JSON-снапшот (атомарная запись tmp+rename) | DONE |
| Персистентность v2 | PostgreSQL 15 + pg-boss | NOT TESTED (нет PG в среде); схема: migrations/0001_init.sql |
| Очередь заданий | in-process worker (pg-boss — NOT TESTED) | DONE (v1) |
| Дизайн-система | токены `--nf-*`, тёмная/светлая темы | DONE |
| Синхронизация | sync-engine: очередь, idempotency, LWW | DONE |

## 3. Состав монорепозитория

```
apps/
  server/   Fastify API v0.7.0 + WebSocket + worker + persistence + auth
  web/      React SPA + PWA (manifest, service worker, offline-очередь)
packages/
  core-contracts/   типы домена (14 статусов, ворота G0–G6, релизы)
  gate-service/     GATE_DEFINITIONS, evaluate/approve/reject, assertTransition
  runner/           RUNNER v1: whitelist-исполнение команд, маскировка секретов, SHA-256
  ai-provider/      контракт AIProvider, MistralProvider, реестр с smoke-test
  sync-engine/      OperationQueue, KVAdapter (Memory/LocalStorage), LWW, SyncClient
  design-system/    токены дизайна
src-tauri/          конфигурация Tauri 2 (окна, bundle, capabilities)
scripts/            security-scan.mjs (SAST + сканер секретов)
```

## 4. API v0.7.0 (фактические endpoints)

Машинночитаемый контракт: [docs/openapi.json](openapi.json) — OpenAPI 3.1.0,
18 путей, bearerAuth; соответствие спеки живым маршрутам гарантировано
тестами `apps/server/src/openapi.test.ts`.

| Метод и путь | Назначение |
|---|---|
| GET /healthz | версия API, статус, режим аутентификации (auth: enabled/disabled) |
| GET /api/v1/overview | сводка фабрики |
| GET /api/v1/openapi.json | машинночитаемая OpenAPI-спека (открыт всегда, как /healthz) |
| GET/POST /api/v1/projects | список/создание проектов |
| GET/PATCH /api/v1/projects/:slug | карточка/изменение (RELEASED → 409 без G6) |
| GET /api/v1/projects/:slug/gates | вычисленные ворота G0–G6 + решения |
| POST /api/v1/projects/:slug/gates/:code/approve | одобрение (G0/G6 — owner-only) |
| POST /api/v1/projects/:slug/gates/:code/reject | отклонение |
| GET/POST /api/v1/projects/:slug/artifacts | артефакты; POST проверяет SHA-256 (409 при расхождении) |
| GET/POST /api/v1/jobs, POST /:id/run, /:id/cancel | задания и конвейер code_task→build_run→test_run |
| GET /api/v1/events | журнал событий жизненного цикла |
| POST /api/v1/sync | батч-синхронизация офлайн-операций (idempotency, конфликты LWW) |
| GET/POST /api/v1/releases | реестр релизов; POST — правила каналов ↔ G5/G6 |
| GET /api/v1/updates/latest | UPDATE MANAGER v1 (семвер-сравнение) |
| GET/PUT /api/v1/settings | настройки фабрики |
| WS /ws | живые события store; при включённой аутентификации — токен (`?token=` или Bearer на upgrade), иначе 401 |

Аутентификация (v0.7.0): все `/api/v1/*` требуют `Authorization: Bearer <token>`;
токены задаются в `NF_AUTH_TOKENS` (`token:role`). Роли: owner — всё;
engineer — рабочие операции (projects/jobs/sync) без ворот approve/reject,
релизов и настроек; viewer — только GET. Без токенов — открытый режим.
`/healthz` и пути вне `/api/v1/` открыты всегда.

## 5. Модель данных (фактическая, in-memory + снапшот)

14 сущностей контракта `core-contracts`: Project (с revision), LifecycleEvent,
Job, Artifact, RunnerLog, Gate, Release, FactorySettings и др. Полная схема
PostgreSQL — `migrations/0001_init.sql` (применение и CHECK-ограничения
проверены на pg-mem-эмуляции; реальный PG — NOT TESTED).

## 6. Жизненный цикл проекта

14 статусов: IDEA → ANALYSIS → SPECIFICATION → ARCHITECTURE → DEVELOPMENT →
TESTING → AUDIT → APPROVED → BUILDING → RELEASE_CANDIDATE → RELEASED →
MAINTENANCE; BLOCKED и ARCHIVED. Переход в RELEASED запрещён без утверждённого
G6 и всех критериев приёмки DONE (проверяется в REST и sync).

## 7. Ворота качества

G0 (спецификация) → G1 (архитектура) → G2 (сборка) → G3 (тесты) → G4 (аудит
безопасности) → G5 (установщики + контрольные суммы) → G6 (релиз, owner-only).
Каждое: requiredArtifacts, requiredChecks, approver, критерии; evaluate/approve/reject
с защитой от авто-одобрения критических ворот.

## 8. Офлайн/онлайн

Клиент: GET-кэш в localStorage с честным маркером; мутации при сетевом сбое —
в очередь (IndexedDB, fallback localStorage), авто-flush при переподключении WS/online.
Сервер: батч-эндпоинт с idempotency (duplicate), конфликтами (stale baseRevision
→ conflict с серверной версией) и инкрементом revision.

## 9. Безопасность

Ключи AI — только как key_ref; smoke-test до включения провайдера; RUNNER —
whitelist команд, маскировка секретов в логах, таймауты; артефакты — SHA-256
верификация; SAST + сканер секретов в CI; аутентификация и роли (owner/engineer/
viewer) через Bearer-токены из `NF_AUTH_TOKENS`. Подробно — docs/SECURITY.md.

## 10. Известные ограничения (честно)

- PostgreSQL/pg-boss: NOT TESTED (нет PG в среде разработки).
- Хранение auth-токенов в переменной среды — промежуточное решение; интеграция
  с секретным хранилищем не реализована.
- AI-провайдеры: BLOCKED без ключей владельца; задания честно падают.
- Android/iOS: NOT IMPLEMENTED (нужны тулчейны).
- Подпись артефактов и автообновление с загрузкой: NOT IMPLEMENTED (нужны сертификаты).
- Интерактивная установка/удаление установщиков на реальных ОС: NOT TESTED.
