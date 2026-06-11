# 3. Zapytania, polecenia CRUD, metody i funkcje

Warstwa danych jest zorganizowana wg **CQRS (MediatR)**: każda operacja to `record` zapytania
(`IRequest<...>`) i `Handler` wstrzykujący `IDocumentStore`. Kontrolery w `ExoPaperRAG.Api/Controllers/`
jedynie wysyłają żądania przez `IMediator`.

---

## 3.1. CRUD — Exoplanets

Plik: `ExoPaperRAG.Application/Features/Exoplanets/Commands/ExoplanetCommands.cs`

### Create — `StoreAsync` + `SaveChangesAsync`
```csharp
var planet = Exoplanet.Create(request.Name, request.DiscoveryMethod, request.MassEarth, ...);
using var session = _store.OpenAsyncSession();
await session.StoreAsync(planet, planet.Id, ct);
await session.SaveChangesAsync(ct);
```

### Read (po Id) — `LoadAsync`
```csharp
// ExoplanetQueries.cs — GetExoplanetByIdQueryHandler
var docId = RavenIds.EnsurePrefix(request.Id, "exoplanets/");
var planet = await session.LoadAsync<Exoplanet>(docId, ct);
```

### Update — `LoadAsync` + mutacja + `SaveChangesAsync`
```csharp
// UpdateExoplanetCommandHandler
var planet = await session.LoadAsync<Exoplanet>(docId, ct);
planet.UpdateDescriptive(body.Name, body.DiscoveryMethod, body.MassEarth);
await session.SaveChangesAsync(ct);   // change-tracking RavenDB zapisze różnicę
```

### Delete — `session.Delete`
```csharp
// DeleteExoplanetCommandHandler
session.Delete(docId);
await session.SaveChangesAsync(ct);
```

Te same operacje CRUD dla `Paper` znajdują się w
`ExoPaperRAG.Application/Features/Papers/Commands/PaperCommands.cs`.

Endpointy REST (`ExoplanetsController`):
`POST /api/exoplanets`, `GET /api/exoplanets/by-id`, `PUT /api/exoplanets/{id}`,
`DELETE /api/exoplanets/{id}`.

---

## 3.2. Paging — `Skip` / `Take`

```csharp
// ExoplanetQueries.cs — GetExoplanetsQueryHandler
var results = await query
    .Skip(request.Skip)
    .Take(Math.Clamp(request.Take, 1, 100))   // ograniczenie rozmiaru strony
    .ToListAsync(ct);
```

Paging stosowany jest też w `GetHabitableExoplanetsQueryHandler`, `SearchPapersQueryHandler`,
`GetPapersByExoplanetQueryHandler` oraz w retrievalu RAG (`AskExoplanetQueryHandler` — `Take(take)`).

---

## 3.3. Sortowanie — `OrderBy` / `OrderByDescending`

```csharp
// ExoplanetQueries.cs — sortowanie po polu wybranym przez klienta
if (request.SortBy == "orbitalPeriod")
    query = query.OrderBy(p => p.OrbitalPeriodDays);

// PaperQueries.cs — najnowsze publikacje najpierw
await session.Query<Paper, Papers_ByAbstractSearch>()
    .Search(x => x.Abstract, term)
    .OrderByDescending(x => x.PublishedDate)
    .ToListAsync(ct);
```

---

## 3.4. Full-Text Search — `.Search(...)`

Wykorzystuje indeks `Papers_ByAbstractSearch` (pole `Abstract` w trybie `Search`).

```csharp
// PaperQueries.cs — SearchPapersQueryHandler
var queryable = session.Query<Paper, Papers_ByAbstractSearch>();
if (!string.IsNullOrWhiteSpace(request.Query))
    queryable = queryable.Search(x => x.Abstract, request.Query);   // pełnotekstowo

var results = await queryable
    .OrderByDescending(x => x.PublishedDate)
    .Skip(request.Skip).Take(...)
    .ToListAsync(ct);
```

Full-text jest też używany jako *fallback* w `GetPapersByExoplanetQueryHandler` i w generowaniu
profilu AI (`GetPlanetAiSummaryQueryHandler`), gdy planeta nie ma jeszcze powiązanych publikacji.

---

## 3.5. Dokumenty powiązane — `Include()` i `LoadDocument()`

### `Include()` — eliminacja N+1 (Paper → Authors)
Plik: `PaperQueries.cs — GetPaperWithAuthorsQueryHandler`

```csharp
var paper = await session.LoadAsync<Paper>(
    docId,
    includes => includes.IncludeDocuments(x => x.AuthorIds),  // dołącz autorów
    ct);

// Autorzy są już w sesji — brak dodatkowych round-tripów:
var loaded = await session.LoadAsync<Author>(paper.AuthorIds, ct);
```

### `LoadDocument()` — w indeksie wektorowym
Plik: `Papers_ByVector.cs` — indeks ładuje `Paper` powiązany z `PaperChunk`, aby pobrać
`ExoplanetIds` (patrz `02-indeksy.md`, sekcja 2.5). Dzięki temu filtr po planecie jest poprawny
nawet, gdy publikacja zostanie powiązana **po** zembeddowaniu (Raven re-indeksuje chunk przy
zmianie `Paper`).

---

## 3.6. Vector Search — `.VectorSearch(...)`

Wykorzystuje indeks `Papers_ByVector`. Retrieval RAG ogranicza wyszukiwanie do publikacji
powiązanych z daną planetą i projektuje wyniki **bez ładowania dużych dokumentów**.

```csharp
// AskExoplanet.cs — VectorSearchAsync
var queryable = session.Query<Papers_ByVector.Result, Papers_ByVector>();

if (!string.IsNullOrWhiteSpace(planetDocId))
    queryable = queryable.Where(x => x.ExoplanetIds.Contains(planetDocId));  // scope po planecie

return await queryable
    .VectorSearch(
        f => f.WithField(x => x.Vector),
        f => f.ByEmbedding(queryVector))         // wektor zapytania (embedding pytania)
    .Take(take)
    .ProjectInto<Papers_ByVector.Result>()       // projekcja z pól Store
    .ToListAsync(ct);
```

Vector Search jest też używany w `SearchHybridQueryHandler` (hybryda wektor + filtry) oraz
`FindSimilarPapersQueryHandler`.

---

## 3.7. PatchByQuery — masowa modyfikacja dokumentów

Plik: `PaperCommands.cs — MarkAllPapersReviewedCommandHandler`

Operacja serwerowa modyfikująca wszystkie dokumenty kolekcji bez ładowania ich do sesji:

```csharp
var operation = await _store.Operations.SendAsync(
    new PatchByQueryOperation(new IndexQuery
    {
        Query = "from Papers update { this.IsReviewed = true; }"   // RQL + skrypt JS
    }), token: ct);

await operation.WaitForCompletionAsync(TimeSpan.FromSeconds(30));
```

Endpoint: `POST /api/papers/mark-all-reviewed` (`PapersController`).
