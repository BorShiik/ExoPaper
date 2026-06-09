# ExoPaper RAG: Архитектура и Документация Проекта

**ExoPaper RAG** — это полностековая исследовательская платформа, объединяющая астрофизические данные об экзопланетах и массив научных публикаций в единую аналитическую систему. Платформа использует технологии **RAG (Retrieval-Augmented Generation)**, векторного поиска и локальных нейросетей для умного анализа расхождений в научных данных, а также предоставляет интерактивный 3D-интерфейс для визуализации планетных систем.

---

## 🌟 Ключевые функции (Features)

1. **Автоматический сбор данных (Harvesters):**
   - Ежедневная синхронизация открытых экзопланет через NASA Exoplanet Archive API.
   - Сбор научных статей и препринтов по экзопланетам через arXiv API.
2. **Гибридный поиск (Hybrid RAG Search):**
   - Комбинация традиционного полнотекстового поиска (Full-Text Search) и векторного поиска по смыслу (Cosine Similarity).
   - Фильтрация результатов по метаданным (масса планеты, метод открытия).
3. **AI Анализ неопределенностей (Uncertainty Tracking):**
   - Локальная генерация ответов с помощью **Ollama (`llama3:8b`)**. AI анализирует разные статьи по одной планете и составляет сводку (summary) противоречивых измерений (например, разные оценки массы или орбиты в разных статьях).
4. **Real-time уведомления (SignalR + Outbox):**
   - Мгновенное обновление UI при векторизации новых статей или автоматическом тегировании новых планет.
5. **Интерактивная 3D визуализация:**
   - Процедурная генерация звезд (цвет зависит от эффективной температуры) и планет в браузере.
   - Анимация орбит, экзозодиакальной пыли и эффекта "Stellar Jitter" для планет, открытых методом радиальных скоростей.

---

## 🏗 Полная Архитектура Системы

Проект построен на базе микросервисной и событийно-ориентированной архитектуры и упакован в **Docker Compose**.

### 1. Технологический Стек

* **Backend:** C# / ASP.NET Core 9
* **Database:** RavenDB (NoSQL Документная база с поддержкой векторов)
* **AI / LLM:** Ollama (Контейнеризированный локальный сервер нейросетей)
* **Frontend:** React 19, TypeScript, Vite
* **Стили и UI:** Tailwind CSS v4, shadcn/ui
* **3D Движок:** Three.js, `@react-three/fiber`, `@react-three/drei`
* **Real-time:** SignalR WebSockets
* **Оркестрация:** Docker Compose, Nginx

---

### 2. Топология Контейнеров (Docker Compose)

Система разворачивается локально с помощью 4 основных узлов:

1. `exopaper_db_a/b/c` — Кластер **RavenDB**, обеспечивающий распределенное хранение документов, автоматическое построение индексов (Auto-Indexes), MapReduce статистику и векторный поиск (Vector Search).
2. `exopaper_ollama` — Сервер **Ollama** (запущенный с поддержкой GPU). Хранит в себе 2 модели:
   * `nomic-embed-text` — используется для превращения текста статей в вектора чисел (эмбеддинги).
   * `llama3:8b` — используется для генерации текста и аналитики (RAG).
3. `exopaper_api` — **ASP.NET Core 9 API**. Ядро бизнес-логики.
4. `exopaper_ui` — **Nginx + статичные файлы React**. Раздает UI и проксирует `/api/` запросы на бэкенд, избегая проблем с CORS.

---

### 3. Архитектура Бэкенда (C# ASP.NET Core)

Бэкенд спроектирован по принципам Clean Architecture и CQRS.

* **API Layer (`Controllers`, `Hubs`)**
  - Принимает HTTP REST запросы (`PapersController`, `ExoplanetsController`).
  - SignalR Хаб (`ExoPaperHub`) поддерживает WebSocket соединения от клиентов.
* **Application Layer (`MediatR`)**
  - Изолирует бизнес-логику в виде Commands и Queries.
  - Пример: `SearchHybridQuery` обращается одновременно к полнотекстовому поиску и к векторному.
* **Infrastructure Layer (`Services`, `Workers`, `Indexes`)**
  - `OllamaClient`, `NasaClient`, `ArxivClient` — типизированные HTTP-клиенты, обернутые в политики устойчивости **Polly** (Retry, Circuit Breaker).
  - Набор статических индексов RavenDB (`Exoplanets_ByHabitability`, `Papers_ByVector`), которые компилируются на лету.
  - **Quartz.NET** планировщик: содержит джобы `NasaSyncJob` и `ArxivHarvesterJob`, запускающиеся по расписанию (Cron).

