# AUDIT — STAGE 0 (NEUROOS APP FACTORY)

Версия: 1.0 · Дата: 2026-11-11 · Среда: Vibe Code (изолированная песочница Linux)

## 1. Что проверялось

1. Полнота и непротиворечивость входных нормативных документов.
2. Наличие существующей кодовой базы NeuroOS Core для аудита (§10 «Промпт 1»).
3. Соответствие подготовленных документов STAGE 0 требованиям «Промпт 1» §12–§13.

## 2. Выполненные команды

| Команда | Результат |
|---|---|
| `ls -la /mnt/vibefs/uploads/…/` (оба сообщения) | 3 файла: PRODUCT_BUILD_STANDARD.md, «Промпт 1.docx», «003 промпт.docx» |
| извлечение текста .docx (python, unzip word/document.xml) | «Промпт 1» — 8 281 зн., «003 промпт» — 28 050 зн.; текст извлечён полностью |
| сравнение «003 промпт.docx» с PRODUCT_BUILD_STANDARD.md | идентичное содержание (md — нормализованная версия docx) |
| `ls -la /workspace/`, поиск `*neuroos*` | рабочая область пуста; репозиторий NeuroOS Core не обнаружен |

## 3. Полученные результаты

- «Промпт 1» определяет продукт (APP FACTORY), 13 модулей, мультипровайдерность,
  жизненный цикл (14 состояний), реестр артефактов, Gates G0–G6, безопасность,
  дизайн-систему, список технологий для анализа, 13 обязательных документов STAGE 0.
- «003 промпт» (стандарт) определяет требования к произведённым продуктам: платформы,
  единая архитектура, Offline+Online, дизайн, функциональность, безопасность, сборка,
  автоматизация, STAGE 0–8, NO FAKE SUCCESS, критерии приёмки, шаблон входных данных (§15).
- Противоречий между документами не выявлено: стандарт описывает производство продуктов,
  «Промпт 1» — производство фабрики; Приложение A стандарта связывает этапы с модулями
  фабрики, что и отражено в MODULES.md §3.

## 4. Созданные/изменённые файлы

```
/workspace/neuroos-app-factory/
├── README.md
└── docs/
    ├── PRODUCT_VISION.md
    ├── REQUIREMENTS.md
    ├── ARCHITECTURE.md
    ├── MODULES.md
    ├── DATA_MODEL.md
    ├── PROJECT_LIFECYCLE.md
    ├── AI_PROVIDER_ARCHITECTURE.md
    ├── ARTIFACT_REGISTRY.md
    ├── SECURITY_MODEL.md
    ├── QUALITY_GATES.md
    ├── IMPLEMENTATION_ROADMAP.md
    └── AUDIT.md
```

## 5. Тесты

- **Пройдено:** структурная проверка комплекта (13/13 документов существуют, ссылки
  между документами согласованы), извлечение текста из обоих .docx выполнено фактически.
- **Не прогонялись:** сборка, unit/интеграционные тесты, тесты ИИ-провайдеров — на
  STAGE 0 код не пишется по требованию §16 стандарта и §12 «Промпт 1». Соответственно,
  технические утверждения документов имеют статус PROPOSED, не DONE.

## 6. Выявленные ограничения

1. **BLOCKED — аудит NeuroOS Core.** Репозиторий Core не передан; анализ существующей
   структуры, соглашений и повторно используемых компонентов выполнен только на уровне
   нормативных ссылок (React + Vite, Tauri 2 — ADR-F-002/003). Требуется доступ владельца.
2. **NOT TESTED — ИИ-провайдеры.** Доступы и проверка API провайдеров отсутствуют;
   в реестре нет ни одного включённого провайдера (честно, «Промпт 1» §4).
3. **BLOCKED — сборки под Windows/macOS/iOS.** Среда песочницы — Linux; сборка этих
   платформ возможна только через CI-матрицу (STAGE 5+) или предоставление целевых ОС.
4. **NOT IMPLEMENTED — весь код.** STAGE 0 — только анализ и подготовка; реализация
   начинается с STAGE 1 после утверждения GATE 0/GATE 1 владельцем.
5. Git-репозиторий проекта не инициализирован: без решения владельца о месте хранения
   (GitHub-репозиторий) инициализация отложена.

## 7. Невыполненные критерии (остаются открытыми)

- GATE 0/GATE 1 фабрики не утверждены владельцем — документы в статусе PROPOSED.
- Согласование стека (ARCHITECTURE.md §1.2) — предложение, требует подтверждения.
- Повторное использование компонентов NeuroOS Core — не оценено (нет доступа).

## 8. Подтверждённый статус этапа

**STAGE 0 — PARTIAL (готов к утверждению).**
Причина: все 13 обязательных документов подготовлены и отражают фактический анализ
входных документов; но аудит существующего NeuroOS Core заблокирован отсутствием
репозитория, ИИ-провайдеры не проверены, утверждение Gates владельцем не выполнено.
Ни один пункт не помечен DONE без фактического подтверждения.

---

# STAGE 1 — FOUNDATION: аудит выполнения

## 1. Выполненные команды (фактические, в песочнице)

| Команда | Результат |
|---|---|
| `pnpm install` | OK — 150 пакетов, lockfile создан; postinstall esbuild разрешён явно (`pnpm.onlyBuiltDependencies`) |
| `pnpm typecheck` (= `pnpm -r build && pnpm -r typecheck`) | OK — 5 проектов: core-contracts, design-system, runner, server, web. Ошибок нет |
| `pnpm build` | OK — 3 пакета дают `dist/` (+ .d.ts), `apps/web/dist/` собран Vite (143.43 kB JS / gzip 46.22 kB) |
| `pnpm test` | OK, exit 0 — **11 тестов пройдено**: core-contracts 1, design-system 1, runner 7, server 2 |
| smoke-тест сервера (`node dist/main.js`, loopback :3123) | OK — healthz 200; POST /api/v1/projects 201 (7 платформ, status IDEA, stage 0); список 200; дубль slug → 409; невалидное имя → 400 |
| `git init -b main && git add -A` | OK — 44 файла в индексе, node_modules/dist не попали (.gitignore работает) |

## 2. Найденные и исправленные проблемы при верификации

