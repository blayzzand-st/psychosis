# PsychosIS

Учебная госпитальная информационная система: React, FastAPI и PostgreSQL.

## Запуск одной командой

Нужен Docker с Compose: Docker Desktop в режиме Linux containers на Windows/macOS
или Docker Engine с Compose plugin на Linux. Команда выполняется из корня проекта:

```sh
docker compose up -d --build --wait
```

При первом запуске Docker скачает образы, соберёт frontend и backend, создаст базу
и дождётся готовности всех трёх сервисов. Локальные Python, Node.js и PostgreSQL
не нужны. Сборки используют образы для x86-64 и ARM64, без привязки к путям Windows.

- Приложение: http://localhost:8080
- Документация API: http://localhost:8080/docs
- Проверка API: http://localhost:8080/api/health

Nginx раздаёт собранный frontend и перенаправляет запросы `/api` в backend.
Прямое открытие страниц, например `/administrator`, поддерживается.
PostgreSQL и backend не публикуют порты на компьютере.
Настройка использует HTTP; TLS из ЛР2 пока не реализован.

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
перезапустите Compose и откройте `http://IP-компьютера:8080`.
Настройки `backend/.env` относятся к запуску без Docker и не попадают в образы.

## Запуск без Docker

Инструкции: [backend](backend/README.md) и [frontend](frontend/README.md).