#### Фоновые процессы (Background Workers)
Для обработки тяжелых задач без торможения API используются `BackgroundService`:
* **EmbeddingWorker**: Постоянно поллит базу данных (Data Subscriptions). Ищет статьи, у которых `HasEmbeddings == false`, отправляет их текст в Ollama, получает вектор и сохраняет обратно в базу.
* **TaggingWorker**: Анализирует новые экзопланеты. Если планета подходит под критерии обсерватории HWO (Habitable Worlds Observatory), автоматически вешает на неё тег `HWO Candidate`.
* **OutboxDispatcher**: Реализует паттерн **Transactional Outbox**. Когда любой воркер делает изменение в базе, он кладет событие в коллекцию `OutboxEvents`. Диспетчер читает эту коллекцию и рассылает события всем подключенным веб-клиентам через SignalR.

---

### 4. Архитектура Фронтенда (React + Vite)

Frontend построен как SPA (Single Page Application) с фокусом на производительность и потрясающий UI в стиле "Deep Space".

* **Роутинг (`react-router-dom`)**:
  - `/` (DashboardPage) — статистика, диаграммы (DiscoveryChart) и панель гибридного поиска.
  - `/planet/:id` (PlanetDetailPage) — детальная страница планеты с 3D-моделью и аналитикой RAG.
  - `/papers` (PapersPage) — каталог научных публикаций с Full-Text поиском.
* **State Management (`Zustand`)**:
  - Исключена сложная связка Redux. `appStore` хранит только логи событий SignalR и статус подключения к серверу.
* **SignalR Hook (`useSignalR.ts`)**:
  - Кастомный хук, который при загрузке страницы устанавливает WebSocket-соединение с автоматическим переподключением (`withAutomaticReconnect`). Слушает события и пушит их в Zustand.
* **3D Движок (`components/three`)**:
  - `ExoplanetScene` — холст сцены.
  - Компоненты (`PlanetMesh`, `StarMesh`) чистые и реактивные. Для соблюдения правил React 19 Strict Mode в них не используются `Math.random` внутри рендера, генерация процедурных элементов происходит детерминированно.

---

## 🔄 Жизненный Цикл Данных (Data Flow)

Рассмотрим, как новая статья проходит через систему и попадает на экран к пользователю:

1. **Ingestion**: `ArxivHarvesterJob` (Quartz) просыпается ночью, скачивает метаданные статьи по API и сохраняет документ типа `Paper` в RavenDB (с полем `HasEmbeddings: false`).
2. **Vectorization**: `EmbeddingWorker` обнаруживает новую статью, скармливает её в `Ollama` (`nomic-embed-text`) и получает массив из 768 чисел.
3. **Transaction**: В рамках одной транзакции в RavenDB воркер сохраняет полученный вектор в статью и записывает в базу объект `OutboxEvent` ("Статья X векторизована").
4. **Broadcasting**: `OutboxDispatcher` замечает новое событие в базе, берет его и отправляет через `IRealtimeNotifier` (SignalR) в WebSocket.
5. **UI Update**: `useSignalR` на стороне React ловит событие. Пользователь видит всплывающее уведомление (Toast) "Статья X векторизована ✓", а счетчики статистики на Дашборде автоматически увеличиваются.

---

## 🚀 Настройка и Запуск

### Требования
- `Docker` и `Docker Compose`.
- Видеокарта с поддержкой CUDA (опционально, для работы Ollama через GPU).
- Установленный .NET 9 SDK и Node.js v20+ (для локальной разработки без Docker).

### Запуск через Docker Compose (Рекомендуемый способ)
1. **Сборка и запуск кластера:**
   ```bash
   docker compose up --build
   ```
2. **Ожидание инициализации:**
   При первом запуске контейнер `ollama-init` автоматически скачает модели `nomic-embed-text` (эмбеддинги) и `llama3:8b` (RAG генерация). Загрузка занимает около 5 ГБ трафика. Бэкенд-сервер при этом использует политики повторных попыток (Polly Retry) для ожидания готовности баз данных и моделей Ollama.
