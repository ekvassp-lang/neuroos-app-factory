# Матрица трассировки требований — NeuroOS App Factory

Версия API: 0.7.0. Каждое требование из `docs/REQUIREMENTS.md` сопоставлено с
реализацией, тестами и честным статусом. Статусы: DONE / PARTIAL / BLOCKED /
NOT IMPLEMENTED / NOT TESTED.

## 1. Функциональные требования

| ID | Требование | Реализация | Тесты/артефакты | Статус |
|---|---|---|---|---|
| RF-1 | IDEA STUDIO: приём идеи (свободная форма/шаблон §15), idea_brief | `apps/web/src/screens/AIWorkspace.tsx`, `apps/server` job `idea_analysis` | UI-экран; job-вид честно падает без AI-ключей | **PARTIAL** — приём и хранение DONE; AI-анализ BLOCKED (нет ключей) |
| RF-2 | IDEA STUDIO: анализ идеи (вопросы, риски, полнота) | `packages/ai-provider` (контракт, MistralProvider), job-конвейер | 12 тестов ai-provider; smoke-test gating | **PARTIAL** — контракт и провайдер DONE; реальный вызов BLOCKED (нет ключей) |
| RF-3 | SPECIFICATION ENGINE: ТЗ + критерии приёмки, версионирование | `createProjectInner` + PATCH `acceptanceCriteria`, артефакт `spec` | auth.test (PATCH критериев), stage3.test | **DONE** — критерии приёмки влияют на G0/G6; версионирование ТЗ — через артефакты |
| RF-4 | AI ARCHITECT: генерация архитектуры/стека/планов | job-виды `architecture_draft`; `docs/ARCHITECTURE.md` как пример | job честно падает без AI | **PARTIAL** — каркас DONE; генерация BLOCKED (нет ключей) |
| RF-5 | CODE BUILDER: Git на проект, поэтапная реализация, проверка сборки | `apps/server/src/worker.ts` (code_task → git init, build_run, test_run) | stage3.test (конвейер), live smoke | **DONE** — локальные команды через RUNNER; push во внешние ремоуты NOT IMPLEMENTED |
| RF-6 | UI STUDIO: дизайн-система, экраны, темы | `packages/design-system`, 8 экранов `apps/web/src/screens/`, тёмная/светлая темы | 1 тест design-system, App.test | **DONE** |
| RF-7 | Запрещены фейки/заглушки | Политика NO FAKE SUCCESS во всех отчётах (§11/AUDIT.md) | AUDIT.md — честные статусы каждого этапа | **DONE** (процесс) |
| RF-8 | TEST CENTER: автотесты, проверка перезапуска/офлайна/синхронизации | vitest по всем пакетам; `stage4.test.ts`, `stage6.test.ts` | 97 тестов; docs/TEST_REPORT.md | **DONE** — перезапуск (backup/restore), офлайн-очередь, sync покрыты |
| RF-9 | AUDIT CENTER: независимая проверка, AUDIT.md по этапам | `docs/AUDIT.md` (все этапы + дополнения), экран AuditCenter, SAST-сканер | stage6.test, security-scan | **DONE** |
| RF-10 | BUILD CENTER: матрица артефактов, `/releases/` | `src-tauri/`, `.github/workflows/desktop.yml`, `releases/v0.1.0/checksums-sha256.txt` | CI-матрица 3 ОС — 7 артефактов (run 43434053581) | **PARTIAL** — Web/PWA/Win/macOS/Linux DONE; APK/AAB/IPA NOT IMPLEMENTED |
| RF-11 | Запрещено заявлять несобранные установщики; BLOCKED с причиной | Честные отчёты; INSTALLATION.md — предупреждения о неподписанных сборках | AUDIT.md, checksums | **DONE** (процесс) |
| RF-12 | RELEASE HUB: версии, notes, каналы, RELEASE_CANDIDATE→RELEASED | POST/GET `/api/v1/releases`, правила каналов ↔ G5/G6, экран ReleaseCenter | stage7.test (6) | **DONE** |
| RF-13 | UPDATE MANAGER: проверка/доставка обновлений, удаление средствами ОС | GET `/api/v1/updates/latest` (семвер-сравнение), панель проверки | stage7.test; INSTALLATION.md (удаление) | **PARTIAL** — проверка DONE; доставка/автообновление NOT IMPLEMENTED (нужны ключи подписи, Tauri updater) |
| RF-14 | Матрица платформ по умолчанию | `targetPlatforms` (7 платформ), `defaultPlatforms` в settings | core-contracts Platform (7) | **PARTIAL** — Web/PWA/Win/macOS/Linux DONE; Android/iOS NOT IMPLEMENTED |
| RF-15 | Offline/Online: локальная БД, очередь, восстановление, синхронизация, конфликты, защита от дублей | `packages/sync-engine` (OperationQueue, LWW, idempotency), `persistence.ts`, `/api/v1/sync`, localStorage-кэш UI | 15 тестов sync-engine (вкл. IndexedDBKV), stage4.test (6), offline-тесты web | **DONE** — IndexedDB-адаптер (`IndexedDBKV`) с fallback на localStorage; очередь офлайн-операций в браузере хранится в IndexedDB |
| RF-16 | AI PROVIDER HUB: провайдеры, ключи, назначение модели, история, ошибки/лимиты | `packages/ai-provider` (ProviderRegistry, key_ref, smoke-test), экран AIWorkspace | 12 тестов ai-provider | **PARTIAL** — каркас DONE; реальные провайдеры BLOCKED (нет ключей) |
| RF-17 | Запрещено заявлять интеграции без проверки | smoke-test обязателен до включения провайдера | ai-provider тесты gating | **DONE** (процесс) |
| RF-18 | ARTIFACT REGISTRY: типы артефактов, версии, целостность, доступ, восстановление | POST артефактов с SHA-256 (409), 11 ArtifactKind, `releases/` каталог | stage3/stage7 тесты; checksums-sha256.txt | **DONE** — разграничение доступа к артефактам через роли API v0.7.0 |
| RF-19 | PROJECT MANAGER: список, статусы, дашборды (8) | 8 экранов, 14 статусов, GlobalDashboard/ProjectsDashboard | App.test, stage3.test | **DONE** |