1. **pnpm 10 блокировал postinstall esbuild** → сборка Vite упала бы. Исправлено: `pnpm.onlyBuiltDependencies: ["esbuild"]` в корневом package.json.
2. **`@neuroos/core-contracts` не резолвился** (types указывали на ещё не собранный `dist/index.d.ts`) — 4 ошибки tsc в runner. Исправлено: скрипт `typecheck` теперь выполняет `pnpm -r build` перед `pnpm -r typecheck`.
3. **`apps/web` без тестов** — `vitest run` возвращал exit 1. Исправлено: скрипт `test` удалён из web (честно: UI-тестов пока нет, только typecheck+build).

## 3. Честные статусы компонентов STAGE 1

| Компонент | Статус | Подтверждение |
|---|---|---|
| Монорепо (pnpm-workspace, tsconfig.base, CI) | DONE | install/typecheck/build/test прошли локально; CI-пайплайн в GitHub НЕ прогонялся (нет подключения) |
| core-contracts (типы домена) | DONE | typecheck + 1 тест |
| design-system (токены, палитра) | DONE | typecheck + 1 тест, tokens.css |
| runner v1 (whitelist, timeout, mask, sha256) | DONE | 7 тестов, включая реальный запуск процессов, kill по таймауту, отклонение `rm -rf /` |
| server (Fastify: healthz, projects CRUD) | DONE | 2 inject-теста + живой smoke-тест на :3123 |
| web (React+Vite оболочка) | PARTIAL | typecheck + production build OK; UI-тестов нет, экранов нет (STAGE 2) |
| Схема БД (migrations/0001_init.sql) | NOT TESTED | PostgreSQL в песочнице не поднимался; применена будет на STAGE 2 (нужен PG 15+) |
| Git-репозиторий | DONE (локально) | init + commit выполнены; удалённый (GitHub) не подключён |

## 4. Ограничения этапа (не скрыты)

- CI в GitHub Actions не запускался — GitHub не подключён в сессии; workflow написан, но NOT TESTED в облаке.
- Windows/macOS/iOS-сборки — BLOCKED (среда Linux; матрица CI на STAGE 5).
- БД-схема не применялась к реальному PostgreSQL — NOT TESTED.
- GATE 0/GATE 1 по-прежнему не утверждены владельцем формально.

## 5. Подтверждённый статус этапа

**STAGE 1 — DONE (по локальной верификации) / PARTIAL (в целом).**
Весь код установлен, собран, типизирован и протестирован в песочнице с реальными
командами и реальными кодами выхода; живой HTTP smoke-тест пройден. Этап считается
завершённым локально; до полного DONE остаётся: прогон CI на GitHub, применение
схемы БД на реальный PostgreSQL, утверждение GATE 1 владельцем.

---

# STAGE 2 — UI/UX ФАБРИКИ: аудит выполнения

## 1. Выполненные команды (фактические)

| Команда | Результат |
|---|---|
| `pnpm typecheck` | OK, exit 0 — 5 проектов |
| `pnpm build` | OK, exit 0 — web bundle 182.15 kB JS (gzip 58.94 kB), 3.87 kB CSS |
| `pnpm test` | OK, exit 0 — **21 тест**: core-contracts 1, design-system 1, runner 7, server 9, web 3 |
| Живой smoke-тест (node, loopback :3124) | OK — сервер поднят; WS-клиент подключился и получил события `project.created`, `project.updated`, `job.created`; создан проект, статус изменён на ANALYSIS, задача build_run поставлена в очередь; overview вернул корректные агрегаты |

## 2. Что реализовано

**Сервер (apps/server):**
- Хранилище состояния (store.ts): проекты, события, задачи, артефакты, релизы, настройки; подписка на события.
- API v0.2.0: `GET /api/v1/overview` (агрегаты + последние события), `GET/POST /api/v1/projects`, `GET /api/v1/projects/:slug`, `PATCH /api/v1/projects/:slug` (валидация статуса из 14 состояний и этапа 0–8, запись lifecycle-события при смене статуса), `GET /api/v1/events`, `GET/POST /api/v1/jobs` (валидация kind, 404 проекта, идемпотентность ключа → 409), `POST /api/v1/jobs/:id/cancel` (409 для завершённых), `GET /api/v1/artifacts`, `GET /api/v1/releases`, `GET/PUT /api/v1/settings`.
- WebSocket `/ws` (@fastify/websocket v11): широковещательная рассылка событий состояния всем подключённым клиентам.

**Контракты (packages/core-contracts):** добавлены `Release`, `ReleaseChannel`, `FactorySettings`; `Job` расширен временными метками и `error` (обратимо-совместимо).

**Дизайн-система (packages/design-system):** тёмная и светлая темы (`data-theme`), токены границ/приглушённого текста.

**Веб (apps/web):** React Router (hash-роутинг), сайдбар-навигация, индикатор WS-подключения (честный offline-статус с авто-переподключением), лента live-событий; 8 экранов: Global Dashboard, Projects Dashboard (создание проектов), Project Workspace (карточка, смена статуса, история, задачи), AI Workspace (честный статус «провайдеры отключены»), Build Center (очередь задач, постановка, отмена), Audit Center (журнал), Release Center (честный пустой реестр), Settings (тема, offline, ИИ — с сохранением на сервер). Адаптивность ≤800px.

## 3. Найденные и исправленные проблемы

1. `createApp` стал async (регистрация WS-плагина) — обновлены main.ts и тесты.
2. @fastify/websocket v11: соединение — сам WebSocket (без `.socket`) — исправлено после ошибки сборки.
3. Тесты web требуют jsdom — добавлены `test.environment` в vite.config и devDeps (jsdom, @testing-library/react).

## 4. Честные статусы

| Компонент | Статус |
|---|---|
| API сервера (12 эндпоинтов + WS) | DONE — 9 тестов + живой smoke |
| 8 экранов UI | DONE (рендер + данные API подтверждены 3 тестами jsdom; визуальная приёмка владельцем не выполнялась) |
| WebSocket-статусы | DONE — живой тест: события доставлены |
| Исполнение задач (RUNNER/pg-boss) | NOT IMPLEMENTED — STAGE 3, задачи честно остаются queued |
| ИИ-провайдеры | BLOCKED — нет ключей, smoke-тест не проводился |
| Персистентность (PostgreSQL) | NOT IMPLEMENTED — состояние in-memory, схема ждёт STAGE 3 |
| Аутентификация/роли | NOT IMPLEMENTED — STAGE 3+ |

## 5. Подтверждённый статус этапа

**STAGE 2 — DONE (по локальной верификации) / PARTIAL (в целом).**
Работающий интерфейс с реальными данными API (не макет): все экраны читают живой
API, создание проектов и постановка задач реально работают, статусы приходят по
WebSocket. До полного DONE: исполнение задач (STAGE 3), персистентность,
утверждение GATE 2 владельцем.

