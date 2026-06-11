# System Architecture

ExoPaper is based on a microservice architecture, running in isolated containerized environments managed by **Docker Compose**. The system is designed for scalability, modularity, and complete independence from paid external AI services.

## Component Overview

The system consists of the following main components (containers):

1. **Frontend (React / Vite + Nginx):** `exopaper_ui`
2. **Backend API (.NET 9):** `exopaper_api`
3. **Database (RavenDB):** A three-node cluster `exopaper_db_a`, `exopaper_db_b`, `exopaper_db_c`
4. **LLM Engine (Ollama):** `exopaper_ollama` and initialization script `exopaper_ollama_init`
5. **Translation Engine (LibreTranslate):** `exopaper_translate`

---

## 1. Frontend (User Interface)
* **Technologies:** React 18, Vite, TypeScript, TailwindCSS, Zustand, React Three Fiber (Three.js).
* **Description:** A Single Page Application (SPA) served by an Nginx server. Nginx also acts as a **Reverse Proxy**—it intercepts user requests under the `/api/` and `/hubs/` (SignalR) prefixes, forwarding them to the `.NET` backend container. For the `/api/translate` path, it routes requests directly to the LibreTranslate server. This design bypasses CORS issues and unifies URLs.

## 2. Backend (API and Business Logic)
* **Technologies:** C# 13, .NET 9 (ASP.NET Core), MediatR, Quartz.NET, SignalR.
* **Description:** Serves as the heart of the system. The API is built upon the CQRS (Command Query Responsibility Segregation) pattern using the MediatR library. ASP.NET Controllers are extremely lightweight, merely accepting HTTP (and WebSocket) requests and delegating them to appropriate Handlers.
* **Background Tasks:** Utilizes the Quartz.NET library to cyclically run synchronization processes with NASA databases and download publications from arXiv.

## 3. Database (RavenDB)
* **Description:** RavenDB is a high-performance NoSQL document database with built-in support for clustering, ACID transactions, and advanced indexing. In this project, it runs as a three-node cluster for educational and high-availability demonstration purposes.
* **Vector Search:** Beyond storing JSON documents (planet information, arXiv documents), RavenDB also stores **embeddings** (vector arrays) for scientific abstracts, enabling lightning-fast Semantic Search.

## 4. Artificial Intelligence (Ollama)
* **Description:** A container exposing a REST API to local language models, based on the open-source Ollama project.
* During the environment startup, the `ollama-init` container executes `ollama pull` commands to download required models:
  - `llama3.2:3b` - The main generative model for summaries and chat.
  - `nomic-embed-text` - A fast, optimized model for creating vector representations of text (embeddings).
* *Hardware note:* The container has declared access to the GPU accelerator (NVIDIA) via `deploy: resources: reservations: devices`, which significantly speeds up response generation.

## 5. Translation Module (LibreTranslate)
* **Description:** An open-source Machine Translation API. It handles on-the-fly translation of texts (especially article abstracts and AI-generated opinions) into Polish within the closed Docker network environment.
* Environment variables enforce downloading only English-Polish models (`LT_LOAD_ONLY=en,pl`) to save RAM and minimize startup time.

---

## Information Processing Workflow

1. **Ingestion:** A Quartz Job (e.g., `NasaSyncJob`) queries the NASA Exoplanet Archive, downloads new parameters, and saves them to RavenDB. Another job (`TargetedHarvesterJob`) queries the arXiv API for papers related to these planet names.
2. **Vectorization:** When a new article hits the database, the backend sends its abstract to the Ollama container requesting the `nomic-embed-text` model. The resulting number array (vector) is saved within the RavenDB document.
3. **Generation (RAG):** When a user visits a planet's page, the backend retrieves physical parameters and searches the database for related publications. It compresses this data and sends it (as a system prompt) to the Llama model to compose a cohesive, educational summary.
4. **Visualization & Translation:** The browser displays the text received from the backend. If Polish is selected, the browser quietly requests the `/api/translate` endpoint (handled by LibreTranslate), and the text smoothly translates on-screen. Simultaneously, React Three Fiber components render physical parameters (e.g., star distance) as a beautiful 3D model.
