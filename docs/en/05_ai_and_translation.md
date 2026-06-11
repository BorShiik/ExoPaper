# AI and Translation Logic

Unlike typical modern projects where "AI" simply means passing an API key to OpenAI, **ExoPaper was designed from the ground up to rely 100% on locally hosted, open-source Artificial Intelligence models**. This guarantees complete privacy and free usage of a full range of technologies, depending only on the host machine's graphics card capabilities.

## LLM Runtime Environment (Ollama)

The inference engine is **Ollama**, running inside the Docker network. The backend (.NET) communicates with it via HTTP requests to the dedicated address `http://ollama:11434`. Access to the NVIDIA graphics processor (CUDA acceleration) enables lightning-fast processing of massive queries (the "Context Window").

Two models are utilized:
1. **Llama 3.2 (3 Billion parameters - 3B):** A highly efficient and VRAM-friendly model from Meta. Chosen for its excellent size-to-intelligence ratio when processing long scientific articles.
2. **Nomic Embed Text:** A small, specialized model whose sole task is to convert text into number matrices/vectors. Essential for the Semantic Search functionality.

### 1. Prompt Engineering and Hallucinations

The Llama 3.2:3b model is responsible for generating beautiful and concise planet descriptions for the "AI Analysis" section. Sometimes, smaller LLMs struggle with over-embellishment (making things up). To minimize "hallucinations," a **strict "System Prompt"** was imposed within the source code (`GetPlanetAiSummaryQueryHandler.cs`):
- The model is forbidden from inventing metrics that were not provided as variables from the NASA API.
- The habitability assessment module has an ironclad rule to follow strict mathematical verification: if the "Equilibrium Temperature" parameter from the NASA database exceeds 320 Kelvin, or the "Orbital Period" is extremely short (e.g., under 10 days – placing the planet right next to the solar furnace), Llama **must categorically deny** the presence of liquid water and habitability, preventing the spread of misinformation.
- Output Format: The model is instructed to output a specific JSON structure so the backend can easily parse it for the UI without breaking the layout.

### 2. Retrieval-Augmented Generation (RAG)

When a question is asked via the chatbot assistant built into the UI, the RAG mechanism is deployed:
1. Your question (e.g., *"Are there sulfur clouds on this planet?"*) is first converted into a sequence of numbers by `nomic-embed-text`.
2. Using this "number line," RavenDB analyzes the indexed database of arXiv abstracts relating to the chosen planet and finds those scientific texts whose multi-dimensional space is closest to the question's numerical space.
3. These articles (discovered facts) serve as a "supplement" that is injected on-the-fly into the system memory of the Llama 3.2 model. Only with this compiled manual does Llama write its final, generated answer, giving credibility to the AI's statements in the application.

---

## Translation Module (LibreTranslate)

Because the application is available in Polish, but the world of astronomy "speaks" 99% English, **LibreTranslate** is used as the translator.

### Why Client-Side Translation Instead of Database?
Translations in ExoPaper are primarily executed by components in the UI (Frontend), rather than on the fly by the backend when saving to the database:
- **Independence:** In the future, the application can be switched to another language (e.g., Spanish or German) without code changes, while the database (RavenDB) constantly stores neutral, unified English sources (The Ground Truth).
- **UI Flexibility:** Translations can be triggered asynchronously when a given text scrolls into view, preventing the generation process from being blocked.

Nginx with `exopaper_ui` serves as a local courier — it intercepts the `/api/translate` call from the browser's path and directs it to the `libretranslate:5000` Docker container enclosed in the network. The result flows into the state of the `useTranslate` Hook, which caches this return in the session's temporary memory (RAM) to save resources.