---

# STAGE 3 — CORE FUNCTIONALITY: аудит выполнения

## 1. Выполненные команды (фактические)

| Команда | Результат |
|---|---|
| `pnpm install` | OK — gate-service и ai-provider зарегистрированы в lockfile |
| `pnpm --filter @neuroos/gate-service typecheck` | OK |
| `pnpm --filter @neuroos/gate-service test` | OK — 12 тестов |
| `pnpm --filter @neuroos/ai-provider typecheck` | OK |
| `pnpm --filter @neuroos/ai-provider test` | OK — 12 тестов (мок fetch) |
| `pnpm typecheck` (все 7 проектов) | OK |
| `pnpm build` | OK |
| `pnpm test` | OK — 54 теста в монорепо |
| Живой smoke-тест (node, loopback :3457) | OK — полный пайплайн: проект → критерии → code_task (каркас + git init) → build_run (node index.js, exit 0) → test_run (node --test, exit 0) → артефакты source_ref/build_log/test_report → ai_task честно failed → G2/G3 eligible → spec-артефакт → G0 approved → PATCH RELEASED → **409 отклонён** |

## 2. Что реализовано

**packages/gate-service (@neuroos/gate-service):** определения G0–G6 из QUALITY_GATES.md (обязательные артефакты, проверки, утверждающий, критерии); `evaluateGate`/`evaluateAllGates` (missing в формате `artifact:<kind>` / `check:<key>`); `approveGate` (owner-only для G0/G6, отказ через `GateApprovalError` с перечнем недостающего); `rejectGate`; `assertTransition` (RELEASED требует G6 approved + все критерии DONE). 12 тестов.

**packages/ai-provider (@neuroos/ai-provider):** контракт `AIProvider.complete({model, taskKind, messages, timeoutMs, idempotencyKey}) → AIResult` (дискриминированное объединение ok/error|rate_limited|timeout); `MistralProvider` (fetch api.mistral.ai, AbortController-таймаут, 429 → rate_limited); `smokeTest` (обязательный проверочный вызов, §4 AI_PROVIDER_ARCHITECTURE.md); `ProviderRegistry` — провайдеры отключены до успешного smoke-теста, хранится только `key_ref`, ключ никогда не логируется (тест гигиены ключа). 12 тестов на мокнутом fetch.

**Сервер (apps/server) — API v0.3.0:**
- `state.gates` в FactoryState; события `gate.updated`, `artifact.created` в шине и WS-броадкастах.
- Гейты: `GET /api/v1/projects/:slug/gates` (7 оценок + сохранённые решения), `POST .../gates/:code/approve` (409 с missing при отказе), `POST .../gates/:code/reject`.
- Жёсткое правило релиза: `PATCH /api/v1/projects/:slug` со статусом RELEASED → **409** без G6 approved и критериев DONE (assertTransition).
- Реестр артефактов: `POST /api/v1/projects/:slug/artifacts` — contentBase64 + заявленный sha256, **409 при несовпадении** SHA-256, запись файла в `data/artifacts/{projectId}/{kind}/{version}/{filename}`; `GET /api/v1/artifacts?projectId=`.
- Воркер задач: `POST /api/v1/jobs/:id/run` — code_task (каркас package.json/index.js/index.test.js + git init через RUNNER), build_run (`node index.js`), test_run (`node --test`), регистрация артефактов build_log/test_report/source_ref; AI-задачи без провайдера → **честный failed** с причиной; audit_run/release/update_publish → честный failed «не реализована в STAGE 3».

**UI (apps/web):** панель гейтов G0–G6 в Project Workspace (eligible, missing, утвердить/отклонить), кнопка «Запустить» и отображение ошибок задач в Build Center, обновлённые честные подсказки.

## 3. Честные статусы

| Компонент | Статус |
|---|---|
| Gate-сервис G0–G6 | DONE — 12 тестов + живой smoke |
| AI-провайдер слой (контракт, smoke, реестр) | DONE — 12 тестов на моках |
| Подключение реального ИИ-провайдера | BLOCKED — нет ключей; smoke-тест к api.mistral.ai не проводился |
| Воркер задач (code/build/test) | DONE — живой smoke: каркас собран и протестирован фактически |
| Реестр артефактов с SHA-256 | DONE — mismatch → 409 подтверждён |
| RELEASED-защита | DONE — 409 подтверждён живым тестом |
| PostgreSQL/pg-boss персистентность | NOT TESTED — схема 0001_init.sql не применялась (нет PG в песочнице); состояние in-memory + файлы |
| Аутентификация/роли | NOT IMPLEMENTED — утверждение гейтов идёт от имени owner без проверки личности |
| audit_run / release / update_publish | NOT IMPLEMENTED — честный failed (STAGE 4+) |
| Windows/macOS/iOS сборки | BLOCKED — Linux-песочница (STAGE 5) |

## 4. Подтверждённый статус этапа

**STAGE 3 — DONE (по локальной верификации) / PARTIAL (в целом).**
Работающий конвейер «идея → каркас проекта → тесты → гейты» (GATE 3 фабрики по роадмапу):
задачи исполняются фактически через RUNNER, артефакты регистрируются с контролем SHA-256,
гейты оцениваются и утверждаются по правилам QUALITY_GATES.md, преждевременный RELEASED
отклоняется сервером. До полного DONE этапа: персистентность (STAGE 4), реальный ИИ-провайдер
(ключи от владельца), роли/аутентификация, утверждение гейтов владельцем.

---

# STAGE 4 — OFFLINE / ONLINE: аудит выполнения

## 1. Выполненные команды (фактические)

| Команда | Результат |
|---|---|
| `pnpm install` | OK — sync-engine в lockfile |
| `pnpm --filter @neuroos/sync-engine typecheck && test` | OK — 10 тестов |
| `pnpm typecheck` / `pnpm build` / `pnpm test` | OK — 8 проектов, **72 теста** зелёные |
| Живой smoke-тест (node, loopback :3458/:3459) | OK — гибридная модель: офлайн-очередь накопила 2 операции (flush не отправил ничего), после goOnline обе применены через `POST /api/v1/sync` (revision 1→3, правки не потеряны); после рестарта сервера состояние восстановлено из снапшота |

## 2. Что реализовано

