# Architektura Systemu

ExoPaper opiera się na architekturze mikroserwisowej, uruchamianej w izolowanych środowiskach kontenerowych za pomocą narzędzia **Docker Compose**. System został zaprojektowany z myślą o skalowalności, modularności i pełnej niezależności od płatnych usług zewnętrznych w zakresie przetwarzania sztucznej inteligencji.

## Schemat Komponentów

System składa się z następujących głównych komponentów (kontenerów):

1. **Frontend (React / Vite + Nginx):** `exopaper_ui`
2. **Backend API (.NET 9):** `exopaper_api`
3. **Baza Danych (RavenDB):** Klaster z trzema węzłami `exopaper_db_a`, `exopaper_db_b`, `exopaper_db_c`
4. **Silnik LLM (Ollama):** `exopaper_ollama` i skrypt inicjalizujący `exopaper_ollama_init`
5. **Silnik Tłumaczeń (LibreTranslate):** `exopaper_translate`

---

## 1. Frontend (Interfejs Użytkownika)
* **Technologie:** React 18, Vite, TypeScript, TailwindCSS, Zustand, React Three Fiber (Three.js).
* **Opis:** Aplikacja SPA (Single Page Application) serwowana przez wydajny serwer Nginx. Nginx działa tu również jako **Reverse Proxy** (Odwrotne Proxy) – przechwytuje żądania użytkownika pod prefiksami `/api/` i `/hubs/` (SignalR), przekazując je odpowiednio do kontenera backendu `.NET`, a dla ścieżki `/api/translate` kieruje zapytania prosto do serwera LibreTranslate. Zapewnia to ominięcie problemów z CORS i ujednolicenie adresów URL.

## 2. Backend (API i Logika Biznesowa)
* **Technologie:** C# 13, .NET 9 (ASP.NET Core), MediatR, Quartz.NET, SignalR.
* **Opis:** Służy jako serce systemu. API jest zbudowane w oparciu o wzorzec CQRS (Command Query Responsibility Segregation) przy pomocy biblioteki MediatR. Kontrolery ASP.NET są niezwykle lekkie i służą jedynie do przyjmowania zapytań HTTP (i WebSocket z SignalR) i przekazywania ich do odpowiednich Handlerów.
* **Zadania w tle:** Używa biblioteki Quartz.NET do cyklicznego uruchamiania procesów synchronizacji z bazami NASA oraz pobierania publikacji z arXiv.

## 3. Baza Danych (RavenDB)
* **Opis:** RavenDB to wydajna dokumentowa baza danych NoSQL z wbudowaną obsługą klastrowania, transakcji ACID oraz zaawansowanych indeksów. W tym projekcie uruchomiono ją jako klaster trójwęzłowy w celach edukacyjno-demonstracyjnych (wysoka dostępność). 
* **Vector Search:** RavenDB jest używana nie tylko do przechowywania jsonów (informacji o planetach, dokumentów arXiv), ale także przechowuje **wektory osadzeń (embeddings)** dla abstraktów naukowych, co pozwala na błyskawiczne przeszukiwanie semantyczne (Semantic Search).

## 4. Sztuczna Inteligencja (Ollama)
* **Opis:** Kontener udostępniający REST API do lokalnych modeli językowych. Oparty na otwartoźródłowym projekcie Ollama.
* Podczas startu całego środowiska kontener `ollama-init` wykonuje komendy `ollama pull`, ściągając wymagane modele:
  - `llama3.2:3b` - Główny model generatywny do podsumowań i czatu.
  - `nomic-embed-text` - Szybki i zoptymalizowany model do tworzenia wektorowych reprezentacji tekstu (tzw. embeddings).
* *Uwaga sprzętowa:* Kontener ma zadeklarowany dostęp do akceleratora graficznego (GPU NVIDIA) za pomocą `deploy: resources: reservations: devices`, co kolosalnie przyspiesza generację odpowiedzi.

## 5. Moduł Tłumaczeń (LibreTranslate)
* **Opis:** Otwartoźródłowe API maszynowego tłumaczenia (Machine Translation). Obsługuje tłumaczenie tekstów (szczególnie abstraktów artykułów oraz opinii wygenerowanych przez AI) na język polski w locie, wewnątrz zamkniętego środowiska sieciowego Docker. 
* W zmiennych środowiskowych wymuszono pobieranie tylko modeli anglo-polskich (`LT_LOAD_ONLY=en,pl`), aby oszczędzić zasoby RAM i czas uruchamiania.

---

## Przebieg Przetwarzania Informacji (Workflow)

1. **Zbieranie danych (Ingestion):** Job Quartza (np. `NasaSyncJob`) uderza do NASA Exoplanet Archive, pobiera nowe parametry i zapisuje je w RavenDB. Inny job (`TargetedHarvesterJob`) pyta API arXiv o prace powiązane z nazwami tych planet.
2. **Wektoryzacja:** Gdy nowy artykuł trafi do bazy, backend wysyła jego treść (abstrakt) do kontenera Ollamy, prosząc o model `nomic-embed-text`. Otrzymaną tablicę liczb (wektor) zapisuje w dokumencie w RavenDB.
3. **Generacja (RAG):** Kiedy użytkownik wchodzi na stronę planety, backend pobiera parametry fizyczne planety oraz szuka w bazie publikacji powiązanych z nią. Kompresuje je i wysyła (jako system prompt) do modelu Llama (w kontenerze Ollama), by ten ułożył spójne, edukacyjne podsumowanie.
4. **Wizualizacja i Tłumaczenie:** Przeglądarka wyświetla otrzymany z backendu tekst. Jeśli wybrany jest język polski, przeglądarka pod spodem odpytuje adres `/api/translate` (obsługiwany przez LibreTranslate), a na ekranie tekst płynnie pojawia się po polsku. Z kolei komponenty React Three Fiber renderują parametry fizyczne (np. odległość planety od gwiazdy) w postaci ładnego modelu 3D.
