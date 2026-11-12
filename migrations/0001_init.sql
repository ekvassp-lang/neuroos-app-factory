-- NEUROOS APP FACTORY — initial schema (PostgreSQL 15+)
-- Соответствует docs/DATA_MODEL.md v0.1.0

CREATE TABLE IF NOT EXISTS users (
    id          uuid PRIMARY KEY,
    email       text NOT NULL UNIQUE,
    role        text NOT NULL CHECK (role IN ('owner', 'engineer', 'viewer')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    id          uuid PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users(id),
    expires_at  timestamptz NOT NULL,
    device_meta jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS projects (
    id                   uuid PRIMARY KEY,
    name                 text NOT NULL,
    slug                 text NOT NULL UNIQUE,
    status               text NOT NULL DEFAULT 'IDEA',
    target_platforms     text[] NOT NULL DEFAULT '{web,pwa,windows,macos,linux,android,ios}',
    stack_decision       jsonb,
    acceptance_criteria  jsonb NOT NULL DEFAULT '[]',
    current_stage        int NOT NULL DEFAULT 0 CHECK (current_stage BETWEEN 0 AND 8),
    owner_id             uuid REFERENCES users(id),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idea_briefs (
    id             uuid PRIMARY KEY,
    project_id     uuid NOT NULL REFERENCES projects(id),
    raw_text       text NOT NULL,
    structured     jsonb NOT NULL DEFAULT '{}',
    open_questions jsonb NOT NULL DEFAULT '[]',
    risks          jsonb NOT NULL DEFAULT '[]',
    version        int NOT NULL DEFAULT 1,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS specifications (
    id          uuid PRIMARY KEY,
    project_id  uuid NOT NULL REFERENCES projects(id),
    version     int NOT NULL DEFAULT 1,
    document    jsonb NOT NULL,
    status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved')),
    approved_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS architecture_docs (
    id          uuid PRIMARY KEY,
    project_id  uuid NOT NULL REFERENCES projects(id),
    version     int NOT NULL DEFAULT 1,
    document    jsonb NOT NULL,
    repo_layout jsonb,
    build_plan  jsonb NOT NULL DEFAULT '[]',
    test_plan   jsonb NOT NULL DEFAULT '[]',
    status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gates (
    id          uuid PRIMARY KEY,
    project_id  uuid NOT NULL REFERENCES projects(id),
    code        text NOT NULL CHECK (code IN ('G0','G1','G2','G3','G4','G5','G6')),
    criteria    jsonb NOT NULL DEFAULT '[]',
    artifacts   uuid[] NOT NULL DEFAULT '{}',
    approver    text,
    status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','approved','rejected')),
    decided_at  timestamptz,
    UNIQUE (project_id, code)
);

CREATE TABLE IF NOT EXISTS jobs (
    id              uuid PRIMARY KEY,
    project_id      uuid NOT NULL REFERENCES projects(id),
    kind            text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}',
    status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','cancelled')),
    runner_log_id   uuid,
    attempts        int NOT NULL DEFAULT 0,
    max_attempts    int NOT NULL DEFAULT 3,
    idempotency_key text NOT NULL UNIQUE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    finished_at     timestamptz
);

CREATE TABLE IF NOT EXISTS runner_logs (
    id           uuid PRIMARY KEY,
    job_id       uuid NOT NULL REFERENCES jobs(id),
    command      text[] NOT NULL,
    cwd          text NOT NULL,
    exit_code    int NOT NULL,
    stdout_tail  text NOT NULL DEFAULT '',
    stderr_tail  text NOT NULL DEFAULT '',
    started_at   timestamptz NOT NULL,
    finished_at  timestamptz NOT NULL
);

ALTER TABLE jobs ADD CONSTRAINT jobs_runner_log_fk
    FOREIGN KEY (runner_log_id) REFERENCES runner_logs(id);

CREATE TABLE IF NOT EXISTS artifacts (
    id          uuid PRIMARY KEY,
    project_id  uuid NOT NULL REFERENCES projects(id),
    kind        text NOT NULL,
    platform    text,
    version     text NOT NULL,
    storage_key text NOT NULL,
    sha256      text NOT NULL,
    size_bytes  bigint NOT NULL,
    meta        jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, kind, platform, version, storage_key)
);

CREATE TABLE IF NOT EXISTS releases (
    id            uuid PRIMARY KEY,
    project_id    uuid NOT NULL REFERENCES projects(id),
    version       text NOT NULL,
    channel       text NOT NULL CHECK (channel IN ('stable','beta','alpha')),
    artifacts     uuid[] NOT NULL DEFAULT '{}',
    release_notes text NOT NULL DEFAULT '',
    status        text NOT NULL DEFAULT 'release_candidate' CHECK (status IN ('release_candidate','released','withdrawn')),
    approved_by   text,
    approved_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, version, channel)
);

CREATE TABLE IF NOT EXISTS lifecycle_events (
    id          uuid PRIMARY KEY,
    project_id  uuid NOT NULL REFERENCES projects(id),
    from_status text NOT NULL,
    to_status   text NOT NULL,
    gate_id     uuid REFERENCES gates(id),
    actor       text NOT NULL,
    reason      text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_providers (
    id       uuid PRIMARY KEY,
    name     text NOT NULL UNIQUE,
    base_url text NOT NULL,
    models   jsonb NOT NULL DEFAULT '[]',
    enabled  boolean NOT NULL DEFAULT false,
    key_ref  text NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_task_runs (
    id           uuid PRIMARY KEY,
    project_id   uuid REFERENCES projects(id),
    provider_id  uuid NOT NULL REFERENCES ai_providers(id),
    model        text NOT NULL,
    task_kind    text NOT NULL,
    prompt_ref   text NOT NULL,
    response_ref text NOT NULL,
    tokens_in    int,
    tokens_out   int,
    status       text NOT NULL CHECK (status IN ('ok','error','rate_limited','timeout')),
    error        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          uuid PRIMARY KEY,
    actor       text NOT NULL,
    action      text NOT NULL,
    object_type text NOT NULL,
    object_id   text NOT NULL,
    detail      jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_jobs_project_status ON jobs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id, kind);
CREATE INDEX IF NOT EXISTS idx_lifecycle_project ON lifecycle_events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
