# Тест-отчёт — STAGE 6 (Testing & Security)

Дата: 2026-11-13 (финальная версия STAGE 8) · Коммит: см. git log · Среда: Linux-песочница (Node 22, pnpm 10.34.6)

## 1. Функциональные и интеграционные тесты

| Пакет/приложение | Файлов | Тестов | Статус |
|---|---|---|---|
| core-contracts | 1 | 1 | ✓ |
| design-system | 1 | 1 | ✓ |
| gate-service | 1 | 12 | ✓ |
| ai-provider | 1 | 12 | ✓ |
| runner | 1 | 7 | ✓ |
| sync-engine | 2 | 12 | ✓ |
| server (API) | 5 | 34 | ✓ |
| web (UI, jsdom) | 3 | 8 | ✓ |
| **Итого** | **15** | **87** | **все зелёные** |

Покрытые сценарии: полный конвейер job (code_task → build_run → test_run), регистрация артефактов с SHA-256, ворота G0–G6 (включая owner-only для G0/G6), RELEASED-правило (REST + sync), офлайн-очередь без потери данных, LWW-конфликты, персистентность и рестарт, RELEASE HUB (правила каналов ↔ G5/G6), UPDATE MANAGER (семвер-сравнение, честные 404/400).

## 2. Offline/Online

- Обязательный сценарий «переключение режимов без потери данных» — пройден (sync-engine + web offlineQueue).
- Восстановление состояния после рестарта — пройден (stage4.test.ts).
- Восстановление из бэкап-копии снапшота в чистый инстанс — пройден (stage6.test.ts, новое).

## 3. Производительность (smoke, свободные бюджеты)

- 100 × POST /api/v1/projects + GET /api/v1/projects — пройден, бюджет < 10 c (фактически ~1–2 c локально).
- Sync-батч из 50 операций — пройден, все applied, бюджет < 10 c.

Это smoke-проверки с намеренно свободными порогами, а не нагрузочное тестирование.

## 4. SAST

- Скрипт `scripts/security-scan.mjs` (режим sast): поиск eval/new Function/dangerouslySetInnerHTML/innerHTML/exec с интерполяцией/shell:true — **0 находок**.
- TypeScript strict + NodeNext во всех пакетах; typecheck — 0 ошибок.
- Подключено в CI (`.github/workflows/ci.yml`, шаг «Security scan»).

## 5. Сканер секретов

- `scripts/security-scan.mjs` (режим secrets): приватные ключи, ghp_/github_pat_, AWS AKIA, xox*, Bearer-секреты, секреты в env-присваиваниях; 32-символьные ключи — только в контексте key/token/secret (устранён false positive на TS-идентификаторе).
- По репозиторию: **0 находок**. Секретных файлов в git: нет (.env, *.pem, *.key отсутствуют).
- Self-test сканера на фикстуре с AWS-ключом: детектирует корректно.

## 6. Аудит зависимостей

- `pnpm audit --prod`: **найдено 2 moderate** (react-router < 7.18.0, GHSA-337j-9hxr-rhxg и связанное, транзитивно через react-router-dom).
- Устранено: react-router-dom обновлён ^6.30.6 → ^7.18.0. Повторный аудит: **0 уязвимостей**. Тесты web (8) и typecheck после обновления — зелёные.
- В CI добавлен шаг `pnpm audit --prod` с `continue-on-error: true` (не блокирует сборку при появлении новых транзитивных advisory, но виден в логе).

## 7. Проверка прав доступа

