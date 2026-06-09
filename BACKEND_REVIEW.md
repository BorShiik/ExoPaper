# ExoPaper RAG — Обзор бэкенда

Дата: 2026-06-09. Область: `ExoPaperRAG.Api`, `.Application`, `.Domain`, `.Infrastructure` (+ инфраструктура: docker-compose, конфиги).

## Общая оценка

Проект в хорошем состоянии для исследовательского/учебного: применена «чистая архитектура» (Domain → Application → Infrastructure → Api), есть CQRS через MediatR, фоновые задания на Quartz, паттерн Outbox для real-time через SignalR, устойчивость HTTP через Polly, отдельные слои клиентов (NASA/arXiv/Ollama) и индексы RavenDB (search, map-reduce, vector). Структура читаемая, именование осмысленное.

Главные слабые места: бэкенд **не полностью следует собственным заявленным паттернам** (контроллеры ходят в БД напрямую в обход Application; «воркеры на Data Subscriptions» на деле сделаны опросом-поллингом), есть **несколько реальных багов корректности** (перезапись обогащённых данных при синке, утечка вектора в ответах API, отсутствие создания БД), и **нет фундамента для эксплуатации**: ни тестов, ни health-checks, ни глобальной обработки ошибок, ни структурного логирования, осталось много мусора от шаблонов.

Ниже — по приоритетам.

---

## 1. Критические проблемы корректности

**1.1. Ежедневный NASA-синк затирает обогащённые данные планет.**
`NasaSyncJob.UpsertPlanetsAsync` для каждого DTO вызывает `Exoplanet.Create(...)` — это создаёт **новый** объект с `HasEmbeddings = false`, `Tags = new()`, `TagsProcessed = false`, и `StoreAsync(planet, planet.Id)` **полностью перезаписывает** существующий документ. Поскольку `IncrementalSyncAsync` просто вызывает полный синк, каждый прогон (ежедневно в 02:00) обнуляет теги и флаг `TagsProcessed` у всех ~6000 планет, заставляя `TaggingWorker` переобрабатывать весь каталог и заново слать события. Любое обогащение (теги, связи) теряется.
*Решение:* загрузить существующий документ и обновлять только скалярные поля из NASA (через `session.LoadAsync` + копирование полей, или `PatchByQueryOperation`/patch по id), сохраняя `Tags/HasEmbeddings/TagsProcessed`. Лучше — разделить «сырые научные поля» и «производные/обогащённые поля».

**1.2. Поле `Vector` (эмбеддинг) утекает во все ответы API.**
`Paper.Vector` (`float[]`, ~768 чисел) сериализуется в JSON. Эндпоинты `GET /api/papers/search`, `GET /api/papers/exoplanet/{id}`, `with-authors` возвращают полные сущности `Paper` вместе с вектором. Это раздувает трафик и выставляет наружу эмбеддинги. (Фронтенд-тип `Paper` даже содержит `vector?: number[]`.)
*Решение:* возвращать DTO без вектора (или `[JsonIgnore]` на `Vector`), а лучше — серверная проекция `.Select(...)` в RavenDB, чтобы вектор вообще не выгружался.

**1.3. База данных не создаётся автоматически.**
`Program.cs` делает `store.Initialize()` и `IndexCreation.CreateIndexes(...)`, но не создаёт базу `ExoPaper`. На чистом RavenDB (как в `docker-compose`) создание индексов упадёт — БД нужно создавать руками в Studio.
*Решение:* при старте `store.Maintenance.Server.Send(new CreateDatabaseOperation(...))` с обработкой `DatabaseAlreadyExists`.

**1.4. «Воркеры на Data Subscriptions» — на самом деле поллинг.**
`EmbeddingWorker`, `OutboxDispatcher`, `TaggingWorker` в комментариях заявлены как RavenDB Data Subscriptions, но реализованы как цикл `Query().Where(...).Take(100)` + `Task.Delay`. Последствия: (а) при горизонтальном масштабировании API **каждый инстанс** будет поллить и дублировать обработку (двойные вызовы Ollama, двойные события); (б) из-за eventual consistency индексов один и тот же батч может попасть в выборку повторно до обновления индекса.
*Решение:* перейти на настоящие Data Subscriptions (один потребитель на кластер, ack после успешной обработки) — это ровно то, что обещают комментарии. Либо распределённая блокировка/лидер-элекшн.

