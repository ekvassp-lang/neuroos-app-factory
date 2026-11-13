# INSTALLATION — NeuroOS App Factory

## A. Установка из исходников (основной способ)

Требуется: Node.js 22+, pnpm 10+.

```bash
git clone https://github.com/ekvassp-lang/neuroos-app-factory.git
cd neuroos-app-factory
pnpm install
pnpm build
```

Запуск сервера (порт 3000):

```bash
node apps/server/dist/main.js
# или в режиме разработки:
pnpm --filter @neuroos/server dev
```

Проверка: откройте `http://127.0.0.1:3000/healthz` — ожидается `{"status":"ok","version":"0.7.0","auth":"disabled",...}`.

Веб-оболочка:

```bash
# разработка:
pnpm --filter @neuroos/web dev   # http://localhost:5173
# продакшен-сборка (PWA-файлы в apps/web/dist):
pnpm --filter @neuroos/web build
```

## B. Установка десктоп-приложения (готовые сборки)

Готовые установщики — на странице релизов:
https://github.com/ekvassp-lang/neuroos-app-factory/releases

| Платформа | Файл | Действие |
|---|---|---|
| Windows | `NeuroOS.App.Factory_0.1.0_x64-setup.exe` | запустить и следовать мастеру |
| Windows | `..._x64_en-US.msi` | запустить msi-установщик |
| macOS (Apple Silicon) | `..._aarch64.dmg` | открыть dmg, перетащить в Applications |
| macOS | `..._aarch64.app.tar.gz` | распаковать в Applications |
| Linux | `..._amd64.AppImage` | `chmod +x` и запустить |
| Linux | `..._amd64.deb` | `sudo apt install ./NeuroOS.App.Factory_0.1.0_amd64.deb` |
| Linux | `...-1.x86_64.rpm` | `sudo rpm -i NeuroOS.App.Factory-0.1.0-1.x86_64.rpm` |

Перед установкой сверьте SHA-256 с `releases/v0.1.0/checksums-sha256.txt`:

```bash
sha256sum NeuroOS.App.Factory_0.1.0_amd64.deb
```

**Честное предупреждение:** сборки не подписаны (сертификаты не предоставлены) —
macOS покажет предупреждение Gatekeeper (ПКМ → «Открыть»), SmartScreen на Windows
потребует «Выполнить в любом случае». Проверка интерактивной установки на реальных
ОС — NOT TESTED (см. docs/AUDIT.md).

## C. Удаление

- **Из исходников:** остановите процесс сервера и удалите каталог репозитория.
  Данные по умолчанию: `data/` внутри каталога репозитория (снапшот состояния,
  артефакты) — удалите их отдельно, если не нужны.
- **Windows:** «Параметры → Приложения» → NeuroOS App Factory → Удалить.
- **macOS:** удалить из папки Applications.
- **Linux:** `sudo apt remove neuroos-app-factory` / `sudo rpm -e neuroos-app-factory`;
  AppImage — просто удалить файл.

## D. Восстановление после сбоя

Сервер хранит состояние в JSON-снапшоте (атомарная запись). Восстановление:

1. Остановите сервер.
2. Сделайте копию снапшота (бэкап): `cp data/state/factory-state.json ~/backup/`.
3. После сбоя верните файл на место и запустите сервер — состояние загрузится
   автоматически (проверено тестом: имя, статус, revision восстанавливаются точно).
4. Повреждённый/отсутствующий снапшот не приводит к падению: сервер стартует
   с чистым состоянием (честное поведение, проверено тестом).

Рекомендация: периодически копировать `data/state/factory-state.json` и каталог
`data/artifacts/`.

## E. Проверка обновлений

В UI: Release Center → «UPDATE MANAGER — проверка обновлений» (канал + текущая
версия). Программно: `GET /api/v1/updates/latest?channel=stable&currentVersion=0.1.0`.
Автозагрузка/применение обновлений — NOT IMPLEMENTED (нужны ключи подписи).