**packages/sync-engine (@neuroos/sync-engine):**
- `KVAdapter` (get/set/delete/keys) + `MemoryKV`; адаптер — точка расширения для IndexedDB (браузер) и файлового хранилища.
- `OperationQueue`: постановка с idempotency-ключом (дубликат не ставится дважды), статусы pending/synced/conflict/failed, `markAttempted` с ошибкой, `requeueFailed`, `clearSynced`, порядок по времени создания.
- `resolveLWW` — разрешение конфликтов Last-Writer-Wins с вектором версий (updatedAt → revision → remote).
- `SyncClient`: transport-абстракция, `goOffline`/`goOnline`, flush очереди (applied/duplicate/conflict/rejected), подключаемый разрешатель конфликтов, события onFlushed/onConflict. 10 тестов, включая обязательный сценарий «переключение режимов без потери данных».

**Сервер (apps/server) — API v0.4.0:**
- `packages/core-contracts`: `Project.revision?: number` (вектор версий для LWW).
- Персистентность: `persistence.ts` — JSON-снапшот состояния (атомарная запись через tmp+rename), загрузка при старте, отложенная запись по подписке на события стора; `CreateAppOptions.persistPath`, `flushPersistence()`.
- `POST /api/v1/sync` — батch операций клиента: create_project / patch_project; **idempotency** (повтор операции → duplicate), **конфликты** (stale baseRevision → outcome conflict с серверной версией), валидация и RELEASED-правило внутри sync.
- revision инкрементируется при создании (1) и каждом PATCH.

**Веб (apps/web):** offline-кэш GET-ответов в localStorage; при сетевом сбое — отдача кэша с честным маркером «Офлайн: показаны кэшированные данные» (data-testid="offline-cache"); без кэша — честная ошибка с retry. 2 новых jsdom-теста.

## 3. Честные статусы

| Компонент | Статус |
|---|---|
| Sync-engine (очередь, idempotency, LWW) | DONE — 10 тестов + живой smoke |
| Серверная персистентность (fs-снапшот) | DONE — рестарт восстановил состояние (живой тест) |
| PostgreSQL/pg-boss | NOT TESTED — по-прежнему нет PG в песочнице; fs-снапшот — промежуточное решение, честно задокументировано |
| Sync-эндпоинт (батч, дубликаты, конфликты) | DONE — 4 теста |
| Offline-кэш UI с честной индикацией | DONE — 2 jsdom-теста |
| IndexedDB-адаптер для браузера | NOT IMPLEMENTED — интерфейс KVAdapter готов, браузерный адаптер — STAGE 5 (PWA) |
| Полный offline-режим UI (все мутации через очередь) | PARTIAL — очередь и sync-протокол готовы и проверены; мутации UI пока идут напрямую, интеграция экранов с очередью — STAGE 5 |

## 4. Подтверждённый статус этапа

**STAGE 4 — DONE (по локальной верификации) / PARTIAL (в целом).**
Проверенная гибридная модель: работа без сети не теряет данные (обязательный тест пройден
фактически), конфликты разрешаются LWW + вектором версий, состояние переживает рестарт.
До полного DONE: IndexedDB-адаптер и перевод мутаций UI через очередь (STAGE 5, PWA),
PostgreSQL-персистентность (нужен PG).

---

# STAGE 5 — Multiplatform (аудит)

## 1. Что сделано

**Оболочка Tauri 2 (src-tauri/):**
- `tauri.conf.json` — схема v2: productName «NeuroOS App Factory», identifier `com.neuroos.appfactory`, frontendDist `../apps/web/dist`, devUrl :5173, окно 1280×800 (мин. 900×600), bundle targets all, иконки.
- `Cargo.toml` (tauri 2, tauri-build 2, crate-type staticlib/cdylib/rlib), `build.rs`, `src/lib.rs` (`tauri::Builder::default().run(generate_context!())`, mobile_entry_point), `src/main.rs`, `capabilities/default.json` (core:default).
- Иконки: 4 PNG сгенерированы (32×32, 128×128, 128×128@2x, 512) — дизайн: фон #111827, круг #18D6D1 (селадон), рамка #033438. icns/ico генерируются в CI (`tauri icon`).

**PWA (apps/web):**
- `public/manifest.webmanifest` — name, icons 32/128/256/512, display standalone, theme #111827, lang ru.
- `public/sw.js` — кэш `nf-cache-v1`: network-first для `/api/` с fallback на кэш, cache-first для статики; APP_SHELL.
- `src/main.tsx` — регистрация SW только в production (`import.meta.env.PROD`), с guard.
- `index.html` — theme-color, manifest link, favicon.
- `src/vite-env.d.ts` — типы vite/client для `import.meta.env`.

**Офлайн-очередь в UI:**
- `packages/sync-engine`: новый `LocalStorageKV` (prefix 'nf-kv:') — браузерный KV-адаптер; 2 jsdom-теста (изоляция префиксов, переживание пересоздания адаптера).
- `apps/web/src/offlineQueue.ts` — очередь мутаций на LocalStorageKV('nf-queue:'), transport → POST /api/v1/sync, `QueuedOfflineError`, subscribe/pendingCount/requeueFailed.
- `apps/web/src/api.ts` — `withOfflineFallback`: createProject и patchProject при сетевом сбое (TypeError) ставятся в очередь; API-ошибки (ApiError) в очередь НЕ попадают (честное различение).
- `apps/web/src/components/Layout.tsx` — чип «в очереди: N» (data-testid="pending-ops"), авто-flush при переподключении WS и событии window 'online'.
- 3 jsdom-теста offlineQueue: очередь при сетевом сбое + flush без потери данных; API-ошибки не ставятся в очередь; failed-операции возвращаются в очередь.

**CI-матрица десктоп-сборок (.github/workflows/desktop.yml):**
- windows-latest → nsis, msi; macos-latest → app, dmg; ubuntu-latest → appimage, deb, rpm.
- ubuntu: system deps libwebkit2gtk-4.1-dev и др.; rust stable; генерация иконок `tauri icon`.
- tauri-apps/tauri-action@v0: черновой релиз по тегу v__VERSION__ — публикация вручную после G6.
- Триггеры: workflow_dispatch + push тегов 'v*'. Автозапуск отключён (долгая сборка на 3 ОС — по решению владельца).

**Каталог релизов:** `releases/README.md` — структура, каналы stable/beta/alpha/dev, связь с G5/G6, честный статус.

## 2. Верификация

