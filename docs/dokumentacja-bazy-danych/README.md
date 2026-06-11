# Dokumentacja bazy danych — ExoPaper

Szczegółowy opis warstwy danych aplikacji **ExoPaper** opartej na **RavenDB**. Dokumentacja
obejmuje wszystkie encje (kolekcje), indeksy, zapytania, polecenia (commands), metody i funkcje
związane z bazą danych, a także mapuje je na wymagania projektowe.

## Spis treści

| Plik | Zawartość |
|------|-----------|
| [`01-encje-i-kolekcje.md`](01-encje-i-kolekcje.md) | Wszystkie encje domenowe i kolekcje RavenDB, pola, konwencje identyfikatorów |
| [`02-indeksy.md`](02-indeksy.md) | Indeksy auto, statyczne (z polami wyliczanymi), map-reduce, full-text, vector |
| [`03-zapytania-i-crud.md`](03-zapytania-i-crud.md) | Polecenia CRUD, zapytania, handlery MediatR, paging, sortowanie, Include/LoadDocument, PatchByQuery |
| [`04-wymagania-projektowe.md`](04-wymagania-projektowe.md) | **Mapa 12 wymagań projektowych na konkretny kod** |
| [`05-diagramy-i-rql.md`](05-diagramy-i-rql.md) | Schemat ER kolekcji (Mermaid), przepływ RAG, przykłady zapytań RQL dla RavenDB Studio |

## Architektura warstwy danych

Aplikacja stosuje **Czystą Architekturę (Clean Architecture)** z wzorcem **CQRS** (MediatR):

```
Api (kontrolery, thin)
  └─ Application (zapytania/polecenia MediatR, definicje indeksów, kontrakty)
       └─ Infrastructure (IDocumentStore, klienci zewnętrzni, workery, joby)
            └─ Domain (encje, reguły — bez zależności)
```

Cała komunikacja z RavenDB odbywa się przez interfejs `IDocumentStore` (RavenDB.Client 7.2),
zarejestrowany jako singleton w `ExoPaperRAG.Api/Program.cs`:

```csharp
builder.Services.AddSingleton<IDocumentStore>(sp =>
{
    var settings = sp.GetRequiredService<IOptions<RavenSettings>>().Value;
    var store = new DocumentStore
    {
        Urls = settings.Urls,             // 3 węzły klastra: ravendb-a/-b/-c
        Database = settings.DatabaseName  // "ExoPaper"
    };
    store.Conventions.DisableTopologyUpdates = true;
    store.Conventions.MaxNumberOfRequestsPerSession = 100;
    return store.Initialize();
});
```

Każde zapytanie/polecenie otwiera sesję `using var session = _store.OpenAsyncSession();`
i działa w jednostce pracy (Unit of Work) RavenDB.

## Kolekcje (skrót)

| Encja (C#) | Kolekcja RavenDB | Przykładowy identyfikator |
|------------|------------------|---------------------------|
| `Exoplanet` | `Exoplanets` | `exoplanets/Kepler-22-b` |
| `Paper` | `Papers` | `papers/2301.12345` |
| `PaperChunk` | `PaperChunks` | `PaperChunks/2301.12345/0` |
| `Author` | `Authors` | `authors/jane-doe` |
| `SyncTracker` | `SyncTrackers` | `SyncTrackers/Nasa` |
| `OutboxEvent` | `OutboxEvents` | `OutboxEvents/0000000000000000123-A` |

## Inicjalizacja bazy i indeksów

Hostowana usługa `RavenInitializer` (`ExoPaperRAG.Infrastructure/Persistence/RavenInitializer.cs`):
1. wyprowadza węzły klastra ze stanu *passive* (`/admin/cluster/bootstrap` + dołączanie węzłów),
2. tworzy bazę `ExoPaper` z odpowiednim współczynnikiem replikacji,
3. wdraża **wszystkie** indeksy: `IndexCreation.CreateIndexesAsync(typeof(Exoplanets_ByHabitability).Assembly, _store, ...)`.
