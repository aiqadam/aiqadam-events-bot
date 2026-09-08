# aiqadam-events-bot

Telegram-бот событий AI Qadam: публикация ивентов, регистрация участников, чекин по QR
через Telegram Mini App, сегментные рассылки. Несущий стек — [Qadam Flow](https://github.com/aiqadam/qadam-flow).

> Events bot for AI Qadam meetups — registration, QR check-in via Telegram Mini App,
> segmented broadcasts. Built on top of Qadam Flow (self-hosted workflow automation).

**Цель — 0 кода.** Вся логика собирается на Qadam Flow: флоу, subflow-«функции»,
core-qadam'ы и Tables. Максимум, что допускается, — Code steps внутри флоу.
Артефакт проекта — экспортированные JSON'ы флоу и схема таблиц, а не приложение.
Единственное исключение — статическая страница Mini App для сканера контролёра.

**Статус: только документы.** Сначала фиксируем ТЗ, модель данных и раскладку
на флоу, потом агенты собирают их по этим документам.

## Документы

| Файл | О чём |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | Функциональное ТЗ: роли, сценарии, правила |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Раскладка на Qadam Flow: qadam, flows, Tables, Mini App |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Таблицы, поля, ключи идемпотентности |
| [docs/FLOWS.md](docs/FLOWS.md) | Пофлоувая разбивка сценариев |
| [docs/SECURITY.md](docs/SECURITY.md) | Подпись QR, initData, инвайт-токены, согласия |
| [docs/I18N.md](docs/I18N.md) | ru/uz/en, внешние файлы строк |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Пакеты работ под агентов, с зависимостями |
| [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | Что надо проверить/решить до кода |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Порядок работ и волны для агентов |
| [docs/STATUS.md](docs/STATUS.md) | Индекс работ: кто что взял, что готово |
| [docs/work/](docs/work/) | Журналы пакетов работ |
| [docs/adr/](docs/adr/) | Архитектурные решения |
| [catalog/](catalog/) | Агентский каталог — живое состояние flows и таблиц |

## Модель работы

Практика `qadam-flow-project-template` (BPM Hero): **только MCP + UI, без REST API**.

```
🤖 MCP: строим и меняем flows
🖥️  UI: проект, connections, variables
📁 git: catalog/*.md — источник правды, агент ведёт его по живому состоянию
```

## Правила работы

Читать [CLAUDE.md](CLAUDE.md) перед любым изменением. Коротко: документы —
единственный источник правды, ТЗ в `docs/SPEC.md` не переписывается «по ходу»,
расхождения оформляются как ADR или запись в OPEN-QUESTIONS.
