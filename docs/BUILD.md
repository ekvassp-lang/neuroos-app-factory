# BUILD — NeuroOS App Factory

## 1. Локальная сборка (пакеты и веб)

Требуется: Node.js 22+, pnpm 10+.

```bash
pnpm install
pnpm typecheck   # сборка всех пакетов (для разрешения типов из dist/) + tsc --noEmit
pnpm build       # dist/ у 6 пакетов + apps/web/dist (Vite, включая PWA-файлы)
pnpm test        # 87 тестов (vitest)
```

Состав сборки:

| Пакет | Результат |
|---|---|
| core-contracts, gate-service, runner, ai-provider, sync-engine, design-system | `dist/` (tsc, ESM + d.ts) |
| apps/server | `dist/` (Fastify API) |
| apps/web | `dist/` (Vite: index.html, assets/, sw.js, manifest.webmanifest, icons/) |

## 2. Десктоп-сборки (Tauri 2)

Конфигурация: `src-tauri/` (schema v2). Целевые форматы задаются в
`.github/workflows/desktop.yml`.

Требования по ОС:

- **Linux:** libwebkit2gtk-4.1-dev, libgtk-3-dev, libayatana-appindicator3-dev, librsvg2-dev
- **Windows:** MSVC Build Tools (стандартный раннер GitHub достаточно)
- **macOS:** Xcode CLT (стандартный раннер GitHub достаточно)

Локальная сборка (если системные зависимости установлены):

```bash
pnpm dlx @tauri-apps/cli@^2 icon src-tauri/icons/icon.png   # генерация icns/ico
pnpm -r build
pnpm dlx @tauri-apps/cli@^2 build --bundles deb   # пример для Linux
```

## 3. CI-сборка (основной способ)

Workflow `.github/workflows/desktop.yml` — матрица на трёх ОС:

| Раннер | Форматы |
|---|---|
| windows-latest | nsis, msi |
| macos-latest | app, dmg |
| ubuntu-latest | appimage, deb, rpm |

Запуск: push тега `v*` (workflow_dispatch требует прав Actions у App-интеграции).
Результат — черновой релиз `v__VERSION__` с артефактами (tauri-action).
Версия берётся из `src-tauri/tauri.conf.json` и `src-tauri/Cargo.toml` (сейчас 0.1.0).

Проверенный факт: run 43434053581 собрал 7 артефактов на 3 ОС SUCCESS.

## 4. Контрольные суммы

```bash
sha256sum NeuroOS.App.Factory* > checksums-sha256.txt
```

Для v0.1.0 суммы зафиксированы в `releases/v0.1.0/checksums-sha256.txt`.
Артефакты без совпадающих сумм отклоняются сервером (POST артефакта → 409).

## 5. CI-верификация (каждый push)

`.github/workflows/ci.yml`: pnpm install --frozen-lockfile → typecheck → build →
test → security scan (secrets + SAST, блокирующий) → pnpm audit --prod
(continue-on-error).

## 6. Известные ограничения сборки

- Локальная Tauri-сборка невозможна без системных webkit2gtk-библиотек (Linux) —
  используйте CI.
- icns/ico генерируются в CI (`tauri icon`) — в репозитории только PNG-исходники.
- Подпись артефактов (Authenticode/codesign/notarization) — NOT IMPLEMENTED,
  нужны сертификаты владельца.
- Android/iOS — NOT IMPLEMENTED (нужны тулчейны).
