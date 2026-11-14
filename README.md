# NEUROOS APP FACTORY

**Universal Software Production System** — производственная платформа экосистемы NeuroOS,
управляющая полным жизненным циклом программного продукта:

```
IDEA → SPECIFICATION → ARCHITECTURE → DEVELOPMENT → TESTING → AUDIT → BUILD → RELEASE → UPDATE
```

- **Версия:** 0.1.0
- **Статус:** STAGE 8 — Documentation завершён. Все 8 этапов STAGE 0–8 выполнены; релиз [v0.1.0](https://github.com/ekvassp-lang/neuroos-app-factory/releases/tag/v0.1.0) опубликован. Пост-роадмап: аутентификация и роли (API v0.7.0), OpenAPI-контракт и скачивание артефактов (API v0.8.0). Сводка честных статусов — [docs/AUDIT.md](docs/AUDIT.md)
- **Исполнительская среда:** Vibe Code (async agent); нормативный стандарт производства —
  `STANDARD — UNIVERSAL MULTIPLATFORM APP BUILDER` («003 промпт»)

## Что это

APP FACTORY — самостоятельный продукт экосистемы NeuroOS. Это не генератор фрагментов кода
и не панель управления, а производственная система: пользователь описывает идею, а фабрика
через цепочку модулей доводит её до установочных пакетов на всех целевых платформах,
с тестированием, аудитом, релизами и обновлениями.

## Модули (см. MODULES.md)

| Модуль | Назначение |
|---|---|
| IDEA STUDIO | создание и анализ идей |
| SPECIFICATION ENGINE | генерация технических заданий |
| AI ARCHITECT | проектирование архитектуры |
| CODE BUILDER | управление разработкой исходного кода |
| UI STUDIO | дизайн и пользовательские интерфейсы |
| TEST CENTER | автоматизированное тестирование |
| AUDIT CENTER | независимая проверка качества |
| BUILD CENTER | сборка установочных файлов |
| RELEASE HUB | управление релизами |
| UPDATE MANAGER | управление обновлениями |
| PROJECT MANAGER | управление всеми проектами |
| ARTIFACT REGISTRY | реестр исходников, сборок, документов и контрольных сумм |
| AI PROVIDER HUB | управление подключёнными ИИ-провайдерами |

## Целевые результаты производства

Web, PWA, Windows (EXE/MSI), macOS (APP/DMG/PKG), Linux (AppImage/DEB/RPM),
Android (APK/AAB), iOS (IPA/проект подписанной сборки). Фактическая доступность формата
зависит от стека продукта, ОС сборки, подписей и требований платформ — фабрика честно
фиксирует это в плане сборки каждого проекта (NO FAKE SUCCESS).

## Документы STAGE 0

| Документ | Назначение |
|---|---|
| [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) | видение продукта |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | требования (функциональные/нефункциональные) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | архитектурная схема и обоснование стека |
| [docs/MODULES.md](docs/MODULES.md) | границы и контракты модулей |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | модель данных |
| [docs/PROJECT_LIFECYCLE.md](docs/PROJECT_LIFECYCLE.md) | жизненный цикл проектов и правила переходов |
| [docs/AI_PROVIDER_ARCHITECTURE.md](docs/AI_PROVIDER_ARCHITECTURE.md) | мультипровайдерная ИИ-архитектура |
| [docs/ARTIFACT_REGISTRY.md](docs/ARTIFACT_REGISTRY.md) | реестр артефактов |
| [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) | модель безопасности |
| [docs/QUALITY_GATES.md](docs/QUALITY_GATES.md) | контрольные точки G0–G6 |
| [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) | план реализации STAGE 1–8 |
| [docs/AUDIT.md](docs/AUDIT.md) | аудит всех этапов: что проверялось, что подтверждено |
| [docs/TECHNICAL_SPECIFICATION.md](docs/TECHNICAL_SPECIFICATION.md) | техническая спецификация (по факту реализации) |
| [docs/openapi.json](docs/openapi.json) | OpenAPI 3.1 контракт API v0.8.0 (20 путей, bearerAuth) |
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | установка/удаление/восстановление |
| [docs/BUILD.md](docs/BUILD.md) | сборка пакетов и десктоп-сборки |
| [docs/SECURITY.md](docs/SECURITY.md) | безопасность: ключи, RUNNER, сканирование |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | тест-отчёт (119 тестов) |
| [docs/TRACEABILITY.md](docs/TRACEABILITY.md) | матрица трассировки RF-1…RF-19 / RN-1…RN-7 → реализация → тесты → статус |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | руководство пользователя: интерфейс, сценарий, офлайн, роли |
| [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md) | release notes |


## Быстрый старт (после STAGE 1)

Требуется Node 22+ и pnpm 10+.

```bash
pnpm install
pnpm typecheck   # сборка пакетов + проверка типов (8 проектов)
pnpm build       # dist/ у 6 пакетов + apps/web/dist (Vite)
pnpm test        # 119 тестов: core-contracts, design-system, runner, gate-service, ai-provider, sync-engine, server, web
```

Сервер: `pnpm --filter @neuroos/server dev` (или `node apps/server/dist/main.js`) → `http://127.0.0.1:3000/healthz`.
Веб-оболочка: `pnpm --filter @neuroos/web dev` (Vite dev-server).

Схема БД: `migrations/0001_init.sql` (PostgreSQL 15+, применяется на STAGE 2).

## Принципы

- **NO FAKE SUCCESS** — каждый результат подтверждается проверяемым артефактом; статусы
  DONE / PARTIAL / BLOCKED / NOT IMPLEMENTED / NOT TESTED проставляются честно.
- **Artifact-driven development** — решение существует, только если существует его артефакт.
- **Controlled execution** — необратимые и критические операции требуют разрешения.