**1.5. Outbox растёт без ограничений.**
`OutboxDispatcher` ставит `Dispatched = true`, но обработанные `OutboxEvent` никогда не удаляются. Коллекция будет расти бесконечно.
*Решение:* задание очистки (TTL/ретенция) или удаление после диспетча; индекс по `Dropped/CreatedAt`.

**1.6. Связь paper → exoplanet не реализована.**
`Paper.ExoplanetIds` всегда `new List<string>()` (см. комментарий «will be populated by future NLP pipeline»). Значит гибридный поиск с фильтром по планете и «Linked Papers» фактически почти всегда пустые — ключевая для RAG связка графа не работает.
*Решение:* реализовать связывание (NER/линкинг названий планет в абстрактах, либо сопоставление по `pl_name`).

**1.7. Мелкое:** `PapersController.GetWithAuthors` может добавить `null` в список авторов, если документ автора отсутствует (нет фильтрации null). `Exoplanets_StatsByDiscoveryMethod.AverageMass` считает массу как `MassEarth ?? 0`, занижая среднее из-за планет без массы.

---

## 2. Чистота кода и архитектура

**2.1. Удалить мёртвый код и дубли.** В решении два веб-приложения: рабочее `ExoPaperRAG.Api` и **остатки MVC-шаблона `ExoPaperRAG`** (свой `Program.cs`, `HomeController`, Views) — не используется. Плюс шаблонные `WeatherForecast.cs` и `WeatherForecastController.cs` в Api. Это сбивает с толку и увеличивает поверхность. Удалить проект `ExoPaperRAG` и Weather*-файлы.

**2.2. Контроллеры в обход Application-слоя.** `ExoplanetsController`, `PapersController`, `AuthorsController` напрямую открывают `IDocumentStore` сессии и пишут LINQ/CRUD. Лишь 2 запроса идут через MediatR. Это размывает «чистую архитектуру»: API завязан на RavenDB, бизнес-логика и доступ к данным в контроллерах.
*Решение:* вынести весь доступ к данным в Application (Commands/Queries через MediatR). Контроллеры — тонкие: принять запрос, `_mediator.Send`, вернуть результат.

**2.3. Нет DTO/контрактов ответа.** Возвращаются доменные сущности (включая `Vector`, внутренние флаги `HasEmbeddings`, `TagsProcessed`). Нужны Response-модели и маппинг (ручные проекции или Mapster).

