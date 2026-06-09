# ExoPaper RAG 🌌

**ExoPaper RAG** — это интеллектуальная аналитическая платформа для исследования экзопланет и связанных с ними научных публикаций. Система объединяет реляционные данные NASA Exoplanet Archive с возможностями локальных языковых моделей (LLM) через гибридный векторный поиск (Retrieval-Augmented Generation) на базе СУБД RavenDB. Она выявляет противоречия и неопределенности в научных статьях, а также визуализирует звездные системы в интерактивном 3D-интерфейсе.

---

## 🛠 Технологический стек

- **Бэкенд:** .NET 9, ASP.NET Core, MediatR (CQRS), Polly (устойчивость к сбоям), Quartz.NET (расписание задач).
- **База данных:** RavenDB 7.0 (кластер из 3 нод, MapReduce индексы, векторный поиск Corax, Transactional Outbox).
- **AI/LLM:** Ollama (локальные модели `nomic-embed-text` для эмбеддингов и `llama3:8b` для генерации ответов RAG).
- **Фронтенд:** React 19, TypeScript, Vite, Tailwind CSS v4, Zustand.
- **Интерактивный 3D холст:** Three.js, React Three Fiber (R3F), Drei.
- **Real-time транспорт:** SignalR (WebSockets) с автоматическим переподключением.
- **Оркестрация и проксирование:** Docker Compose, Nginx.

---

## 📂 Структура репозитория

```
ExoPaper/
├── ExoPaper.UI/                 # Фронтенд-приложение на React + TS + Vite
│   ├── src/
│   │   ├── api/                 # API клиенты (Axios)
│   │   ├── components/          # Компоненты UI (разбиты на layout, dashboard, three, planet, search)
│   │   ├── hooks/               # Кастомные хуки (SignalR)
│   │   ├── pages/               # Страницы приложения (Dashboard, Detail, Papers)
│   │   ├── stores/              # Zustand стейт-менеджер
│   │   └── types/               # TypeScript интерфейсы
│   └── nginx.conf               # Конфигурация Nginx для продакшена и проксирования
├── ExoPaperRAG.Api/             # ASP.NET Core Web API (Контроллеры, Hubs, CORS)
├── ExoPaperRAG.Application/     # Слой бизнес-логики (Commands, Queries, MediatR handlers)
├── ExoPaperRAG.Domain/          # Доменные сущности и правила тегирования
├── ExoPaperRAG.Infrastructure/  # Слой инфраструктуры (RavenDB, Ollama, Quartz Jobs, Workers)
├── docker-compose.yml           # Оркестрация контейнеров
└── ARCHITECTURE.md              # Подробное описание архитектуры, жизненного цикла данных и алгоритмов
```

---

## 🚀 Быстрый запуск (Docker Compose)

Самый быстрый способ поднять всю систему (БД, LLM, API, UI) — запустить Docker Compose.

### Требования
- Установленный Docker и Docker Compose.
- Желательно видеокарта NVIDIA с установленным Nvidia Container Toolkit (для ускорения инференса LLM).

### Команда запуска
В корневой папке проекта выполните:
```bash
docker compose up --build
```

### Что произойдет при первом запуске:
1. Поднимется кластер **RavenDB** из 3 нод (`ravendb-a`, `ravendb-b`, `ravendb-c`).
2. Запустится сервер **Ollama**.
3. Вспомогательный контейнер `ollama-init` дождется готовности Ollama и скачает модели `nomic-embed-text` (для векторного поиска) и `llama3:8b` (для RAG). *Это может занять некоторое время в зависимости от скорости интернета (около 5 ГБ).*
4. Скомпилируется бэкенд `ExoPaperRAG.Api`, который при запуске автоматически создаст базу данных `ExoPaper` и зарегистрирует все индексы в RavenDB.
5. Соберется фронтенд `ExoPaper.UI` и запустится под управлением Nginx на порту `3000`.

---

## 🛠 Локальная разработка (Local Development Setup)

Если вы хотите вносить изменения в код бэкенда или фронтенда с быстрой перезагрузкой (Hot Reload), рекомендуется запускать их локально.

### Шаг 1: Запуск базы данных и Ollama
Вы можете запустить только инфраструктуру через Docker:
```bash
docker compose up ravendb-a ravendb-b ravendb-c ollama
```
*Убедитесь, что модели загружены локально в Ollama:*
```bash
ollama pull nomic-embed-text
ollama pull llama3:8b
```

### Шаг 2: Настройка бэкенда (Web API)
1. Перейдите в папку `ExoPaperRAG.Api`.
2. Убедитесь, что в `appsettings.Development.json` прописаны локальные адреса:
   - RavenDB: `http://localhost:8080`, `http://localhost:8081`, `http://localhost:8082`
   - Ollama: `http://localhost:11434`
3. Запустите API:
   ```bash
   dotnet run
   ```
   API будет доступно по адресу `http://localhost:5000` (или другом порту, указанном в `launchSettings.json`).

### Шаг 3: Настройка фронтенда (React + Vite)
1. Перейдите в папку `ExoPaper.UI`.
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Запустите сервер разработки:
   ```bash
   npm run dev
   ```
   Фронтенд запустится на `http://localhost:5173`. Запросы к `/api/*` и `/hubs/*` будут автоматически проксироваться на бэкенд (поддерживается CORS для разработки).

---

## 📊 Таблица портов и сервисов

| Сервис | Локальный порт | Внутри Docker | Описание |
| :--- | :--- | :--- | :--- |
| **ExoPaper UI** | `3000` | `80` | Веб-интерфейс (React + Nginx) |
| **ExoPaper API** | `5000` | `8080` | ASP.NET Core Web API / SignalR |
| **RavenDB Node A** | `8080` | `8080` | Первичная нода БД + RavenDB Studio |
| **RavenDB Node B** | `8081` | `8080` | Вторичная нода БД |
| **RavenDB Node C** | `8082` | `8080` | Третичная нода БД |
| **Ollama Server** | `11434` | `11434` | Локальный сервер LLM (Inference) |

---

## 📂 Дополнительные материалы

- Для глубокого понимания архитектурных слоев, устройства фоновых воркеров (Embedding, Tagging, Outbox) и потока данных ознакомьтесь с [ARCHITECTURE.md](file:///C:/Users/BorShiik/Desktop/prog/CSharp/RavenDB/ExoPaper/ARCHITECTURE.md).
- Спецификация API-эндпоинтов, структуры индексов RavenDB и SignalR событий описаны в соответствующих подразделах `ARCHITECTURE.md`.