- `pnpm typecheck` — 0 ошибок (все 8 пакетов/приложений).
- `pnpm build` — OK, включая vite build (189.71 kB gzip 61.33 kB); PWA-файлы (sw.js, manifest.webmanifest, icons/) присутствуют в dist/.
- `pnpm test` — **77 тестов зелёные** (sync-engine 12, web 8, server 24, gate-service 12, ai-provider 12, runner 7, core-contracts 1, design-system 1).
- JSON-конфиги (tauri.conf.json, manifest.webmanifest) — валидны.

## 3. Честные статусы

| Компонент | Статус |
|---|---|
| Tauri 2 конфигурация + Rust-источники | DONE — конфиги валидны, структура соответствует схеме v2 |
| Фактические десктоп-сборки (nsis/msi/dmg/appimage/deb/rpm) | NOT TESTED — требуют запуска CI-матрицы (webkit2gtk отсутствует в Linux-песочнице, Windows/macOS недоступны); запуск — по решению владельца |
| PWA (манифест + service worker + регистрация) | DONE — файлы в dist/, сборка проверена |
| LocalStorageKV-адаптер | DONE — 2 jsdom-теста |
| Офлайн-очередь мутаций в UI | DONE — 3 jsdom-теста, честное различение сетевых сбоев и API-ошибок |
| Авто-flush при переподключении | DONE — WS reconnect + window 'online' |
| CI-матрица десктоп-сборок | DONE (конфигурация) / NOT TESTED (исполнение) — workflow закоммичен, запуск только вручную |
| Каталог /releases/ | DONE — README со структурой и каналами; артефакты появятся после первой CI-сборки |
| Android/iOS | NOT IMPLEMENTED — нужны мобильные тулчейны (STAGE 6) |
| Подпись артефактов | NOT IMPLEMENTED — STAGE 7 (нужны сертификаты владельца) |

## 4. Подтверждённый статус этапа

**STAGE 5 — DONE (по локальной верификации) / PARTIAL (в целом).**
Кроссплатформенная оболочка, PWA и офлайн-очередь в UI реализованы и проверены тестами и сборкой.
До полного DONE: фактический прогон CI-матрицы на трёх ОС (требует решения владельца — многоминутная сборка),
Android/iOS (STAGE 6).

---

# STAGE 6 — Testing & Security (аудит)

## 1. Что сделано

**Полный прогон тестов:** 81 тест зелёный (14 файлов): core-contracts 1, design-system 1, gate-service 12, ai-provider 12, runner 7, sync-engine 12, server 28, web 8. Функциональные, интеграционные, offline/online сценарии — пройдены.

**Новые тесты (apps/server/src/stage6.test.ts, 4 теста):**
- Восстановление из бэкапа: снапшот → копия → restore в чистый инстанс (имя, статус, revision точны).
- Повреждённый снапшот: честный старт с default state без падения.
- Perf-smoke: 100 созданий проектов + листинг < 10 c; sync-батч 50 операций, все applied.

**SAST:** `scripts/security-scan.mjs` (режим sast) — eval/new Function/dangerouslySetInnerHTML/innerHTML/exec-интерполяция/shell:true; 0 находок. TypeScript strict везде; typecheck 0 ошибок.

**Сканер секретов:** тот же скрипт (режим secrets) — приватные ключи, ghp_/github_pat_, AKIA, xox*, Bearer, env-присваивания; контекстный фильтр для 32-символьных ключей (устранён false positive на TS-идентификаторе). 0 находок по репозиторию; секретных файлов в git нет. Self-test на фикстуре с AWS-ключом — детект корректный.

**Аудит зависимостей:** `pnpm audit --prod` нашёл 2 moderate (react-router < 7.18.0, транзитивно через react-router-dom). Устранено: react-router-dom ^6.30.6 → ^7.18.0; повторный аудит — 0 уязвимостей; тесты и typecheck после обновления зелёные.

**Права доступа:** world-writable файлов нет; .gitignore покрывает .env/.env.*, node_modules, dist, coverage; owner-only G0/G6 и RELEASED-правило покрыты тестами. Исправлен дефект: `releases/` в .gitignore исключал releases/README.md из репозитория — заменено на `releases/*` + `!releases/README.md`.

**CI:** в ci.yml добавлены шаги «Security scan (secrets + SAST)» (блокирующий) и «Dependency audit» (continue-on-error, честно виден в логе).

**Отчёт:** `docs/TEST_REPORT.md` — полный тест-отчёт этапа.

## 2. Верификация

- `pnpm typecheck` — 0 ошибок; `pnpm build` — OK; `pnpm test` — 81 зелёный.
- `node scripts/security-scan.mjs all` — secrets OK, sast OK.
- `pnpm audit --prod` — No known vulnerabilities found.

## 3. Честные статусы

| Компонент | Статус |
|---|---|
| Функциональные/интеграционные тесты | DONE — 81 зелёный |
| Восстановление из бэкапа | DONE — 2 теста (restore + corrupted) |
| Perf-smoke | DONE — 2 теста со свободными бюджетами |
| SAST (паттерн-сканер) | DONE — 0 находок, в CI |
| Сканер секретов | DONE — 0 находок, self-test пройден, в CI |
| Аудит зависимостей | DONE — 2 moderate найдены и устранены; шаг в CI |
| Проверка прав доступа | DONE — файлы/gitignore/ворота |
| Нагрузочное тестирование | NOT TESTED — вне объёма smoke |
| PostgreSQL/pg-boss | NOT TESTED — нет PG в песочнице |
| SAST класса Semgrep/CodeQL, DAST | NOT IMPLEMENTED — собственный паттерн-сканер как промежуточное решение |
| Мобильные платформы (Android/iOS) | NOT IMPLEMENTED — нужны тулчейны |

## 4. Подтверждённый статус этапа

**STAGE 6 — DONE (по локальной верификации) / PARTIAL (в целом).**
Критических дефектов не обнаружено; 2 moderate-уязвимости зависимостей устранены в рамках этапа.
До полного DONE: нагрузочное тестирование, PG-персистентность, промышленные SAST/DAST-сканеры, мобильные платформы.

---

# Дополнение к STAGE 5/6 — фактический прогон CI-матрицы десктоп-сборок

Дата: 2026-11-13 · Тег v0.1.0 · Runs: 43433033323 (failure → fix), 43434053581 (SUCCESS)

## Что проверено фактически

- **CI-матрица desktop.yml отработала на трёх ОС — SUCCESS** (run 43434053581):
  - windows-latest → `NeuroOS.App.Factory_0.1.0_x64-setup.exe` (1.88 MB), `..._x64_en-US.msi` (2.82 MB)
  - macos-latest → `..._0.1.0_aarch64.dmg` (2.74 MB), `..._aarch64.app.tar.gz` (2.69 MB)
  - ubuntu-latest → `..._amd64.AppImage` (82.48 MB), `..._amd64.deb` (2.85 MB), `...-1.x86_64.rpm` (2.86 MB)