3. **Использование систем:**
   - Веб-интерфейс: [http://localhost:3000](http://localhost:3000)
   - RavenDB Studio (Панель управления Node A): [http://localhost:8080](http://localhost:8080)
   - RavenDB Studio (Node B / Node C): [http://localhost:8081](http://localhost:8081) / [http://localhost:8082](http://localhost:8082)
   - Swagger / OpenAPI бэкенда: [http://localhost:5000/openapi/v1.json](http://localhost:5000/openapi/v1.json)

---

## 🗺 Подробная спецификация API Эндпоинтов

Ниже приведен список эндпоинтов, реализованных на бэкенде в проекте `ExoPaperRAG.Api`.

### 1. Экзопланеты (`/api/Exoplanets`)

| Метод | Путь | Описание | Параметры / Тело |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/exoplanets` | Добавить новую планету в БД | Тело: `Exoplanet` (JSON) |
| **GET** | `/api/exoplanets` | Постраничный список планет с сортировкой и фильтрацией | Query: `discoveryMethod` (опц.), `skip` (по умолч. 0), `take` (по умолч. 10), `sortBy` (опц. `orbitalPeriod`) |
| **GET** | `/api/exoplanets/{**id}` | Получить экзопланету по уникальному ID. Поддерживает слеши в ID. | Путь: `id` (например, `exoplanets/Kepler-186 f`) |
| **PUT** | `/api/exoplanets/{**id}` | Обновить поля планеты по ID | Путь: `id`, Тело: `Exoplanet` |
| **DELETE** | `/api/exoplanets/{**id}` | Удалить планету из БД | Путь: `id` |
| **GET** | `/api/exoplanets/habitable` | Список обитаемых планет | Query: `skip`, `take` (фильтрация через индекс `Exoplanets_ByHabitability`) |
| **GET** | `/api/exoplanets/stats` | Получить агрегированную статистику по методам открытий | Нет (использует Map-Reduce индекс `Exoplanets_StatsByDiscoveryMethod`) |
| **GET** | `/api/exoplanets/{**id}/uncertainty` | AI Сводка неопределенностей параметров планеты на основе статей | Путь: `id` (возвращает RAG-анализ через Ollama) |

### 2. Научные публикации (`/api/Papers`)

| Метод | Путь | Описание | Параметры / Тело |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/papers` | Создать документ научной статьи | Тело: `Paper` (JSON) |
| **GET** | `/api/papers/search` | Полнотекстовый поиск по аннотациям | Query: `query` (строка поиска, опц.), `skip`, `take` |
| **GET** | `/api/papers/exoplanet/{exoplanetId}` | Получить статьи, привязанные к планете | Путь: `exoplanetId` (например, `exoplanets/Kepler-186 f`) |
| **GET** | `/api/papers/{**id}/with-authors` | Получить статью вместе с документами авторов (оптимизация `Include`) | Путь: `id` (например, `papers/astro-ph/0001004`) |
| **POST** | `/api/papers/similar` | Векторный поиск ближайших похожих статей | Тело: `float[] queryVector`, Query: `take` |
| **POST** | `/api/papers/mark-reviewed` | Массово пометить все статьи как рецензированные | Нет (исполняет `PatchByQueryOperation` на RavenDB) |
| **POST** | `/api/papers/hybrid-search` | Гибридный RAG поиск (векторный поиск + реляционные фильтры) | Тело: `SearchHybridQuery` (запрос MediatR) |

### 3. Авторы публикации (`/api/Authors`)

| Метод | Путь | Описание | Параметры / Тело |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/authors/{id}` | Получить автора по его ID | Путь: `id` (автоматически преобразуется в `authors/{id}`) |
| **POST** | `/api/authors` | Записать нового автора | Тело: `Author` (JSON) |
| **PUT** | `/api/authors/{id}` | Обновить данные автора | Путь: `id`, Тело: `Author` |
| **DELETE** | `/api/authors/{id}` | Удалить автора | Путь: `id` |

### 4. Ручная синхронизация (`/api/Sync`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| **POST** | `/api/sync/nasa` | Вручную триггернуть задачу импорта экзопланет из NASA Archive |
| **POST** | `/api/sync/arxiv` | Вручную триггернуть импорт статей из arXiv |

---

## ⚡ Real-time События и SignalR

SignalR используется для мгновенной обратной связи от асинхронных бэкграунд-процессов. Бэкенд публикует события в хаб `/hubs/exopaper` с помощью паттерна **Transactional Outbox**.

### Поддерживаемые SignalR события на клиенте

1. **`PaperEmbedded`**
   - **Триггер**: `EmbeddingWorker` успешно сгенерировал векторный эмбеддинг для научной статьи через Ollama.
   - **Payload**:
     ```json
     {
       "PaperId": "papers/astro-ph/0001004",
       "Title": "Discovery of a planetary companion..."
     }
     ```
2. **`ExoplanetTagged`**
   - **Триггер**: `TaggingWorker` применил правила классификации к новой экзопланете (например, выявил её как кандидата для программы HWO).
   - **Payload**:
     ```json
     {
       "PlanetId": "exoplanets/Kepler-186 f",
       "Tags": ["HWO Candidate"]
     }
     ```

### Методы Хаба для подписки на группы (Scopes)
Пользователи могут изолировать получение real-time событий для конкретных страниц.
- **`JoinPlanetGroup(planetId)`**: Позволяет клиенту подписаться на real-time события конкретной планеты (например, при переходе на её страницу в UI).
- **`LeavePlanetGroup(planetId)`**: Отписывает клиента от группы планеты при переходе назад.

---

## 🔍 Индексы RavenDB и векторный поиск Corax

Проект использует 4 статических индекса, определенных в сборке `ExoPaperRAG.Infrastructure`. Они автоматически компилируются при старте приложения:

1. **`Exoplanets_ByHabitability`**
   - **Назначение**: Фильтрует планеты, находящиеся в habitable-зоне звезды.
   - **Логика**: Вычисляет булево поле `IsPotentiallyHabitable` на основе `StellarEffectiveTemperatureK` (должна быть задана) и `SemiMajorAxisAu` (в диапазоне `0.95 .. 1.37` астрономических единиц).
2. **`Exoplanets_StatsByDiscoveryMethod` (Map-Reduce)**
   - **Назначение**: Оптимизирует вывод сводной статистики по методам поиска для графиков на Дашборде.
   - **Логика**:
     - *Map*: Ассоциирует каждую планету с `DiscoveryMethod = Method`, `Count = 1`, `TotalMass = Mass`.
     - *Reduce*: Группирует результаты по `DiscoveryMethod`, суммирует `Count`, суммирует `TotalMass` и рассчитывает среднюю массу планеты (`AverageMass = TotalMass / Count`).
3. **`Papers_ByAbstractSearch`**
   - **Назначение**: Полнотекстовый поиск по статьям.
   - **Логика**: Индексирует поле `Abstract` с использованием `FieldIndexing.Search` (подключает токенизатор Lucene/Corax).
4. **`Papers_ByVector`**
   - **Назначение**: Векторный (семантический) поиск по научным статьям.
   - **Логика**: Вызывает метод `CreateVector(paper.Vector)` для поля векторов. Принудительно выставляет тип движка поиска `SearchEngineType.Corax` (требование RavenDB 7.0 для векторных вычислений и косинусного расстояния).

---

## ⚙ Параметры конфигурации (appsettings.Development.json)

Ниже перечислены основные разделы настроек приложения:

- **`RavenSettings`**
  - `Urls`: Массив строк с URL-адресами нод кластера RavenDB.
  - `DatabaseName`: Имя рабочей базы данных (по умолчанию `ExoPaper`).
- **`OllamaSettings`**
  - `BaseUrl`: Адрес сервера Ollama (например, `http://localhost:11434`).
  - `EmbeddingModel`: Используемая модель векторизации (`nomic-embed-text`).
  - `GenerationModel`: Модель для генерации RAG-ответов (`llama3:8b`).
- **`ArxivSettings`**
  - `BaseUrl`: Точка входа OAI-PMH API (по умолчанию `http://export.arxiv.org/oai2`).
  - `SetSpec`: Срез библиотеки arXiv для сбора статей (например, `physics:astro-ph` для астрофизики).
  - `RequestDelayMs`: Задержка в миллисекундах между запросами к arXiv для предотвращения блокировки (arXiv жестко ограничивает частоту запросов).
  - `MaxPagesPerRun`: Ограничение на количество запрашиваемых страниц за один запуск джобы.
- **`NasaApiSettings`**
  - `BaseUrl`: Точка доступа NASA Exoplanet Archive (TAP).

---
*Документация поддерживается в актуальном состоянии в рамках 6-го спринта.*
