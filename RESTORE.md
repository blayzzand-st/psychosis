# Восстановление PsychosIS из резервной копии

Инструкция для PowerShell на Windows. Все команды выполняются из корня проекта,
где находится `compose.yaml`. Нужен запущенный Docker Desktop в режиме Linux containers.
Для контейнерного приложения локальные PostgreSQL и Node.js не требуются.
Для выпуска TLS-сертификатов скриптом нужны Python 3 и OpenSSL (входит в Git for Windows).

## Подготовленная резервная копия

- Дата создания: 30 октября 2026 года, 12:11:55 (Москва).
- Файл: `backend/backups/psychosis-2026-10-30_12-11-55.dump`.
- Формат: архив PostgreSQL (`pg_dump -Fc`).
- База: `psychosis`, PostgreSQL 18.
- Содержимое: таблицы, данные, ограничения, индексы и счётчики ID.
- Контрольная сумма хранится рядом, в файле с окончанием `.dump.sha256`.

Копия проверена восстановлением в отдельную временную БД: 14 таблиц;
5 пациентов, 5 медработников, 3 ЭМК, 5 пользовательских аккаунтов, 32 события аудита.
SHA-256: `f76ad319bc79dd4ae759018c5b61d7f2ee415587e143e597a724512e1e46391f`.

Дамп содержит данные приложения, парольные хэши, TOTP-секреты и ключи JWT. Он исключён из Git; на другое устройство его
нужно передать отдельным файлом. Корневой `.env`, если он настроен, также
переносится отдельно либо создаётся по `.env.example`.
Файл `backend/.env` для запуска через Compose не нужен.

## 1. Получаем проект на другом устройстве

```powershell
git clone https://github.com/blayzzand-st/psychosis.git
cd psychosis
New-Item -ItemType Directory -Force backend/backups | Out-Null
```

Если проект уже скачан, открываем его папку и обновляем код:

```powershell
git pull --ff-only
```

Копируем дамп и файл контрольной суммы в папку `backend/backups`.
Сохраняем исходное имя дампа. При желании проверяем SHA-256:

```powershell
Get-FileHash backend/backups/psychosis-2026-10-30_12-11-55.dump -Algorithm SHA256
Get-Content backend/backups/psychosis-2026-10-30_12-11-55.dump.sha256
```

Контрольные суммы должны совпадать; регистр букв значения не имеет.

## 2. Подготавливаем базу

**Восстановление заменяет существующие таблицы из дампа и их содержимое.
Если на устройстве уже есть нужные данные, сначала создаём их резервную копию
по разделу ниже. Восстановление не объединяет две базы.**

Если приложение уже запущено, останавливаем frontend и backend, чтобы они
не изменяли данные во время восстановления:

Если frontend/backend запущены локальными процессами, их также нужно остановить
на время восстановления; команда compose stop останавливает только контейнеры.

```powershell
docker compose stop frontend backend
```

Запускаем только PostgreSQL и дожидаемся готовности:

```powershell
docker compose up -d --wait db
```

## 3. Восстанавливаем данные

```powershell
docker compose cp backend/backups/psychosis-2026-10-30_12-11-55.dump db:/tmp/psychosis-restore.dump
if ($LASTEXITCODE -ne 0) { throw 'Не удалось скопировать дамп' }

docker compose exec -T db pg_restore -U psychosis -d psychosis --clean --if-exists --no-owner --no-privileges --single-transaction /tmp/psychosis-restore.dump
if ($LASTEXITCODE -ne 0) { throw 'Восстановление не выполнено. Проверь вывод pg_restore' }
```

Успешный `pg_restore` может завершиться без текста в терминале.
Параметр `--single-transaction` откатывает изменения восстановления при ошибке.
Для этой копии используем PostgreSQL 18, как задано в `compose.yaml`.

## 4. Создаём сертификаты и запускаем приложение

Перед первым запуском на новом компьютере:

```powershell
python scripts/init_tls.py --isu 368833
Import-Certificate -FilePath .local/tls/ca.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Другие случаи, в том числе подключение по сети: [ANOTHER-DEVICE.md](ANOTHER-DEVICE.md).
Выпуск TLS-сертификатов не меняет ключи JWT, восстановленные из БД.



```powershell
docker compose up -d --build --wait
docker compose ps
```

У сервисов `db`, `backend` и `frontend` должен быть статус `healthy`.

- Приложение: <https://localhost:8080>.
- Проверка API: <https://localhost:8080/api/health>, ответ `{"status":"ok"}`.

Если в `.env` изменён `APP_PORT`, используем этот порт вместо 8080.
Проверяем списки пациентов, медработников и содержимое ЭМК.

При ошибках смотрим журнал:

```powershell
docker compose logs --tail=100 db backend frontend
```

## Создание новой резервной копии

Команды выполняем на устройстве, где находятся актуальные данные:

```powershell
New-Item -ItemType Directory -Force backend/backups | Out-Null
$backupName = 'psychosis-' + (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss') + '.dump'

docker compose exec -T db pg_dump -U psychosis -d psychosis -Fc -f "/tmp/$backupName"
if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать дамп' }

docker compose cp "db:/tmp/$backupName" "backend/backups/$backupName"
if ($LASTEXITCODE -ne 0) { throw 'Не удалось скопировать дамп' }

$digest = (Get-FileHash "backend/backups/$backupName" -Algorithm SHA256).Hash.ToLowerInvariant()
"$digest  $backupName" | Set-Content "backend/backups/$backupName.sha256" -Encoding ascii
Get-Item "backend/backups/$backupName" | Select-Object FullName, Length
```

База должна быть запущена. Дамп сохраняет согласованный снимок на момент начала
копирования; изменения, сделанные позже, в него не входят.
При восстановлении другой копии заменяем имя файла в командах раздела 3.

## Сохранность данных

Данные Docker-базы находятся в томе `psychosis_postgres_data_v18`.
Остановка через `docker compose down` сохраняет том.
Команда `docker compose down -v` удаляет том вместе с базой.
Храним резервную копию отдельно от устройства с рабочей базой.