- Черновой релиз v0.1.0 создан автоматически (draft: true — публикация вручную после G6, правило соблюдено).
- Контрольные суммы SHA-256 всех 7 артефактов вычислены и зафиксированы: `releases/v0.1.0/checksums-sha256.txt`.

## Исправления по ходу

1. Первый прогон: tauri-action не смог создать релиз — `Resource not accessible by integration (create-a-release)`; GITHUB_TOKEN по умолчанию read-only. Фикс: `permissions: contents: write` в desktop.yml (коммит 1293466).
2. Загрузка checksums как ассета релиза через gh API запрещена правами App-инсталляции — суммы зафиксированы в репозитории вместо ассета (честная альтернатива).

## Обновлённые статусы STAGE 5

| Компонент | Было | Стало |
|---|---|---|
| Фактические десктоп-сборки | NOT TESTED | **DONE** — 7 артефактов собраны CI на 3 ОС |
| CI-матрица (исполнение) | NOT TESTED | **DONE** — run SUCCESS |
| Контрольные суммы (G5) | отсутствовали | **DONE** — SHA-256 в releases/v0.1.0/ |
| Публикация релиза | — | Блокирована осознанно: draft до утверждения G6 владельцем |

**G5 (installer + checksum): артефакты присутствуют — installer (7 шт.) и checksum (SHA-256). Формальное одобрение G5 — за владельцем.**

---

# Публикация релиза v0.1.0 (решение владельца)

Дата: 2026-11-13T13:42:04Z

- Черновой релиз v0.1.0 **опубликован** по прямому решению владельца (ответ «Да» на вопрос о публикации; публикация черновика ожидала решения с момента создания tauri-action).
- Релиз: https://github.com/ekvassp-lang/neuroos-app-factory/releases/tag/v0.1.0 — 7 артефактов (nsis exe, msi, dmg, app.tar.gz, AppImage, deb, rpm) + SHA-256 в `releases/v0.1.0/checksums-sha256.txt`.
- Примечание о воротах: это релиз самой фабрики (v0.1.0), а не проект, созданный внутри фабрики; формальные ворота G0–G6 в приложении применяются к проектам фабрики. Решение о публикации принято владельцем явно и зафиксировано в этом аудите (NO FAKE SUCCESS: публикация — действие владельца, не автоматическое одобрение ворот).

---

# STAGE 7 — Build & Release (аудит)

## 1. Что сделано

**Сборка всех доступных пакетов:** `pnpm -r build` — все 8 пакетов/приложений собираются; десктоп-сборки уже проверены фактически (см. дополнение к STAGE 5: 7 артефактов на 3 ОС, релиз v0.1.0 опубликован).

**RELEASE HUB (API v0.6.0):**
- `POST /api/v1/releases` — регистрация релиза: projectId, version (семвер x.y.z, 400 при нарушении), channel (stable/beta/alpha/dev), notes, artifactIds; дубликат version+channel → 409.
- **Правила каналов, связанные с воротами:** stable требует утверждённых G5 **и** G6 (409 со списком missing); beta — G5; alpha/dev — без ворот. Проверка по фактическим approved-воротам проекта.
- `GET /api/v1/releases` — реестр; событие `release.created` в store/broadcaster (WS).

**UPDATE MANAGER v1:**
- `GET /api/v1/updates/latest?channel=&currentVersion=` — выбирает последнюю версию канала, честное сравнение семвера (числовое: 0.10.0 > 0.2.0), ответ `{latestVersion, updateAvailable, latest}`; пустой канал → 404; невалидный ввод → 400.

**UI (ReleaseCenter → RELEASE HUB):**
- Реестр релизов с каналами; форма регистрации (проект/версия/канал/notes) с честными ошибками (409 missing gates показывается как ошибка API); панель проверки обновлений (канал + текущая версия → «Обновление доступно: vX» / «Актуальная версия»).

## 2. Верификация

- `pnpm typecheck` — 0 ошибок; `pnpm build` — OK; `pnpm test` — **87 зелёных** (server 34: +6 stage7; web 8; остальные без изменений).
- Тесты stage7: dev-релиз без ворот 201; stable без G5/G6 → 409 missing ['G5','G6']; beta после регистрации installer+checksum артефактов и утверждения G5 → 201; дубликат 409; невалидная версия/канал 400; update-check: latest 0.10.0, updateAvailable true/false; пустой канал 404.
- Живой smoke: полный сценарий RELEASE HUB + UPDATE MANAGER на собранном сервере — OK (включая персистентность).

## 3. Честные статусы

| Компонент | Статус |
|---|---|
| Сборка всех пакетов (TS/Rust-конфиг) | DONE — build OK, CI SUCCESS |
| Десктоп-сборки (7 артефактов, 3 ОС) | DONE — см. дополнение к STAGE 5 |
| RELEASE HUB (версии, каналы, notes) | DONE — 6 тестов + живой smoke |
| Правила каналов ↔ ворота G5/G6 | DONE — 409 с honest missing |
| UPDATE MANAGER v1 (проверка обновлений) | DONE — семвер-сравнение, 404/400 честно |
| UI RELEASE HUB | DONE — форма + панель проверки |
| Установка/запуск/обновление/удаление установщиков на реальных ОС | NOT TESTED — нет GUI/ОС-сред в песочнице; установщики собраны CI, но интерактивная установка не проверялась |
| Автообновление (загрузка + применение) | NOT IMPLEMENTED — v1 только проверяет наличие; загрузка/применение — Tauri updater, требует ключей подписи (STAGE 7+ / решение владельца) |
| Подпись артефактов | NOT IMPLEMENTED — нужны сертификаты владельца |
| Android/iOS | NOT IMPLEMENTED — нужны тулчейны |

## 4. Подтверждённый статус этапа

**STAGE 7 — DONE (по локальной верификации) / PARTIAL (в целом).**
RELEASE HUB и UPDATE MANAGER v1 реализованы, серверные правила каналов завязаны на ворота G5/G6, сборки готовы к распространению (релиз v0.1.0 опубликован ранее по решению владельца).
До полного DONE: интерактивная проверка установки/обновления на реальных ОС, подпись артефактов, автообновление с загрузкой, мобильные платформы.

---

# STAGE 8 — Documentation (аудит)

## 1. Что сделано

