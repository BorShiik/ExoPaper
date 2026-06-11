# Dokumentacja Backendu (C# / .NET)

Backend ExoPaper został zbudowany w środowisku **.NET 9** jako aplikacja ASP.NET Core Web API. W architekturze zastosowano popularny wzorzec **CQRS** (Command Query Responsibility Segregation) wraz z biblioteką **MediatR**, co zapewnia wyraźne rozdzielenie operacji odczytu od zapisu i doskonałą testowalność kodu.

## Struktura Warstwowa (Clean Architecture)

Kod backendu podzielono na kilka kluczowych projektów (warstw):

1. **ExoPaperRAG.Domain** - Zawiera rdzenne encje i modele danych, np. obiekty `Exoplanet`, `Paper`, `ChatMessage`, a także stałe systemowe. Nie ma żadnych zależności zewnętrznych.
2. **ExoPaperRAG.Application** - Zawiera całą logikę biznesową systemu zaimplementowaną pod postacią komend (Commands) i zapytań (Queries) biblioteki MediatR. Tutaj definiowane są interfejsy dla usług zewnętrznych (np. klienta NASA, arXiv, Ollamy) oraz definicje indeksów bazy RavenDB. 
3. **ExoPaperRAG.Infrastructure** - Warstwa implementująca interfejsy zdefiniowane w Application. Tu znajdują się konkretne implementacje klientów HTTP (np. łączność z REST API Ollamy, pobieranie danych z NASA, arXiv) oraz konfiguracja harmonogramowania zadań (Quartz.NET).
4. **ExoPaperRAG.Api** - Punkt wejścia (Entry Point) aplikacji. Hostuje serwer WWW, definiuje kontrolery REST (`Controllers/`) oraz huby SignalR (`Hubs/`). W nim też rejestrowane są wszystkie serwisy w kontenerze Dependency Injection (DI) oraz health checki (sprawdzanie stanu bazy danych i Ollamy).

## Klawiowi Agenci w Tle (Jobs - Quartz.NET)

Aby aplikacja mogła być autonomicznym systemem pobierającym nowości kosmiczne z sieci, użyto biblioteki **Quartz.NET**.
Zdefiniowano dwa główne zadania działające w tle:

### 1. NasaSyncJob
- **Zadanie:** Harmonizuje bazę planet z aktualnym stanem katalogu [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/).
- **Mechanizm działania:** Wykorzystuje protokół TAP (Table Access Protocol). Serwer NASA udostępnia tabelę kompozytową `pscomppars` zawierającą "najlepsze" dopasowane parametry planetarne dla poszczególnych odkryć. 
- Job porównuje bazę lokalną z danymi pobranymi i odświeża/dodaje brakujące obiekty, aby zawsze wyświetlać najświeższe dane (np. nowoodkryte planety HWO - Habitable Worlds Observatory candidates).

### 2. TargetedHarvesterJob
- **Zadanie:** Pozyskuje z serwisu **arXiv** artykuły naukowe dotyczące egzoplanet, których system jeszcze nie zdążył szczegółowo przeanalizować.
- **Mechanizm działania:** Sortuje planety z RavenDB pod kątem daty ostatniego przeszukania literatury. Dla partii planet buduje zapytanie do API `export.arxiv.org`, wyszukując publikacje na podstawie nazwy planety, nazwy gwiazdy czy słów kluczowych (np. "James Webb"). Następnie parsuje format Atom (XML) z odpowiedziami i zapisuje w bazie jako obiekty `Paper`.

## Pamięć Zewnętrzna i Wyszukiwanie Semantyczne (RavenDB)

Zastosowanie RavenDB to jedna z najważniejszych decyzji technologicznych.
- **Indeks ByVector:** Skonfigurowany w C# indeks (`Papers_ByVector`) dla encji `Paper` instruuje RavenDB, w jaki sposób ma przechowywać zawarte w dokumencie wektory osadzeń (Embedding Arrays).
- Gdy użytkownik zadaje pytanie w sekcji czatu, jego tekst zamieniany jest na wektor przez silnik Llama (za pomocą metody `/api/embeddings` modelu `nomic-embed-text`). 
- Backend buduje zapytanie RQL (Raven Query Language) z komendą `VectorSearch()`, aby wyciągnąć 5 najbardziej spójnych semantycznie publikacji i przekazać ich treść głównemu modelowi LLM, dostarczając mu solidnego dowodu naukowego na wygenerowanie odpowiedzi.

## Komunikacja Real-time (SignalR)

Projekt `ExoPaperRAG.Api` posiada klasę `ExoPaperHub`. Korzysta z niej by pchać do klienta aktualizacje na żywo, głównie:
- Powiadomienia o postępie generacji odpowiedzi (Streaming odpowiedzi z LLM w czasie rzeczywistym — token po tokenie).
- Pasek postępu (progress bar) i zliczenia logów z asynchronicznego joba skanującego arXiv/NASA.
