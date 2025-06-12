Локальный сервис для трекинга метрик, написанный на расте.

# Требования:
 - Rust (https://rustup.rs/)

# Сборка + настройка + запуск:
 - `cp config.yml.sample config.yml`
 - `nano config.yml` - Замените все параметры на нужные вам.
 - `cargo run --release`

# Схема API:
### Авторизация
 - Header: `Authorization: user-name:password`
### Эндпоинты
 - `/api/create-project`
    Метод: **POST**
    Параметры JSON:
     - name: String

    Возврат:
     - `{"ok": bool}`

 - `/api/push-metrics`
    Метод: **POST**
    Параметры JSON:
     - project_name: String
     - run_name: String
     - metrics: Object

    Возврат:
     - `{"ok": bool, "message": String} || {"ok": bool}`

 - `/api/get-run`
    Метод: **POST**
    Параметры JSON:
     - project_name: String
     - run_name: String

    Возврат:
     - `{"ok": bool, "metrics": Vec<Object>} || {"ok": bool, "message": String} || {"ok": bool}`