Финальные версии документации, актуализированные по факту реализации:

- `docs/TECHNICAL_SPECIFICATION.md` — стек, состав монорепозитория, API v0.6.0 (таблица всех endpoints), модель данных, жизненный цикл, ворота, офлайн/онлайн, безопасность, известные ограничения.
- `docs/INSTALLATION.md` — установка из исходников, готовые установщики по платформам (с предупреждением о неподписанных сборках), удаление, восстановление после сбоя (бэкап снапшота), проверка обновлений.
- `docs/BUILD.md` — локальная сборка, требования Tauri по ОС, CI-матрица, контрольные суммы, ограничения.
- `docs/SECURITY.md` — ключи/key_ref, RUNNER, целостность артефактов, ворота как контроль решений, сканирование в CI, честные ограничения (auth NOT IMPLEMENTED).
- `docs/RELEASE_NOTES.md` — v0.1.0 (7 артефактов, канал stable) + история внутренних версий API 0.4.0–0.6.0.
- `docs/TEST_REPORT.md` — финализирован: 87 тестов, дополнение STAGE 7 (RELEASE HUB/UPDATE MANAGER).
- `README.md` — статус STAGE 8, 87 тестов в quick start, таблица всех финальных документов.

## 2. Верификация

- Все документы ссылаются на проверенные факты (номера CI-ранов, количество тестов, пути файлов) — расхождений с кодом нет.
- `pnpm test` — 87 зелёных; CI — SUCCESS.

## 3. Честные статусы

| Документ | Статус |
|---|---|
| README, TECHNICAL_SPECIFICATION, INSTALLATION, BUILD, SECURITY, RELEASE_NOTES, TEST_REPORT | DONE — финальные версии по факту |
| Инструкции установки/удаления/восстановления | DONE — написаны; интерактивная проверка на реальных ОС — NOT TESTED |
| Документация для конечного пользователя (GUI-гайд) | PARTIAL — инструкции в INSTALLATION; отдельный пользовательский гайд не создавался |

## 4. Подтверждённый статус этапа

**STAGE 8 — DONE.** Полный цикл STAGE 0–8 завершён. Релиз v0.1.0 опубликован.
Оставшиеся честные пробелы (PG, AI-ключи, мобильные платформы, подпись, auth) —
зафиксированы в разделах соответствующих этапов и требуют решений/доступов владельца.

---

# Дополнение (пост-STAGE 8) — Аутентификация и роли, API v0.7.0

## 1. Что сделано

- `apps/server/src/app.ts` — `AuthRole` ('owner' | 'engineer' | 'viewer'),
  `parseAuthTokens` (разбор `NF_AUTH_TOKENS` формата `token:role`, некорректные
  пары игнорируются), `CreateAppOptions.authTokens`, Fastify `onRequest`-hook:
  401 без валидного токена; viewer — только GET (403 на мутации); engineer —
  рабочие операции (projects/jobs/sync) без ворот approve/reject, релизов и
  настроек (403); owner — всё. `/healthz` и пути вне `/api/v1/` открыты всегда.
- `healthz` — версия 0.7.0 + честный статус `auth: "enabled" | "disabled"`.
- `apps/server/src/auth.test.ts` — 7 тестов: разбор токенов, открытый режим,
  401, viewer read-only, матрица engineer, owner (approve после PATCH критериев
  + spec-артефакт, релиз), открытый healthz при защищённом API.
- `docs/USER_GUIDE.md` — новый пользовательский гайд: навигация, типовой
  сценарий, офлайн-работа, аутентификация, таблица частых ошибок.
- `docs/SECURITY.md`, `docs/TECHNICAL_SPECIFICATION.md` — актуализированы
  (auth DONE, API v0.7.0, промежуточное хранение токенов честно отмечено).

## 2. Верификация

- `pnpm test` — 97 зелёных (43 server, 9 web, 45 packages); typecheck — 0 ошибок.
- Живой smoke: открытый режим + защищённый режим (401/403/200 по матрице ролей).

## 3. Честные статусы

| Пункт | Статус |
|---|---|
| Ролевая матрица owner/engineer/viewer | DONE — 7 тестов + smoke |
| Токены через `NF_AUTH_TOKENS` | DONE — промежуточное решение |
| Интеграция с секретным хранилищем | NOT IMPLEMENTED — нужна инфраструктура |
| HTTPS / защита Bearer-токенов на транспорте | ВНЕ СКОУПА репозитория |
| Формальные утверждения ворот G0–G6 владельцем | Ожидает владельца (UI/API) |

---

# Дополнение 2 (пост-STAGE 8) — WebSocket auth и токен в веб-интерфейсе

## 1. Что сделано

- `apps/server/src/app.ts` — `/ws` при включённой аутентификации проверяет токен
  на upgrade (`?token=` или `Authorization: Bearer`); без валидного токена — 401.
- `apps/web/src/api.ts` — `setApiToken`/`getApiToken` (localStorage `nf-token`),
  Authorization во всех запросах; `offlineQueue.ts` — токен в sync-транспорте;
  `hooks.ts` — WebSocket с `?token=`; Settings — карточка «Доступ (токен API)».
- Документация: SECURITY.md, TECHNICAL_SPECIFICATION.md, USER_GUIDE.md, README.

## 2. Верификация

- `pnpm test` — 97 зелёных (43 server, 9 web, 45 packages); typecheck 0 ошибок.
- Новые тесты: WS-reject + WS-delivery + open-mode WS (server), Bearer header
  (web).

## 3. Честные статусы

| Пункт | Статус |
|---|---|
| WS auth (upgrade 401 / token delivery) | DONE — 2 теста |
| Токен в веб-интерфейсе (API + очередь + WS) | DONE — 1 тест + UI |
| Хранение токена в localStorage | промежуточное решение (при HTTPS — приемлемо) |

## 4. Дополнение 2а — фикс security-сканера (root cause CI-падения)

- CI run 43446680950 упал: правило `env-assignment-secret` дало false positive на
  `const TOKEN_KEY = 'nf-token'` (имя localStorage-ключа, не секрет).
- Исправления `scripts/security-scan.mjs`: порог длины значения 8 → 16 символов
  (реальные токены длинные); аргумент пути сканирования теперь реально
  используется (раньше всегда сканировался cwd — самопроверка на фикстурах была
  недействительной, это честно признаётся дефектом инструмента).
- Самопроверка на фикстурах: длинный секрет ловится (exit 1), короткие значения
  и имена ключей — нет; скан репозитория — 0 findings.

---