**2.4. Nullable-предупреждения в Domain.** `Exoplanet.Id/Name`, `Paper.Id/Title/Abstract/Vector`, `Author.*` объявлены non-nullable без инициализации — при `Nullable=enable` это CS8618. Использовать `required` (C# 11) или `= string.Empty`.

**2.5. `Console.WriteLine` вместо логгера** в `Program.cs` (инициализация Raven, Polly-колбэки). Не попадает в структурные логи. Заменить на `ILogger`/Serilog.

**2.6. Разнобой в комментариях/языке.** В `Papers_ByVector` и `Dockerfile` — комментарии на русском, в остальном коде на английском. Привести к одному языку.

**2.7. `AdqlQueryBuilder`:** лишний `using Microsoft.AspNetCore.JsonPatch.Helpers;`, потенциальный NRE в `value.ToString()`, форматирование числа через `Replace(',', '.')` вместо `IFormattable.ToString(CultureInfo.InvariantCulture)`. Поля `_fromTable/_orderBy` — nullable-варнинги.

**2.8. Опечатка в публичном API:** метод `INasaClient.FetchPlanetAcync` (Acync → Async).

---

## 3. Масштабируемость

- **Воркеры дублируются при масштабировании** (см. 1.4) — основной блокер для нескольких реплик API. Data Subscriptions или вынос воркеров в отдельный hosted-процесс/сервис.
- **Инициализация Raven в фабрике DI** делает блокирующий `Thread.Sleep` и ретраи прямо в `AddSingleton`. Лучше — `IHostedService` для инициализации (создание БД + индексов) + health-check готовности.
- **Тяжёлые ответы** из-за неспроецированных сущностей и вектора (см. 1.2). Серверные проекции уменьшат сетевую нагрузку.
- **Ollama**: один `HttpClient` с таймаутом 5 мин и Polly-ретраями — ретрай на долгой генерации может умножать время до ~15 мин. Развести политики для embeddings (быстро) и generate (долго), ограничить параллелизм.
- **Пагинация без метаданных**: `skip/take` без общего количества — фронтенд не знает, сколько всего. Возвращать `TotalCount`/`hasMore` (RavenDB `Statistics(out var stats)`).
- **Кэширование** для `stats`/`discovery methods` (меняются редко) — OutputCache или Redis.

---

## 4. Паттерны и best practices (чего не хватает)

- **Глобальная обработка ошибок + ProblemDetails** (`AddProblemDetails`, `UseExceptionHandler`). Сейчас исключения уходят как 500 без контракта.
- **Валидация** входных моделей: FluentValidation + MediatR pipeline behavior (`ValidationBehavior`). Заодно behaviors для логирования и метрик времени.
- **Health checks**: `AddHealthChecks` для RavenDB и Ollama, эндпоинты `/health/live` и `/health/ready`; в `docker-compose` `depends_on` не ждёт готовности — health-check критичен.
- **Структурное логирование** (Serilog) + корреляция запросов.
- **Опции с валидацией**: `builder.Services.AddOptions<NasaApiSettings>().Bind(...).ValidateDataAnnotations().ValidateOnStart()` для всех Settings.
- **CORS по окружению**: сейчас политика `DevCors` применяется всегда (в т.ч. в проде) и хардкодит localhost. Вынести origins в конфиг.
- **Тесты**: их нет совсем. Юнит-тесты на `HwoCandidateRule`, `AdqlQueryBuilder`, `NasaFloatConverter`, обработчики MediatR; интеграционные на RavenDB через `Raven.TestDriver`/Testcontainers; контрактные на парсинг arXiv XML.
- **CI**: каталог `.github` пуст. Добавить workflow (build + test + docker build).
- **Безопасность (для прод)**: RavenDB поднят `UnsecuredAccessAllowed=PublicNetwork`, API без аутентификации, без HTTPS в контейнере. Для публичного развёртывания: сертификаты RavenDB, аутентификация API (JWT/API-key), секреты через user-secrets/Key Vault, rate limiting (`AddRateLimiter`).
- **Кластер RavenDB**: в `docker-compose` три ноды, но они не объединены в кластер (нет шага формирования cluster), а `DisableTopologyUpdates = true` и три URL вручную. Либо настроить реальный кластер, либо упростить до одной ноды для дева.

---

## 5. Что добавить в проект (фичи)

- **Полноценный RAG-эндпоинт `/ask`**: retrieval top-k статей + параметры планеты → ответ LLM **с цитатами**, со стримингом токенов в SignalR (`Stream = true` в Ollama). Сейчас есть только «uncertainty summary» и сырой поиск.
- **Линкинг paper↔exoplanet** (см. 1.6) — оживит весь граф знаний и фильтры.
- **Эндпоинт статуса синхронизаций**: `SyncTracker` уже пишется, но наружу не отдаётся — сделать `/api/sync/status` (последний синк, кол-во, ошибки) и показать на дашборде.
- **Стриминг событий по группам планет**: `SendToPlanetGroupAsync` реализован, но не используется — слать события эмбеддинга/тегирования в группу конкретной планеты на её странице.
- **Экспорт данных** (CSV/JSON) и публичный read-only API c пагинацией/фильтрами.
- **Метрики/наблюдаемость**: OpenTelemetry (трейсы HTTP/Raven/Ollama) + метрики воркеров (глубина очереди эмбеддингов, throughput).
- **Дашборд фоновых задач** (Quartz) для ручного запуска/мониторинга джобов.
- **Управление моделями/настройками RAG** (top-k, порог сходства) через конфиг.

---

## 6. Приоритетный план

| Приоритет | Что | Зачем |
|---|---|---|
| P0 | Не затирать `Tags/HasEmbeddings` при NASA-синке (1.1); создавать БД при старте (1.3); убрать `Vector` из ответов (1.2) | Корректность данных и API |
| P0 | Удалить мёртвый код: проект `ExoPaperRAG`, Weather* (2.1) | Чистота |
| P1 | Воркеры → Data Subscriptions + очистка Outbox (1.4, 1.5) | Масштабируемость, корректность real-time |
| P1 | Health checks, ProblemDetails, Serilog, валидация опций | Эксплуатация |
| P1 | Перенести CRUD в Application (MediatR), ввести Response-DTO (2.2, 2.3) | Архитектура |
| P2 | Линкинг paper↔exoplanet (1.6); `/ask` со стримингом; `/sync/status` | Ключевые фичи RAG |
| P2 | Тесты + CI; rate limiting/аутентификация; пагинация с TotalCount | Качество/прод |

---

Замечание: это ревью по чтению кода. Прогнать `dotnet build`/`dotnet test` в этой среде нельзя (нет .NET SDK), поэтому утверждения про предупреждения компилятора и поведение во время выполнения отмечены как «проверить локально».
