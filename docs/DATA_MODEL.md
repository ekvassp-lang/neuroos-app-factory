# DATA_MODEL — NEUROOS APP FACTORY

Версия: 0.1.0 · Статус: PROPOSED → на утверждение (GATE 1)
Хранение: PostgreSQL (сервер, состояние конвейера) · SQLite (локальный офлайн-слой
клиента) · IndexedDB (web/PWA) · S3 (содержимое артефактов).

## 1. Сущности

### project
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | идентификатор |
| name | text | название |
| slug | text unique | техническое имя |
| status | enum(lifecycle) | см. PROJECT_LIFECYCLE.md §2 |
| target_platforms | text[] | web, pwa, windows, macos, linux, android, ios |
| stack_decision | jsonb | выбранный стек продукта + обоснование |
| acceptance_criteria | jsonb[] | критерии приёмки (id, текст, статус, артефакт) |
| current_stage | int | 0–8 (этап стандарта) |
| created_at / updated_at | timestamptz | аудиторские метки |
| owner_id | uuid → user | владелец |

### idea_brief
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| raw_text | text |
| structured | jsonb (название, назначение, аудитория, функции, доп. возможности, режим, платформы, дизайн, ограничения) |
| open_questions | jsonb[] |
| risks | jsonb[] |
| version | int |

### specification
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| version | int |
| document | jsonb (ТЗ по разделам) |
| status | enum(draft, in_review, approved) |
| approved_at | timestamptz null |

### architecture_doc
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| version | int |
| document | jsonb (схема, модули, данные, офлайн/онлайн, сборка, тестирование) |
| repo_layout | jsonb |
| build_plan | jsonb[] (платформа, формат, инструмент, требуемые доступы, статус) |
| test_plan | jsonb[] |
| status | enum(draft, in_review, approved) |

### lifecycle_event
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| from_status / to_status | enum |
| gate_id | uuid null FK |
| actor | text (user / ai:<provider>:<model> / system) |
| reason | text |
| created_at | timestamptz |

### gate
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| code | enum(G0..G6) |
| criteria | jsonb[] (id, текст, статус, artifact_id) |
| artifacts | uuid[] → artifact |
| approver | text |
| status | enum(pending, in_review, approved, rejected) |
| decided_at | timestamptz null |

### job (конвейер, pg-boss)
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| kind | enum(spec_generate, arch_generate, code_task, test_run, build_run, audit_run, release, update_publish, ai_task) |
| payload | jsonb |
| status | enum(queued, running, done, failed, cancelled) |
| runner_log_id | uuid null → runner_log |
| attempts / max_attempts | int |
| idempotency_key | text unique |
| created_at / started_at / finished_at | timestamptz |

### runner_log
| Поле | Тип |
|---|---|
| id | uuid PK |
| job_id | uuid FK |
| command | text[] (argv) |
| cwd | text |
| exit_code | int |
| stdout_tail / stderr_tail | text (с обрезкой секретов) |
| started_at / finished_at | timestamptz |

### artifact
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| kind | enum(source_ref, spec, architecture, diagram, test_report, audit_report, build_log, installer, checksum, release_notes, documentation) |
| platform | text null (windows/macos/linux/android/ios/web/pwa) |
| version | text (semver проекта) |
| storage_key | text (S3) |
| sha256 | text |
| size_bytes | bigint |
| meta | jsonb |
| created_at | timestamptz |

### release
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| version | text semver |
| channel | enum(stable, beta, alpha) |
| artifacts | uuid[] |
| release_notes | text |
| status | enum(release_candidate, released, withdrawn) |
| approved_by | text |
| approved_at | timestamptz |

### ai_provider
| Поле | Тип |
|---|---|
| id | uuid PK |
| name | text |
| base_url | text |
| models | jsonb[] (id, capabilities, limits) |
| enabled | bool |
| key_ref | text (ссылка на секрет, НЕ сам ключ) |

### ai_task_run
| Поле | Тип |
|---|---|
| id | uuid PK |
| project_id | uuid null |
| provider_id | uuid FK |
| model | text |
| task_kind | text |
| prompt_ref | text (S3) |
| response_ref | text (S3) |
| tokens_in / tokens_out | int null |
| status | enum(ok, error, rate_limited, timeout) |
| error | text null |
| created_at | timestamptz |

### user / session / audit_log
- `user` (id, email, role: owner/engineer/viewer, created_at).
- `session` (id, user_id, expires_at, device_meta).
- `audit_log` (id, actor, action, object_type, object_id, detail jsonb, created_at) — append-only.

## 2. Связи (упрощённо)

```
project 1─n idea_brief / specification / architecture_doc / gate / job / artifact / release
job 1─1 runner_log (0..1)
gate n─n artifact (подтверждающие)
release n─n artifact
ai_task_run n─1 ai_provider
lifecycle_event n─1 gate (nullable)
```

## 3. Правила целостности

1. `project.status` меняется только записью `lifecycle_event` с gate при обязательном Gate.
2. `artifact.sha256` обязателен; расхождение суммы при чтении — инцидент целостности.
3. `job.idempotency_key` защищает от дублирования операций (offline-очередь, повторы).
4. Удаление проекта — мягкое (status=ARCHIVED); физическое удаление — отдельная операция с разрешением.
5. Секреты никогда не хранятся в перечисленных таблицах — только ссылки (`key_ref`).
6. Локальный офлайн-слой (SQLite/IndexedDB) повторяет подмножество схемы (project, job-очередь,
   настройки) и синхронизируется по правилам ARCHITECTURE.md §4.