# Дополнение 3 (пост-STAGE 8) — Матрица трассировки и усиление сканера

## 1. Что сделано

- `docs/TRACEABILITY.md` — новый: каждое требование RF-1…RF-19 и RN-1…RN-7 из
  REQUIREMENTS.md сопоставлено с реализацией (файлы/модули), тестами/артефактами
  и честным статусом. Сводка: DONE 17, PARTIAL 7, BLOCKED (ключи/сертификаты),
  NOT IMPLEMENTED (Android/iOS, IndexedDB, секрет-хранилище, доставка обновлений),
  NOT TESTED (PG, интерактивные установщики).
- `scripts/security-scan.mjs` — новые правила без новых зависимостей:
  секреты — Google API key (AIza…), npm-токен (npm_…); SAST —
  `rejectUnauthorized: false`, динамический `require(переменная)`.

## 2. Верификация

- Фикстуры: rejectUnauthorized:false и динамический require ловятся;
  `require('node:fs')` и `rejectUnauthorized: true` — нет; AIza-ключ и npm-токен
  ловятся. Скан репозитория — 0 findings.
- `pnpm test` — 97 зелёных; typecheck 0 ошибок.

## 3. Честные статусы

| Пункт | Статус |
|---|---|
| Матрица трассировки RF/RN | DONE |
| Сканер: Google/npm секреты, TLS-off, dynamic require | DONE — проверено на фикстурах |
| Промышленный SAST/DAST (Semgrep/CodeQL) | NOT IMPLEMENTED — остаётся промежуточным решением |

---

# Дополнение 4 (пост-STAGE 8) — IndexedDB-адаптер офлайн-очереди

## 1. Что сделано

- `packages/sync-engine/src/index.ts` — `IndexedDBKV` (реализация KVAdapter на
  IndexedDB: get/set/delete/keys, кэш соединения, единый object store).
- `packages/sync-engine` — dev-зависимость `fake-indexeddb` (решение владельца
  получено: «Далее» после явного вопроса о новой зависимости).
- `apps/web/src/offlineQueue.ts` — хранилище очереди: IndexedDB (`nf-sync-kv`)
  при доступности, fallback LocalStorageKV (jsdom/старые браузеры). Автоматический
  перенос очереди из старого localStorage NOT IMPLEMENTED — честно задокументировано.
- Документация: TRACEABILITY (RF-15 → IndexedDB DONE), TECHNICAL_SPECIFICATION
  (§8), TEST_REPORT (дополнение 3), README (100 тестов).

## 2. Верификация

- `pnpm test` — 100 зелёных (43 server, 9 web, 48 packages); typecheck 0 ошибок.
- Новые тесты: 3 (IndexedDBKV CRUD, персистентность между экземплярами,
  OperationQueue поверх IndexedDBKV).

## 3. Честные статусы

| Пункт | Статус |
|---|---|
| IndexedDBKV + OperationQueue поверх него | DONE — 3 теста |
| Очередь в браузере на IndexedDB с fallback | DONE — fallback-ветка покрыта jsdom-тестами |
| Миграция очереди из старого localStorage | NOT IMPLEMENTED (внутренняя v0.1; данные не теряются — старые операции просто остаются в localStorage) |

---

# Дополнение 5 (пост-STAGE 8) — pg-mem smoke миграции, hardening API, 401-подсказка

## 1. Контекст

- Песочница была сброшена между сессиями (/workspace очищен); репозиторий
  клонирован заново из GitHub (HEAD 14ad058), 100 тестов зелёные до начала работ.
- Повторная попытка PostgreSQL: root/docker недоступны (sudo — no new privileges,
  dpkg lock denied) — реальный PG остаётся NOT TESTED.

## 2. Что сделано

- `apps/server/src/migration.test.ts` — 2 теста: миграция применяется на
  pg-mem, CHECK-ограничения работают (невалидные role/gate code отклоняются).
  Статус миграции честно повышен: NOT TESTED → «проверено на pg-mem-эмуляции;
  реальный PG NOT TESTED».
- `apps/server/src/app.ts` — hardening без новых зависимостей: bodyLimit 2 МиБ,
  security-заголовки (nosniff, DENY, no-referrer) через onSend.
- `apps/web/src/hooks.ts` — describeError: 401 дополняется подсказкой про
  Settings → «Доступ (токен API)».

## 3. Верификация

- `pnpm test` — 105 зелёных (47 server, 10 web, 48 packages); typecheck 0 ошибок.

## 4. Честные статусы

| Пункт | Статус |
|---|---|
| Схема 0001_init.sql на pg-mem | DONE — 2 теста (эмуляция) |
| Реальный PostgreSQL/pg-boss | NOT TESTED — нет root/docker в песочнице |
| Hardening (bodyLimit, security-заголовки) | DONE — 2 теста |
| 401-подсказка в UI | DONE — 1 тест |

# Дополнение 6 (пост-STAGE 8) — OpenAPI 3.1 спецификация API v0.7.0

## 1. Контекст

Спецификация API существовала только в виде таблицы в TECHNICAL_SPECIFICATION.md;
машинночитаемого контракта не было. Задача: формализовать API v0.7.0 в OpenAPI
и гарантировать соответствие спеки живым маршрутам тестами.

## 2. Что сделано

- `docs/openapi.json` — OpenAPI 3.1.0, 18 путей, securityScheme `bearerAuth`;
  /healthz и /ws без auth; честные описания ролей и кодов ошибок (401/403/409/413).
- `apps/server/src/openapi.test.ts` — двунаправленная проверка соответствия:
  спека → живой сервер (inject, route-404 = несоответствие) и обязательные
  маршруты → спека. /ws исключён из inject-проверки (light-my-request не делает
  WebSocket-upgrade; WS покрыт auth.test.ts) — пометка честная.
- Исправление в процессе отладки: пустое тело 404 от WS-маршрута ломало
  res.json() — добавлен безопасный разбор.

## 3. Верификация

- `pnpm test` — 108 зелёных (50 server, 10 web, 48 packages); typecheck 0 ошибок.

## 4. Честные статусы

| Пункт | Статус |
|---|---|
| OpenAPI-спецификация API v0.7.0 | DONE — docs/openapi.json, 18 путей |
| Соответствие спека↔сервер (тесты) | DONE — 3 теста |
| /ws в inject-проверке | NOT TESTED — ограничение light-my-request, WS покрыт auth.test.ts |
| Генерация клиентов/сервера из спеки | NOT IMPLEMENTED — не входит в текущий объём |
