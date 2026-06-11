# Wdrażanie i Uruchamianie Systemu (Docker)

To repozytorium jest dystrybuowane jako zunifikowany stos Docker Compose, zdefiniowany w pliku `docker-compose.yml`. Wszystkie zależności (bazy danych, środowiska uruchomieniowe) są w pełni w nim zawarte i nie wymagają zewnętrznej ręcznej konfiguracji na środowisku docelowym systemu operacyjnego hosta (poza narzędziem Docker i, opcjonalnie, Docker GPU Toolkit).

## Wymagania Wstępne
1. Docker Desktop w wersji >= 4.0.
2. RAM dla kontenerów (Zalecane przynajmniej **16GB+** z uwagi na uruchamianie lokalnego klastra NoSQL i wielomiliardowych modeli AI).
3. Dla pełnego wykorzystania Ollamy, komputer powinien posiadać dedykowaną kartę graficzną NVIDIA, a środowisko w którym jest Docker musi obsługiwać akcelerację (np. NVIDIA Container Toolkit w Linuksie, bądź poprawną integrację WSL2/GPU dla Windows).

## Konfiguracja Limitów Zasobów
Na platformie Windows Docker najczęściej działa wykorzystując wirtualizację **WSL 2**. Aby zapobiec ubijaniu (ang. Out Of Memory, OOM killer) poszczególnych "ciężkich" kontenerów w trakcie pobierania danych z arXiv lub generowania modelu Llama, zaleca się konfigurację globalnego limitu w WSL:

Należy edytować/utworzyć plik w ścieżce `%USERPROFILE%\.wslconfig` dodając wpis:
```ini
[wsl2]
memory=24GB  # lub w zależności od możliwości fizycznych komputera
```
Po edycji wykonaj z konsoli `wsl --shutdown` i uruchom ponownie Docker Desktop.

## Uruchomienie całości

Środowisko startuje wpisując jedną, poniższą komendę w głównym katalogu projektu:

```bash
docker compose up -d --build
```
Flaga `-d` odłącza terminal (Dettach mode), dzięki czemu można zamknąć konsolę po poprawnym postawieniu usług. Flaga `--build` zmusza narzędzie do zbudowania własnych obrazów dla Backendu (API .NET) oraz Frontendu (React Vite + Nginx).

## Opis zachowania poszczególnych kontenerów z pliku YAML:

1. **`ravendb-a, b, c`**
   Zarezerwowano po ~1.5 GB limitu dla każdego. Jest to wpełni zreplikowany 3 węzłowy klaster. Do przeglądania konsoli GUI w celu podejrzenia dokumentów i wektorów należy wejść przeglądarką pod adres `http://localhost:8080`. (Logowanie nie ma hasła).

2. **`ollama`** i **`ollama-init`**
   Główny silnik. Parametr pod-sekcji konfiguracyjnej `deploy` wskazuje dockera by oddał w zarządzanie sterowniki NVIDIA (`driver: nvidia`, `capabilities: [gpu]`). Po postawieniu, na chwilę odpala się tymczasowy kontener (`ollama-init`), który wywołuje automatyczne komendy pobrania odpowiednich wag dla modeli z chmury (nomic-embed-text, llama3.2:3b).

3. **`libretranslate`**
   Aby ograniczyć czas rozgrzewania translatora wywołano zmienną środowiskową `LT_LOAD_ONLY=en,pl`, co zawęża paletę pobieranych wag z gigabajtów całego serwisu do zaledwie tych potrzebnych polskiemu interfejsowi.

4. **`exopaperrag.api`** i **`exopaper-ui`**
   Budowane odpowiednio z `Dockerfile` API i katalogu Reacta. UI jest wystawione bezpośrednio na świat i dostępne z zewnątrz na porcie **3000** Twojej maszyny hosta (`http://localhost:3000/`). To jedyny adres który musisz znać by korzystać z całego systemu. API celowo postawione jest za Nginx-em, dlatego wywołanie REST do `exopaperrag.api` przebiega przez lokalną sieć mostka Docker, uodparniając architekturę.
