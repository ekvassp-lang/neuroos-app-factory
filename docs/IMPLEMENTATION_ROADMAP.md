# IMPLEMENTATION_ROADMAP — NEUROOS APP FACTORY

Версия: 0.1.0 · Статус: PROPOSED → на утверждение (GATE 1)

План реализации самой фабрики. Этапы соответствуют стандарту «Universal Multiplatform
App Builder» (STAGE 0–8) и Приложению A (модули/Gates). Начало каждого этапа — только
после проверки предыдущего (NO FAKE SUCCESS).

## STAGE 1 — Foundation

- Монорепозиторий (pnpm-workspace) по ARCHITECTURE.md §5; Git, CI (GitHub Actions):
  lint, typecheck, unit-тесты, сканер секретов, аудит зависимостей.
- Скелеты: `apps/web` (React+Vite), `apps/server` (Fastify), `apps/desktop` (Tauri 2),
  `packages/core-contracts`, `packages/design-system`.
- PostgreSQL-схема (DATA_MODEL.md), миграции; pg-boss; MinIO (S3) в dev-окружении.
- RUNNER v1: белый список команд, журналы, таймауты.
- **Результат:** проверенная основа (GATE 2 фабрики).
- **Проверка:** фактические `pnpm build/test` в песочнице; зелёный CI.

## STAGE 2 — UI/UX фабрики

- Дизайн-система (токены палитры: #111827, #18D6D1, #0A6CFF, #A4D9BB, #F86E8F, #033438;
  тёмная/светлая темы; glassmorphism в меру).
- Экраны: Global Dashboard, Projects Dashboard, Project Workspace, AI Workspace,
  Build Center, Audit Center, Release Center, Settings.
- Навигация, адаптивность (смартфон/планшет/ноутбук/монитор), WebSocket-статусы.
- **Результат:** работающий интерфейс с реальными данными API (не макет).

## STAGE 3 — Core Functionality

- PROJECT MANAGER (CRUD, статусы), GATE SERVICE (определения G0–G6, переходы),
  Artifact Registry API (регистрация, проверка SHA-256, права).
- IDEA STUDIO + SPECIFICATION ENGINE + AI ARCHITECT v1 (реальные вызовы ИИ через
  Provider Layer, smoke-тест провайдера перед включением).
- CODE BUILDER v1: создание проекта → git init → каркас → прогоны build/test через RUNNER.
- TEST CENTER v1: прогон тест-сьютов проекта, отчёты в реестр.
- **Результат:** функционально работающий конвейер для одного сквозного сценария
  «идея → каркас проекта → тесты» (GATE 3 фабрики).

## STAGE 4 — Offline / Online

- Локальный слой клиента (SQLite/IndexedDB), очередь отложенных операций, idempotency-ключи.
- Синхронизация: состояние подключения, повторы, конфликты (LWW + векторы версий),
  целостность; честная индикация offline-функций.
- Тесты переключения режимов без потери данных (обязательные).
- **Результат:** проверенная гибридная модель.

## STAGE 5 — Multiplatform (фабрика)

- Tauri 2: сборка Windows (NSIS/MSI), macOS (APP/DMG), Linux (AppImage/DEB/RPM) —
  через CI-матрицу GitHub Actions (windows-latest, macos-latest, ubuntu-latest).
- Android/iOS цели Tauri 2; Web-деплой; PWA (манифест, Service Worker).
- Каталог `/releases/` фабрики.
- **Результат:** платформенные конфигурации и готовность к сборке; артефакты — по мере
  доступности ОС сборки (честные статусы, BLOCKED без целевой ОС).

## STAGE 6 — Testing & Security (фабрика)

- Полный прогон: функциональные, интеграционные, offline/online, производительность.
- SAST, сканер секретов, аудит зависимостей, проверка прав доступа, тест восстановления
  из бэкапа.
- **Результат:** отчёт о проверках; устранение критических дефектов.

## STAGE 7 — Build & Release (фабрика)

- Сборка всех доступных пакетов, проверка установки/запуска/обновления/удаления.
- RELEASE HUB: версии, каналы, release notes; UPDATE MANAGER v1 (проверка обновлений).
- **Результат:** готовые к распространению сборки (GATE 5/6 фабрики).

## STAGE 8 — Documentation

- README.md, ARCHITECTURE.md, TECHNICAL_SPECIFICATION.md, INSTALLATION.md, BUILD.md,
  SECURITY.md, TEST_REPORT.md, RELEASE_NOTES.md — финальные версии, актуализированные
  по факту реализации; инструкции установки/удаления/восстановления.
- **Результат:** документация для разработчика и конечного пользователя.

## Контроль реализации продуктов (для произведённых приложений)

Каждый проект внутри фабрики проходит собственные STAGE 0–8 по стандарту; фабрика
обеспечивает отчётность §14 (8 разделов, честные статусы) и Gates G0–G6 автоматически.

## Зависимости от владельца (нужны решения/доступы)

1. Доступ к репозиторию NeuroOS Core — для сверки соглашений и повторного использования.
2. Решение по ИИ-провайдерам (какие подключать первыми, ключи — через секрет-хранилище).
3. Сертификаты подписи (Windows/macOS/Apple) и учётные записи сторов — для STAGE 7.
