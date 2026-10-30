# Защита трафика — ЛР2

Браузер → Vite (локально) или Nginx (Docker) → FastAPI: оба участка
используют **только TLS 1.3**. TLS 1.2 и более ранние версии отклоняются.
HTTP-порты приложения больше не обслуживаются. Данные PostgreSQL сохраняются.

Создан собственный корневой CA. Его Subject и Issuer одинаковы:
`O=ITMO, OU=MedSoft 2026/27 368833, CN=PsychosIS Lab Root CA`.
У серверных сертификатов Subject — `CN=localhost` с теми же O/OU,
а Issuer — наш CA. Subject указывает владельца сертификата, Issuer — того,
кто его подписал. Подпись сертификата SHA-256/RSA и версия TLS — разные параметры.

Пошагово для другого устройства: [ANOTHER-DEVICE.md](ANOTHER-DEVICE.md).

## Первый запуск и доверие

Нужен OpenSSL (Windows: входит в Git for Windows; Linux: пакет openssl).
Из корня проекта, с Python 3:

```sh
python scripts/init_tls.py --isu 368833
```

Создаются `.local/tls/ca.crt`, `ca.key`, `server.crt`, `server.key`,
`backend.crt`, `backend.key`. Корень действует 10 лет, серверные сертификаты —
365 дней. Повторный запуск сохраняет CA и перевыпускает серверные сертификаты.
В Git и Docker-образы ключи не попадают. В контейнеры монтируются только необходимые
сертификаты и серверные ключи, без закрытого ключа CA.

Windows: установить **только ca.crt** в доверенные корневые центры текущего пользователя:

```powershell
Import-Certificate -FilePath .local/tls/ca.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Chrome/Edge используют доверие Windows. Если браузер уже был запущен, может
потребоваться перезапуск. Firefox при необходимости: Настройки → Приватность и защита →
Сертификаты → Центры сертификации → импорт ca.crt для идентификации сайтов.
Не обходите предупреждения и не отключайте проверку сертификатов.

Linux (Debian/Ubuntu): скопировать ca.crt в
`/usr/local/share/ca-certificates/psychosis-lab.crt`, выполнить
`sudo update-ca-certificates`. macOS: импортировать ca.crt в «Связку ключей» и
установить доверие для SSL. На новом устройстве можно создать свой CA или установить
доверие к публичному ca.crt существующего сервера; закрытый ca.key клиентам не нужен.

## Локальные frontend/backend, PostgreSQL в Docker

После установки зависимостей и настройки backend/.env:

```powershell
.\start-local.ps1 -TrustCa
```

Следующие запуски: `./start-local.ps1`. Docker Desktop должен работать.
Скрипт останавливает контейнеры frontend/backend, запускает только db, затем
локальные API и Vite с автоматическим обновлением. Журналы: `.local/*-local.*.log`.

Адрес приложения: **https://localhost:5173**. API: **https://localhost:8000/docs**.
Старые адреса http:// не работают. После перехода на HTTPS может потребоваться вход.

Ручной запуск API из backend: `$env:API_RELOAD='1'; python -m app.serve`.
Ручной запуск frontend из frontend: `npm run dev`.

Vite проверяет CA, имя API и срок сертификата через Node HTTPS Agent;
`secure: false` и `rejectUnauthorized: false` не используются.
API самостоятельно завершает TLS, не доверяет клиентским X-Forwarded-*.
Поэтому CSRF сверяет HTTPS Origin, а сессионные cookie получают флаг Secure.

## Всё приложение в Docker

Сначала создать сертификаты и установить доверие, затем:

```sh
docker compose up -d --build --wait
```

Адрес: **https://localhost:8080**. Nginx проверяет цепочку и имя `backend` при
подключении к API; SSE аудита проходит по тому же HTTPS-соединению.
Проверки готовности также проверяют сертификаты. Backend недоступен напрямую снаружи.

Для доступа по имени/IP другого устройства добавьте его в сертификаты:
`python scripts/init_tls.py --isu 368833 --host 192.168.1.10 --host psychosis.example`.
Затем перезапустите процессы/контейнеры и настройте APP_HOST=0.0.0.0 для Docker.
IP должен совпадать с фактическим адресом сервера. На клиентах доверять ca.crt.
Локальные Vite/API по умолчанию слушают только loopback.

## Проверка

Автоматическая проверка локальных frontend/API: `python scripts/check_tls.py`.
Для Docker: `python scripts/check_tls.py --ports 8080`.
Проверяются рабочий API через TLS 1.3, отказ TLS 1.2, отсутствие доверия к CA
и неверное имя сервера.

С OpenSSL проверить протокол и цепочку (должны быть TLSv1.3 и Verify return code: 0):

```sh
openssl s_client -connect localhost:5173 -servername localhost -CAfile .local/tls/ca.crt -verify_hostname localhost -verify_return_error -tls1_3
```

Та же команда с `-tls1_2` должна завершиться ошибкой согласования протокола.
В инструментах разработчика Chrome, вкладка Security: TLS 1.3, доверенная цепочка
до PsychosIS Lab Root CA. Проверять и страницу, и запросы `/api`.

Ссылки: [Vite HTTPS](https://vite.dev/config/server-options#server-https),
[Uvicorn SSL context](https://uvicorn.dev/deployment/),
[Nginx TLS и проверка upstream](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify).
