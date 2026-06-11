# Deployment and Execution (Docker)

This repository is distributed as a unified Docker Compose stack, defined in the `docker-compose.yml` file. All dependencies (databases, runtime environments) are fully contained within it and require no manual configuration on the host operating system's target environment (other than having Docker and, optionally, the Docker GPU Toolkit installed).

## Prerequisites
1. Docker Desktop version >= 4.0.
2. RAM for containers (Recommended at least **16GB+** due to running a local NoSQL cluster and multi-billion parameter AI models).
3. To fully utilize Ollama, the machine should have a dedicated NVIDIA graphics card, and the Docker environment must support acceleration (e.g., NVIDIA Container Toolkit on Linux, or proper WSL2/GPU integration on Windows).

## Resource Limit Configuration
On Windows platforms, Docker most commonly operates using **WSL 2** virtualization. To prevent the Out Of Memory (OOM) killer from terminating individual "heavy" containers during arXiv data downloads or Llama model generation, it's recommended to configure a global limit in WSL:

You must edit/create a file at the path `%USERPROFILE%\.wslconfig` and add the following entry:
```ini
[wsl2]
memory=24GB  # or depending on the machine's physical capabilities
```
After editing, execute `wsl --shutdown` from the console and restart Docker Desktop.

## Starting the Stack

The environment starts by entering a single command in the main project directory:

```bash
docker compose up -d --build
```
The `-d` flag detaches the terminal (Detach mode), so you can close the console after successfully launching the services. The `--build` flag forces the tool to build custom images for the Backend (.NET API) and Frontend (React Vite + Nginx).

## Behavior of Individual Containers from the YAML File:

1. **`ravendb-a, b, c`**
   Reserved ~1.5 GB limit for each. This is a fully replicated 3-node cluster. To view the GUI console and inspect documents and vectors, navigate to `http://localhost:8080` in your browser. (Login does not require a password).

2. **`ollama`** and **`ollama-init`**
   The main engine. The deployment subsection parameter instructs Docker to hand over NVIDIA drivers management (`driver: nvidia`, `capabilities: [gpu]`). Once deployed, a temporary container (`ollama-init`) runs briefly, executing automatic commands to pull the necessary weights for models from the cloud (nomic-embed-text, llama3.2:3b).

3. **`libretranslate`**
   To reduce the translator's warm-up time, an environment variable `LT_LOAD_ONLY=en,pl` is invoked, which narrows down the palette of downloaded weights from gigabytes of the entire service to just those required by the Polish interface.

4. **`exopaperrag.api`** and **`exopaper-ui`**
   Built from the API's `Dockerfile` and the React directory, respectively. The UI is exposed directly to the world and accessible externally on port **3000** of your host machine (`http://localhost:3000/`). This is the only address you need to know to use the entire system. The API is intentionally placed behind Nginx, so REST calls to `exopaperrag.api` travel through the local Docker bridge network, making the architecture more resilient.