- Мировые права на запись (world-writable) в репозитории: **отсутствуют**.
- `.gitignore` покрывает: node_modules/, dist/, .env/.env.*, coverage/, releases/* (кроме README).
- Owner-only правила ворот G0/G6 — покрыты тестами gate-service (12).
- RELEASED-правило (G6 + все критерии DONE) — покрыто тестами (409 в REST и sync).

## 8. Восстановление из бэкапа

- Снапшот → копия → restore в чистый инстанс: имя, статус, revision восстановлены точно (тест).
- Повреждённый/отсутствующий снапшот: честный старт с default state, без падения (тест).

## 9. Честные ограничения

- Нагрузочное тестирование и профилирование NOT TESTED — вне объёма smoke.
- PostgreSQL/pg-boss NOT TESTED (нет PG в песочнице).
- Динамический SAST/DAST, сканеры класса Semgrep/CodeQL NOT IMPLEMENTED — используется собственный паттерн-сканер; это задокументировано как осознанное промежуточное решение.
- Мобильные платформы (Android/iOS) NOT IMPLEMENTED — нужны тулчейны.

## 10. Итог

**STAGE 6 — DONE (по локальной верификации) / PARTIAL (в целом).** Критических дефектов не обнаружено; 2 moderate-уязвимости зависимостей устранены в рамках этапа.

---

# Дополнение STAGE 7 — RELEASE HUB и UPDATE MANAGER (6 новых тестов, итого 87)

- dev-релиз без ворот → 201; stable без G5/G6 → 409 missing ['G5','G6'].
- beta после регистрации installer+checksum артефактов и утверждения G5 → 201.
- Дубликат version+channel → 409; невалидная версия/канал → 400.
- Update check: latest 0.10.0 (числовое семвер-сравнение), updateAvailable true/false; пустой канал → 404.
- Живой smoke полного сценария на собранном сервере — OK (включая персистентность).

---

# Дополнение (пост-STAGE 8) — Аутентификация и роли (7 новых тестов, итого 94)

- `apps/server/src/auth.test.ts` (7): разбор `NF_AUTH_TOKENS` (некорректные пары
  игнорируются), открытый режим (`auth: "disabled"`), 401 без/с неизвестным
  токеном, viewer read-only (GET 200, мутации 403), матрица engineer
  (projects/jobs/sync OK; approve/reject, релизы, настройки — 403), owner
  (approve G0 после PATCH критериев + spec-артефакт; релиз 201), healthz открыт
  при защищённом API и честно сообщает `auth: "enabled"`.
- Итог: 97 тестов зелёных (43 server, 9 web, 45 packages); typecheck 0 ошибок;
  security-скан без находок.

# Дополнение 2 (пост-STAGE 8) — WebSocket auth и токен в веб-интерфейсе (3 новых теста, итого 97)

- Server: `/ws` при включённой аутентификации — 401 на upgrade без токена;
  подключение с валидным токеном (`/ws?token=`) получает события broadcaster;
  в открытом режиме `/ws` доступен без токена (2 теста).
- Web: `setApiToken`/`getApiToken` (localStorage `nf-token`, trim); все запросы
  api и офлайн-очередь отправляют `Authorization: Bearer`; WebSocket в
  useLiveEvents подключается с `?token=`; Settings — карточка «Доступ (токен
  API)» (сохранить/удалить, честная пометка о localStorage) (1 тест).

# Дополнение 3 (пост-STAGE 8) — IndexedDB-адаптер офлайн-очереди (3 новых теста, итого 100)

- `packages/sync-engine` — `IndexedDBKV` (KVAdapter через IndexedDB: get/set/
  delete/keys, переиспользование соединения); dev-зависимость `fake-indexeddb`
  для честных тестов вне браузера.
- Тесты (3): store/read/delete/keys; персистентность между экземплярами
  адаптера; работа как хранилище OperationQueue (enqueue → pendingCount →
  markSynced).
- `apps/web/offlineQueue.ts` — очередь теперь в IndexedDB (`nf-sync-kv`),
  fallback на LocalStorageKV, если indexedDB недоступен (jsdom-тесты идут по
  fallback-ветке). Честная пометка: очередь из старого localStorage не
  переносится автоматически.

# Дополнение 4 (пост-STAGE 8) — pg-mem smoke миграции, hardening API, 401-подсказка (5 новых тестов, итого 105)

- `apps/server/src/migration.test.ts` (2): миграция 0001_init.sql применяется
  на pg-mem-эмуляции PostgreSQL (users/projects/gates inserts, CHECK-ограничения
  ролей и кодов ворот отклоняют невалидные значения). Честная пометка: это
  эмуляция — реальный PostgreSQL остаётся NOT TESTED (в песочнице нет root/docker).
- Hardening (2): security-заголовки (nosniff/DENY/no-referrer) на всех ответах;
  bodyLimit 2 МиБ — тело больше лимита отклоняется (413/400).
- Web (1): useApi честно дополняет ошибку 401 подсказкой «задайте токен в
  Settings → „Доступ (токен API)“».

# Дополнение 5 (пост-STAGE 8) — OpenAPI 3.1 спецификация API v0.7.0 (3 новых теста, итого 108)

- `docs/openapi.json` — OpenAPI 3.1.0: info.version 0.7.0, securityScheme `bearerAuth`
  (Bearer-токен из NF_AUTH_TOKENS), 18 путей — все фактические маршруты сервера,
  включая /healthz и /ws (без auth). Описания честные: ограничения ролей
  (owner-only для approve/reject, viewer read-only) и коды ошибок (401/403/409/413).
- `apps/server/src/openapi.test.ts` (3):
  1. спека описывает v0.7.0, содержит bearerAuth, ≥17 путей;
  2. каждый задокументированный path+method существует на живом сервере
     (app.inject; route-404 Fastify = несоответствие; бизнес-404
     «project not found»/«job not found» допустимы). Честная пометка: `/ws`
     исключён из inject-проверки — light-my-request не выполняет WebSocket-upgrade;
     WS-авторизация и доставка покрыты тестами auth.test.ts;
  3. все 18 обязательных маршрутов присутствуют в спеке (обратное покрытие).
- Отладка: исходная версия теста падала («Unexpected end of JSON input») —
  res.json() на пустом теле 404 от WS-маршрута; исправлено безопасным разбором
  тела + явным исключением /ws.

# Дополнение 6 (пост-STAGE 8) — сервер раздаёт OpenAPI-спеку (1 новый тест, итого 110)

- `GET /api/v1/openapi.json` — сервер отдаёт `docs/openapi.json` (application/json).
  Поиск файла по кандидат-путям: относительно `import.meta.url` (работает и из
  `dist/`, и из исходников под vitest) и относительно `process.cwd()`.
  Файл не найден → честный 503 `{error: 'openapi spec file not found'}`.
- Маршрут открыт всегда (как /healthz): спека — публичные метаданные, в репозитории
  и так открыта; в auth-hook добавлено явное исключение.
- `docs/openapi.json` дополнен путём `/api/v1/openapi.json` (19 путей).
- Тест (1): при включённой аутентификации и без токена — 200, content-type
  application/json, info.version 0.7.0, путь самопредставлен в спеке.
- Живой смоук: healthz 200 (0.7.0, auth:disabled), openapi.json 200 (19 путей),
  overview 200 в открытом режиме.

# Дополнение 7 (пост-STAGE 8) — скачивание OpenAPI-спеки в web-UI, USER_GUIDE (1 новый тест, итого 111)

- `apps/web/src/screens/Settings.tsx` — новая карточка «API-контракт (OpenAPI)»:
  ссылка-кнопка «Скачать OpenAPI-спеку» (data-testid `openapi-download`,
  `href="/api/v1/openapi.json"`, `download="neuroos-app-factory-openapi.json"`);
  эндпоинт открыт всегда, токен не требуется. CSS: `.nf-button-link`.
- `apps/web/src/openapiLink.test.tsx` (1): ссылка присутствует в Settings,
  href и download-атрибут корректны.
- `docs/USER_GUIDE.md` — новый раздел 5 «Программный доступ к API (OpenAPI)»:
  эндпоинт спеки, скачивание из UI, примеры запросов (healthz, спека, проекты
  с Bearer-токеном, создание проекта), пометка о спеке как источнике истины.

# Дополнение 8 (пост-STAGE 8) — артефакты релиза в ReleaseCenter (2 новых теста; фактически 112 — в исходной записи была арифметическая ошибка, исправлено в дополнении 9)

- `apps/web/src/screens/ReleaseCenter.tsx` — список релизов теперь честно
  показывает привязанные артефакты: «артефакты (N): id, …» или
  «артефакты не привязаны (зарегистрируйте их через POST
  /api/v1/projects/<slug>/artifacts)» — пустое состояние без фейка.
- `apps/web/src/releaseArtifacts.test.tsx` (2): список из двух id;
  честное пустое состояние при artifactIds: [].

# Дополнение 9 (пост-STAGE 8) — скачивание артефактов файлами + сквозной смоук жизненного цикла (4 новых теста, итого 116)

- `GET /api/v1/artifacts/:id/download` — отдаёт файл артефакта с диска:
  content-type application/octet-stream, content-disposition attachment,
  заголовок `x-artifact-sha256`. Честные ошибки: 404 «artifact not found»
  (нет записи) / 404 «artifact file not found on disk» (файл удалён) —
  различаются в теле; 409 «sha256 mismatch on download» — файл на диске
  не совпадает с записью реестра (declared/computed в теле). Защита от
  path traversal: путь проверяется на нахождение внутри dataDir.
- `apps/server/src/artifactDownload.test.ts` (4): успешная отдача с
  integrity-заголовками и байт-в-байт совпадением; 404 по неизвестному id;
  честный 404 при удалённом файле; 409 при подмене файла на диске.
- `docs/openapi.json` — путь добавлен (20 путей); тест route-coverage
  обновлён (обязательных маршрутов теперь 19 + /ws).
- Исправление честности: в дополнении 8 итог был ошибочно указан как 113 —
  фактически 112 (51 server + 13 web + 48 packages). Исправлено здесь.

# Дополнение 10 (пост-STAGE 8) — сквозной живой смоук полного жизненного цикла (14/14 OK)

Периодическая проверка целостности на живом сервере (dist, порт 3244):
healthz (0.7.0) → создание проекта → PATCH статуса DEVELOPMENT и критериев
приёмки (revision 2) → конвейер code_task → build_run → test_run (все done) →
регистрация артефакта spec с SHA-256 → G0 missing=[] → approve G0 → релиз
0.1.0 канала dev (201) → скачивание артефакта (байт-в-байт, x-artifact-sha256) →
отказ загрузки с неверным sha256 (409) → отказ stable без G5/G6 (409) →
проверка обновлений (updateAvailable=false). Итог: 14/14 OK.
Первая итерация смоука дала 10/14: две ошибки были в самом скрипте
(поле job внутри ответа run; approver должен быть 'owner'), обе исправлены —
сервер отработал корректно.
