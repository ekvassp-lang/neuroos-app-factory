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
