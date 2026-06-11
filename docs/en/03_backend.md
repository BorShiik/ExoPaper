# Backend Documentation (C# / .NET)

The ExoPaper backend is built in **.NET 9** as an ASP.NET Core Web API application. The architecture implements the popular **CQRS** (Command Query Responsibility Segregation) pattern alongside the **MediatR** library, ensuring a clear separation of read and write operations and providing excellent code testability.

## Layered Structure (Clean Architecture)

The backend code is divided into several key projects (layers):

1. **ExoPaperRAG.Domain** - Contains core entities and data models, e.g., `Exoplanet`, `Paper`, `ChatMessage` objects, as well as system constants. It has no external dependencies.
2. **ExoPaperRAG.Application** - Contains all the business logic of the system implemented as Commands and Queries for the MediatR library. This layer defines interfaces for external services (e.g., NASA client, arXiv, Ollama) and RavenDB index definitions.
3. **ExoPaperRAG.Infrastructure** - The layer implementing interfaces defined in Application. This includes concrete HTTP client implementations (e.g., REST API communication with Ollama, downloading data from NASA, arXiv) and job scheduling configuration (Quartz.NET).
4. **ExoPaperRAG.Api** - The Application Entry Point. It hosts the web server, defines REST controllers (`Controllers/`) and SignalR hubs (`Hubs/`). It registers all services in the Dependency Injection (DI) container and handles health checks (verifying the status of the database and Ollama).

## Key Background Agents (Jobs - Quartz.NET)

To allow the application to function as an autonomous system that fetches space news from the web, the **Quartz.NET** library is utilized. Two main background jobs have been defined:

### 1. NasaSyncJob
- **Task:** Synchronizes the planet database with the current state of the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/).
- **Mechanism:** Uses the TAP (Table Access Protocol). NASA servers expose a composite `pscomppars` table containing the "best" fit planetary parameters across different discoveries.
- The job compares the local database with fetched data and refreshes/adds missing objects to always display the latest data (e.g., newly discovered HWO - Habitable Worlds Observatory candidates).

### 2. TargetedHarvesterJob
- **Task:** Acquires scientific papers related to exoplanets that the system hasn't yet thoroughly analyzed from the **arXiv** repository.
- **Mechanism:** Sorts planets from RavenDB based on their last literature scan date. For a batch of planets, it builds a query to the `export.arxiv.org` API, searching for publications using the planet's name, star name, or keywords. It then parses the Atom (XML) format response and saves it to the database as `Paper` objects.

## External Storage and Semantic Search (RavenDB)

The choice of RavenDB is one of the most important technological decisions in this project.
- **ByVector Index:** Configured in C#, the `Papers_ByVector` index for the `Paper` entity instructs RavenDB on how to store Embedding Arrays contained within documents.
- When a user asks a question in the chat section, their text is converted into a vector by the Llama engine (via the `/api/embeddings` method of the `nomic-embed-text` model).
- The backend builds an RQL (Raven Query Language) query with the `VectorSearch()` command to pull the 5 most semantically coherent publications. Their content is passed to the main LLM, providing solid scientific evidence for generating the answer.

## Real-time Communication (SignalR)

The `ExoPaperRAG.Api` project contains the `ExoPaperHub` class. It uses this to push live updates to the client, primarily:
- Notifications about the progress of answer generation (Streaming responses from the LLM in real-time — token by token).
- A progress bar and log counts from the asynchronous jobs scanning arXiv/NASA.
