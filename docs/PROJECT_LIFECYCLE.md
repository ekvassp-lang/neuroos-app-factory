# PROJECT_LIFECYCLE — NEUROOS APP FACTORY

Версия: 0.1.0 · Статус: PROPOSED → на утверждение (GATE 1)

## 1. Назначение

Единый управляемый жизненный цикл каждого проекта конвейера. Переходы контролируются
правилами; автоматические переходы возможны только там, где явно разрешены (§3).

## 2. Состояния

| Состояние | Смысл |
|---|---|
| IDEA | идея зафиксирована в IDEA STUDIO |
| ANALYSIS | идёт анализ, уточняющие вопросы, риски |
| SPECIFICATION | формируется/правится ТЗ |
| ARCHITECTURE | формируется/правится архитектура, стек, планы |
| DEVELOPMENT | реализация STAGE 1–4 (foundation, UI, core, offline/online) |
| TESTING | прогон автоматизированных тестов (STAGE 6) |
| AUDIT | независимая проверка AUDIT CENTER |
| APPROVED | все обязательные критерии приёмки = DONE, аудит пройден |
| BUILDING | выполняется сборка платформенных пакетов (STAGE 7) |
| RELEASE_CANDIDATE | сборки проверены, релиз ожидает утверждения |
| RELEASED | релиз утверждён и опубликован в каналы |
| MAINTENANCE | сопровождение, плановые обновления |
| BLOCKED | остановка внешним ограничением (доступы, ОС сборки, владелец) |
| ARCHIVED | проект выведен из активной работы (мягкое удаление) |

## 3. Правила переходов

### 3.1. Разрешённые переходы

```
IDEA → ANALYSIS → SPECIFICATION → ARCHITECTURE → DEVELOPMENT → TESTING → AUDIT → APPROVED
APPROVED → BUILDING → RELEASE_CANDIDATE → RELEASED → MAINTENANCE
любое состояние → BLOCKED (с причиной) ; BLOCKED → предыдущее состояние
MAINTENANCE → DEVELOPMENT (новая версия) ; любое → ARCHIVED (мягкое)
```

### 3.2. Условия (Gate-контроль)

| Переход | Условие |
|---|---|
| IDEA → ANALYSIS | idea_brief сохранён в Artifact Registry |
| ANALYSIS → SPECIFICATION | открытые вопросы закрыты или явно отложены владельцем |
| SPECIFICATION → ARCHITECTURE | **GATE 0** approved (требования утверждены) |
| ARCHITECTURE → DEVELOPMENT | **GATE 1** approved (архитектура утверждена) |
| DEVELOPMENT → TESTING | **GATE 2** approved (foundation verified) и **GATE 3** approved (core tested) |
| TESTING → AUDIT | отчёты тестов зарегистрированы; критические дефекты отсутствуют |
| AUDIT → APPROVED | **GATE 4** approved (security reviewed); AUDIT.md актуален |
| APPROVED → BUILDING | решение владельца (ручное) |
| BUILDING → RELEASE_CANDIDATE | **GATE 5** approved (platform builds verified) |
| RELEASE_CANDIDATE → RELEASED | **GATE 6** approved (release approved, владельцем) |
| RELEASED → MAINTENANCE | автоматически после публикации канала stable |

### 3.3. Жёсткие запреты

1. **Запрещено** переводить проект в RELEASED, если обязательные критерии приёмки
   (`project.acceptance_criteria`) не переведены в DONE с подтверждающими артефактами.
2. **Запрещено** автоматическое утверждение критических этапов только на основании ответа ИИ:
   G1, G4, G5, G6 утверждаются системой правил по артефактам + человеком (владельцем/инженером).
3. Переходы выполняет только GATE SERVICE; прямые изменения `project.status` запрещены.
4. Каждый переход фиксируется записью `lifecycle_event` (actor, reason, gate).
5. Из BLOCKED выход разрешён только при устранении причины; причина хранится в событии.

## 4. Соответствие этапам стандарта

Состояния жизненного цикла покрывают STAGE 0–8 стандарта «Universal Multiplatform App
Builder» (см. MODULES.md §3): STAGE 0 → IDEA..ARCHITECTURE; STAGE 1–4 → DEVELOPMENT;
STAGE 5 → BUILDING (подготовка); STAGE 6 → TESTING/AUDIT; STAGE 7 → BUILDING/RELEASE;
STAGE 8 → RELEASED (документация зарегистрирована в Artifact Registry до утверждения G6).

## 5. Статусы пунктов внутри этапа

Внутри каждого этапа пункты отчёта несут статусы DONE / PARTIAL / BLOCKED / NOT
IMPLEMENTED / NOT TESTED (стандарт §11). Gate не может быть approved, пока связанные
пункты не в DONE с артефактами (Приложение A стандарта).
