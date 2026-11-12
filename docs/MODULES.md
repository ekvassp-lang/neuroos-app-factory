# MODULES — NEUROOS APP FACTORY

Версия: 0.1.0 · Статус: PROPOSED → на утверждение (GATE 1)

Каждый модуль — пакет монорепозитория с публичным API (`packages/<module>/src/index.ts`).
Запрещены прямые импорты внутренностей чужого модуля. Обмен — через контракты
(`packages/core-contracts`), REST API и jobs (pg-boss).

## 1. Модули конвейера производства

### IDEA STUDIO
- **Назначение:** приём и анализ идей (свободный текст + шаблон §15 стандарта).
- **Вход:** текст идеи, ответы на уточняющие вопросы, файлы дизайна.
- **Выход:** `idea_brief` (raw_text + structured), список рисков и открытых вопросов.
- **Зависимости:** AI Provider Layer (анализ), Artifact Registry (сохранение).
- **Gate:** G0 (вход).

### SPECIFICATION ENGINE
- **Назначение:** генерация и версионирование технических заданий.
- **Вход:** `idea_brief.structured`.
- **Выход:** `specification` (ТЗ, объём, ограничения), `acceptance_criteria`.
- **Зависимости:** AI Provider Layer; RULES (шаблоны стандарта).
- **Gate:** G0.

### AI ARCHITECT
- **Назначение:** архитектура продукта, стек, структура, стратегии платформ, план
  Offline/Online, план сборки и тестирования.
- **Вход:** `specification`.
- **Выход:** `architecture_doc`, `stack_decision`, `repo_layout`, `build_plan`, `test_plan`.
- **Зависимости:** AI Provider Layer; RULES (совместимость со стеками).
- **Gate:** G1.

### CODE BUILDER
- **Назначение:** управление разработкой исходного кода проекта.
- **Вход:** `architecture_doc`, задачи этапов STAGE 1–4.
- **Выход:** git-коммиты в репозитории проекта, отчёты проверок (build/lint/test).
- **Зависимости:** Runner (исполнение команд), AI Provider Layer, Artifact Registry.
- **Gate:** G2 (foundation), G3 (core).

### UI STUDIO
- **Назначение:** дизайн-система продукта, экраны, навигация, адаптивность, темы.
- **Вход:** `specification`, `architecture_doc`, референсы дизайна.
- **Выход:** дизайн-токены, компоненты, экраны в коде проекта.
- **Зависимости:** CODE BUILDER (внесение изменений в код), design-system.
- **Gate:** в рамках DEVELOPMENT (проверка на G2/G3).

### TEST CENTER
- **Назначение:** автоматизированные функциональные, интеграционные, offline/online тесты.
- **Вход:** репозиторий проекта, `test_plan`.
- **Выход:** отчёты тестов (команды, результаты, пройдено/не пройдено) → Artifact Registry.
- **Зависимости:** Runner.
- **Gate:** G3.

### AUDIT CENTER
- **Назначение:** независимая проверка качества; ведение AUDIT.md проекта.
- **Вход:** артефакты этапа, отчёты TEST CENTER, журнал Runner.
- **Выход:** аудиторское заключение, список невыполненных критериев, статус этапа.
- **Зависимости:** Artifact Registry, Gate Service.
- **Gate:** G4 (совместно с SECURITY-проверками).

### BUILD CENTER
- **Назначение:** сборка установочных файлов по матрице платформ; каталог `/releases/`.
- **Вход:** репозиторий проекта, `build_plan`, конфигурации подписей (от владельца).
- **Выход:** артефакты сборки + SHA-256 + журналы сборки; статусы по каждому формату.
- **Зависимости:** Runner, Artifact Registry.
- **Gate:** G5.

### RELEASE HUB
- **Назначение:** версии, релизные заметки, каналы распространения, утверждение релиза.
- **Вход:** проверенные артефакты, статус Gates, `acceptance_criteria`.
- **Выход:** RELEASE_CANDIDATE → RELEASED записи, release notes, каналы обновлений.
- **Зависимости:** Gate Service, Artifact Registry, UPDATE MANAGER.
- **Gate:** G6.

### UPDATE MANAGER
- **Назначение:** доставка обновлений произведённым продуктам; откаты.
- **Вход:** утверждённые релизы.
- **Выход:** манифесты обновлений по платформам, статусы доставки.
- **Зависимости:** RELEASE HUB, Artifact Registry.

## 2. Сквозные (инфраструктурные) модули

### PROJECT MANAGER
- **Назначение:** реестр проектов, состояния жизненного цикла, дашборды.
- **API:** CRUD проектов, переходы состояния (только через Gate Service), сводки.

### ARTIFACT REGISTRY
- См. ARTIFACT_REGISTRY.md. Хранит всё: исходники (ссылки на git), ТЗ, архитектуру,
  диаграммы, тесты, аудиты, журналы сборки, пакеты, SHA-256, release notes, документацию.

### AI PROVIDER HUB
- См. AI_PROVIDER_ARCHITECTURE.md. Подключение провайдеров, ключи, маршрутизация задач,
  история выполнения, лимиты и ошибки.

### RUNNER
- Изолированное исполнение команд с белым списком, таймаутами, журналом и кодами возврата.
- Выдаёт фактические результаты; подмена результатов запрещена (NO FAKE SUCCESS).

### GATE SERVICE
- Хранит определения Gates G0–G6, критерии, подтверждающие артефакты, ответственного,
  статус; единственная точка переходов жизненного цикла.

## 3. Матрица «этап продукта → модуль → Gate»

| Этап | Модули | Gate |
|---|---|---|
| STAGE 0 — Анализ | IDEA STUDIO → SPEC ENGINE → AI ARCHITECT | G0, G1 |
| STAGE 1 — Foundation | AI ARCHITECT (scaffold) → CODE BUILDER | G2 |
| STAGE 2 — UI/UX | UI STUDIO → CODE BUILDER | в рамках DEVELOPMENT |
| STAGE 3 — Core | CODE BUILDER → TEST CENTER | G3 |
| STAGE 4 — Offline/Online | CODE BUILDER + TEST CENTER | G3, G4 |
| STAGE 5 — Multiplatform | BUILD CENTER | подготовка к G5 |
| STAGE 6 — Testing & Security | TEST CENTER + AUDIT CENTER | G3, G4 |
| STAGE 7 — Build & Release | BUILD CENTER → RELEASE HUB | G5, G6 |
| STAGE 8 — Documentation | CODE BUILDER + RELEASE HUB | G6 |

## 4. Правила зависимостей

1. Конвейерные модули не знают друг о друге — только о контрактах данных.
2. RUNNER и AI Provider Layer — единственные исполнители внешних действий (команды, ИИ).
3. Все артефакты любого модуля регистрируются в Artifact Registry с контрольной суммой.
4. Переходы жизненного цикла — только через GATE SERVICE (см. PROJECT_LIFECYCLE.md §3).
