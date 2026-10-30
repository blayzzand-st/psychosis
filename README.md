# PsychosIS

Учебная госпитальная информационная система: React, FastAPI и PostgreSQL.

## Запуск одной командой

Нужен Docker с Compose: Docker Desktop в режиме Linux containers на Windows/macOS
или Docker Engine с Compose plugin на Linux. Перед первым запуском создайте сертификаты и установите доверие к учебному CA
по [инструкции TLS](TLS.md). Команда выполняется из корня проекта:

```sh
docker compose up -d --build --wait
```

При первом запуске Docker скачает образы, соберёт frontend и backend, создаст базу
и дождётся готовности всех трёх сервисов. Локальные Python, Node.js и PostgreSQL
не нужны. Сборки используют образы для x86-64 и ARM64, без привязки к путям Windows.

- Приложение: https://localhost:8080
- Документация API: https://localhost:8080/docs
- Проверка API: https://localhost:8080/api/health

Nginx раздаёт собранный frontend и перенаправляет запросы `/api` в backend.
Прямое открытие страниц, например `/administrator`, поддерживается.
PostgreSQL и backend не публикуют порты на компьютере.
Используется только TLS 1.3 на обоих участках: браузер → frontend → API.
Сертификаты проверяются; настройки и перенос доверия: [TLS.md](TLS.md).

Перенос на другой компьютер, установка доверия и доступ по сети:
[ANOTHER-DEVICE.md](ANOTHER-DEVICE.md). Восстановление данных: [RESTORE.md](RESTORE.md).

## Остановка и обновление

```sh
docker compose stop
docker compose up -d --build --wait
```

Проверка состояния и журналов:

```sh
docker compose ps
docker compose logs -f
```

Удалить контейнеры и сеть, сохранив базу:

```sh
docker compose down
```

Данные хранятся в Docker-томе `psychosis_postgres_data_v18` и сохраняются после
пересборки и `down`. Команда `docker compose down -v` удаляет базу вместе с томом.
На новом устройстве создаётся пустая база: перенос исходников не переносит данные.
Локальная база из `backend/.env` и Docker-база независимы.

## Необязательные настройки

Без `.env` приложение доступно только на этом компьютере, на порту 8080;
внутри Docker используется учебный пароль `psychosis_local_dev`.
Для изменения настроек создайте `.env` рядом с `compose.yaml` по `.env.example`:

```dotenv
APP_HOST=127.0.0.1
APP_PORT=8080
POSTGRES_PASSWORD=your_password
```

Пароль задаётся при первом создании тома. Изменение `.env` не меняет пароль
в уже существующей базе; его нужно менять в PostgreSQL одновременно с настройкой.
Специальные символы пароля не требуют URL-кодирования; в `.env` пароль с `$`
можно заключить в одинарные кавычки.

Для доступа с других устройств локальной сети задайте `APP_HOST=0.0.0.0`,
перезапустите Compose и откройте `https://IP-компьютера:8080`.
Настройки `backend/.env` относятся к запуску без Docker и не попадают в образы.

## Запуск без Docker

Инструкции: [backend](backend/README.md) и [frontend](frontend/README.md).

## Локальные frontend/backend и PostgreSQL в Docker

На Windows после первоначальной установки зависимостей:

```powershell
.\start-local.ps1 -TrustCa
```

Следующие запуски: `.\start-local.ps1`. Frontend/backend работают локально с HTTPS,
PostgreSQL — в контейнере. Подробнее: [TLS.md](TLS.md).

Для ручного запуска только базы (порт 5433, та же база в Docker-томе):

```sh
docker compose stop frontend backend
docker compose -f compose.yaml -f compose.local.yaml up -d --wait db
```

В `backend/.env` задаём `DATABASE_URL` с хостом `127.0.0.1`, портом `5433`,
базой и пользователем `psychosis`. Пароль — `POSTGRES_PASSWORD` из корневого
`.env` либо учебный `psychosis_local_dev`, если настройки не менялись.
В текущем рабочем окружении это подключение уже настроено.

В отдельном терминале, из `backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:API_RELOAD='1'
.\.venv\Scripts\python.exe -m app.serve
```

Установка dev-зависимостей нужна при первом запуске или изменении их списка;
они включают наблюдатель файлов для автоматического перезапуска API.

В другом терминале, из `frontend`:

```powershell
npm run dev
```

Приложение: https://localhost:5173; API: https://localhost:8000/docs.
При сохранении исходников frontend обновляется, backend перезапускается.
При первом запуске на новом компьютере предварительно устанавливаем зависимости
по инструкциям backend/frontend. Для изменения порта базы задаём `DB_PORT`
и тот же порт в `DATABASE_URL`.