## 2. Нефункциональные требования

| ID | Требование | Реализация | Тесты/артефакты | Статус |
|---|---|---|---|---|
| RN-1 | NO FAKE SUCCESS | Политика §11; честные статусы в AUDIT/TEST_REPORT/README; честные ошибки API | Все отчёты; честные failed-джобы | **DONE** (процесс) |
| RN-2 | Управляемые переходы; запрет авто-утверждения критических ворот | `assertTransition`, RELEASED↔G6+критерии, `GateApprovalError`, approver-роли | 12 тестов gate-service; RELEASED 409 в REST и sync | **DONE** |
| RN-3 | Безопасность: изоляция, безопасные команды, права, секреты, аудит, зависимости, бэкап | RUNNER (whitelist, маскирование, таймауты), auth/роли v0.7.0, key_ref, SAST+секреты в CI, `pnpm audit`, snapshot-бэкап | 7 runner-тестов, 43 server-теста, stage6.test | **PARTIAL** — секретное хранилище NOT IMPLEMENTED (env — промежуточно); DAST/промышленный SAST NOT IMPLEMENTED |
| RN-4 | Воспроизводимость: Git, тесты, CI/CD, автосборка, контроль зависимостей | Git, vitest, ci.yml + desktop.yml, lockfile, `--frozen-lockfile` | CI SUCCESS (последний: 43447229771) | **DONE** |
| RN-5 | Дизайн-система Apple × Linear × Enterprise SaaS (палитра, glassmorphism, навигация) | `packages/design-system/tokens.css` (графит #111827, бирюза #18D6D1, синий #0A6CFF, целадон #A4D9BB, розовый #F86E8F, teal #033438) | 1 тест design-system | **DONE** |
| RN-6 | Удобство управления большим числом продуктов | Дашборды, сводки, фильтры по статусам, живые события WS | UI-экраны | **DONE** (субъективная оценка — по составу функций) |
| RN-7 | Отчёт §14 по каждому этапу | 8-разделные отчёты после каждого этапа/работы | AUDIT.md, история чата | **DONE** (процесс) |

## 3. Сводка

- **DONE:** 11 (RF-3, RF-5, RF-6, RF-7, RF-8, RF-9, RF-11, RF-12, RF-17, RF-18, RF-19; RN-1, RN-2, RN-4, RN-5, RN-6, RN-7)
- **PARTIAL:** 6 (RF-1, RF-2, RF-4, RF-10, RF-13, RF-14, RF-16; RN-3)
- **BLOCKED (нужно владельцу):** AI-анализ (ключи), реальные AI-провайдеры (ключи), автообновление (сертификаты)
- **NOT IMPLEMENTED:** Android/iOS, секретное хранилище, доставка обновлений
- **NOT TESTED:** PostgreSQL/pg-boss, интерактивные установщики на реальных ОС
