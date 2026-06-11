# 4. Wymagania projektowe — mapa na kod

Poniżej każde z 12 wymagań projektowych z dokładnym wskazaniem pliku, fragmentu kodu oraz
wyjaśnieniem działania.

---

## 1. Aplikacja realizująca CRUD

**Gdzie:** `ExoPaperRAG.Application/Features/Exoplanets/Commands/ExoplanetCommands.cs`,
`Features/Papers/Commands/PaperCommands.cs`, kontrolery w `ExoPaperRAG.Api/Controllers/`.

Pełny zestaw operacji Create / Read / Update / Delete realizowany przez sesję RavenDB:

| Operacja | Metoda RavenDB | Endpoint |
|----------|----------------|----------|
| Create | `session.StoreAsync(entity, id)` + `SaveChangesAsync()` | `POST /api/exoplanets` |
| Read | `session.LoadAsync<T>(id)` / `session.Query<T>()` | `GET /api/exoplanets/by-id` |
| Update | `LoadAsync` → mutacja → `SaveChangesAsync` (change tracking) | `PUT /api/exoplanets/{id}` |
| Delete | `session.Delete(id)` + `SaveChangesAsync()` | `DELETE /api/exoplanets/{id}` |

```csharp
// CREATE
await session.StoreAsync(planet, planet.Id, ct);
await session.SaveChangesAsync(ct);

// READ
var planet = await session.LoadAsync<Exoplanet>(docId, ct);

// UPDATE — Unit of Work zapisuje tylko różnicę
planet.UpdateDescriptive(body.Name, body.DiscoveryMethod, body.MassEarth);
await session.SaveChangesAsync(ct);

// DELETE
session.Delete(docId);
await session.SaveChangesAsync(ct);
```

**Jak działa:** RavenDB stosuje wzorzec *Unit of Work* — sesja śledzi zmiany załadowanych
encji i przy `SaveChangesAsync()` wysyła do serwera tylko realne różnice w jednej transakcji.

---

## 2. Minimum 3 kolekcje

**Gdzie:** `ExoPaperRAG.Domain/Entities/`.

Aplikacja ma **6 kolekcji** (nazwa kolekcji = nazwa typu w l. mnogiej):

`Exoplanets`, `Papers`, `PaperChunks`, `Authors`, `SyncTrackers`, `OutboxEvents`.

Szczegóły pól — patrz [`01-encje-i-kolekcje.md`](01-encje-i-kolekcje.md).

**Jak działa:** przy `StoreAsync(new Paper{...})` RavenDB nadaje dokumentowi metadane
`@collection: "Papers"` na podstawie typu CLR, grupując dokumenty w kolekcję.

---

## 3. Zapytania dynamiczne obsługiwane przez auto-indeksy

**Gdzie:** `ExoplanetQueries.cs` (`GetExoplanetsQueryHandler`), `PaperQueries.cs`.

Zapytanie `session.Query<T>()` bez wskazania indeksu statycznego jest obsługiwane przez
**auto-indeks** tworzony i utrzymywany automatycznie przez serwer:

```csharp
var query = session.Query<Exoplanet>();
if (!string.IsNullOrEmpty(request.DiscoveryMethod))
    query = query.Where(p => p.DiscoveryMethod == request.DiscoveryMethod);  // → Auto/Exoplanets/ByDiscoveryMethod
```

```csharp
// PaperQueries.cs — auto-index po polu kolekcyjnym
await session.Query<Paper>().Where(x => x.ExoplanetIds.Contains(docId)).ToListAsync(ct);
```

**Jak działa:** przy pierwszym wykonaniu RavenDB analizuje pola w `Where`/`OrderBy`, tworzy
indeks `Auto/...` i odpowiada na zapytanie; kolejne zapytania o ten sam kształt używają tego
samego auto-indeksu.

---

## 4. Min. 1–2 indeksy statyczne z polami wyliczanymi i zapytania z ich wykorzystaniem

**Gdzie:** `ExoPaperRAG.Application/Indexes/`.

Projekt ma kilka indeksów statycznych z polami **wyliczanymi w C#/LINQ**:

### a) `Exoplanets_ByHabitability` — wyliczane pole `bool IsPotentiallyHabitable`
```csharp
Map = exoplanets => from planet in exoplanets
    select new Result {
        IsPotentiallyHabitable = planet.StellarEffectiveTemperatureK != null
            && planet.SemiMajorAxisAu != null
            && planet.SemiMajorAxisAu >= 0.95 && planet.SemiMajorAxisAu <= 1.37
    };
```
Zapytanie (`GetHabitableExoplanetsQueryHandler`):
```csharp
await session.Query<Exoplanets_ByHabitability.Result, Exoplanets_ByHabitability>()
    .Where(x => x.IsPotentiallyHabitable).OfType<Exoplanet>().ToListAsync(ct);
```

### b) `Exoplanets_StatsByDiscoveryMethod` — wyliczane `Count`, `TotalMass`, `AverageMass` (map-reduce, p. 8).

### c) `Papers_ByVector` — wyliczane `CreateVector(...)` oraz `ExoplanetIds` z `LoadDocument` (p. 10).

**Jak działa:** indeks statyczny materializuje pola, których **nie ma w dokumencie** (np.
flaga strefy zamieszkania), a zapytanie filtruje/sortuje po tych wyliczonych polach — szybko,
bez przeliczania w locie.

---

## 5. Paging

**Gdzie:** wiele handlerów; wzorzec `Skip(...).Take(...)`.

```csharp
// ExoplanetQueries.cs
var results = await query.Skip(request.Skip).Take(Math.Clamp(request.Take, 1, 100)).ToListAsync(ct);
```

Stronicowanie sterowane parametrami `skip`/`take` z query-stringa
(`GET /api/exoplanets?skip=0&take=24`). Limit `Take` jest zaciskany (`Math.Clamp`), aby chronić
serwer przed zbyt dużymi stronami. Paging występuje również w listach publikacji i retrievalu RAG.

**Jak działa:** RavenDB tłumaczy `Skip/Take` na `offset/limit` po stronie serwera — zwracana jest
tylko jedna strona wyników.

---

## 6. Full-Text Search

**Gdzie:** indeks `Papers_ByAbstractSearch` (`Index(x => x.Abstract, FieldIndexing.Search)`),
zapytania w `PaperQueries.cs`.

```csharp
var queryable = session.Query<Paper, Papers_ByAbstractSearch>();
if (!string.IsNullOrWhiteSpace(request.Query))
    queryable = queryable.Search(x => x.Abstract, request.Query);   // wyszukiwanie pełnotekstowe
```

**Jak działa:** pole `Abstract` jest tokenizowane analizatorem pełnotekstowym; `.Search()`
dopasowuje słowa/termy (a nie dokładny ciąg), z uwzględnieniem trafności. Używane w wyszukiwarce
publikacji oraz jako fallback przy budowaniu profilu planety i panelu „Powiązane publikacje”.

---

## 7. Dokumenty powiązane — `Include()` i `LoadDocument()`

**`Include()`** — `PaperQueries.cs` (`GetPaperWithAuthorsQueryHandler`): jedno round-trip pobiera
publikację i z góry „dołącza” jej autorów (brak problemu N+1):
```csharp
var paper = await session.LoadAsync<Paper>(docId,
    includes => includes.IncludeDocuments(x => x.AuthorIds), ct);
var authors = await session.LoadAsync<Author>(paper.AuthorIds, ct);  // już w sesji, bez round-tripu
```

**`LoadDocument()`** — `Papers_ByVector.cs`: indeks wektorowy ładuje powiązany dokument `Paper`,
aby pobrać `ExoplanetIds`:
```csharp
let paper = LoadDocument<Paper>(chunk.PaperId)
select new Result { ExoplanetIds = paper != null ? paper.ExoplanetIds.ToArray() : ... };
```

**Jak działa:** `Include` ładuje powiązane dokumenty razem z głównym, eliminując dodatkowe
zapytania; `LoadDocument` w indeksie tworzy zależność — Raven re-indeksuje fragment, gdy zmieni
się powiązany `Paper`.

---

## 8. Indeks map-reduce

**Gdzie:** `Exoplanets_StatsByDiscoveryMethod.cs`.

```csharp
Map    = exoplanets => from p in exoplanets
                       select new Result { DiscoveryMethod = p.DiscoveryMethod ?? "Unknown",
                                           Count = 1, TotalMass = p.MassEarth ?? 0, AverageMass = 0 };
Reduce = results => from r in results
                    group r by r.DiscoveryMethod into g
                    select new Result { DiscoveryMethod = g.Key,
                                        Count = g.Sum(x => x.Count),
                                        TotalMass = g.Sum(x => x.TotalMass),
                                        AverageMass = g.Sum(x => x.TotalMass) / g.Sum(x => x.Count) };
```
Zapytanie: `GetDiscoveryStatsQueryHandler` (zasila wykres „Metody odkrycia”).

**Jak działa:** faza **Map** emituje krotki częściowe per dokument, faza **Reduce** grupuje je po
`DiscoveryMethod` i agreguje. Wyniki są inkrementalnie aktualizowane przy zmianach danych — odczyt
statystyk jest natychmiastowy.

---

## 9. Sortowanie wyników po wybranych polach

**Gdzie:** `ExoplanetQueries.cs`, `PaperQueries.cs`.

```csharp
if (request.SortBy == "orbitalPeriod")
    query = query.OrderBy(p => p.OrbitalPeriodDays);     // wybór pola sortowania przez klienta

await session.Query<Paper, Papers_ByAbstractSearch>()
    .Search(x => x.Abstract, term)
    .OrderByDescending(x => x.PublishedDate)             // najnowsze najpierw
    .ToListAsync(ct);
```

**Jak działa:** `OrderBy`/`OrderByDescending` realizowane są po stronie serwera/indeksu; pole
sortowania może być wybierane dynamicznie przez parametr żądania.

---

## 10. Vector Search

**Gdzie:** indeks `Papers_ByVector` (Corax, `VectorIndexes.Add(... CreateVector ...)`),
zapytania w `AskExoplanet.cs`, `SearchHybridQueryHandler.cs`, `PaperQueries.cs`.

```csharp
var queryable = session.Query<Papers_ByVector.Result, Papers_ByVector>();
if (!string.IsNullOrWhiteSpace(planetDocId))
    queryable = queryable.Where(x => x.ExoplanetIds.Contains(planetDocId));  // scope po planecie

return await queryable
    .VectorSearch(f => f.WithField(x => x.Vector),
                  f => f.ByEmbedding(queryVector))   // embedding pytania użytkownika
    .Take(take)
    .ProjectInto<Papers_ByVector.Result>()
    .ToListAsync(ct);
```

**Jak działa:** tekst publikacji jest dzielony na fragmenty i embeddowany (model
`nomic-embed-text`); wektory trafiają do indeksu Corax (HNSW). `VectorSearch(...ByEmbedding...)`
znajduje fragmenty semantycznie najbliższe wektorowi pytania (kosinusowo) — to fundament RAG
(„Spytaj AI”) oraz wyszukiwania hybrydowego.

---

## 11. Modyfikacja dokumentów przez `PatchByQuery()`

**Gdzie:** `PaperCommands.cs` (`MarkAllPapersReviewedCommandHandler`),
endpoint `POST /api/papers/mark-all-reviewed`.

```csharp
var operation = await _store.Operations.SendAsync(
    new PatchByQueryOperation(new IndexQuery
    {
        Query = "from Papers update { this.IsReviewed = true; }"
    }), token: ct);

await operation.WaitForCompletionAsync(TimeSpan.FromSeconds(30));
```

**Jak działa:** to **operacja serwerowa** — RavenDB wykonuje skrypt JS (`update { ... }`) na
wszystkich dokumentach pasujących do zapytania RQL, **bez** ładowania ich do klienta. Zwraca
operację, na której można czekać (`WaitForCompletionAsync`). Idealne do masowych aktualizacji.

---

## 12. Klaster złożony z 3 węzłów

**Gdzie:** `docker-compose.yml` (usługi `ravendb-a`, `ravendb-b`, `ravendb-c`),
`ExoPaperRAG.Infrastructure/Persistence/RavenInitializer.cs`, `Program.cs`.

`docker-compose.yml` — trzy węzły, każdy z własnym wolumenem i limitem pamięci; komunikacja
wewnątrz sieci po adresach `ravendb-a/-b/-c`:
```yaml
ravendb-a: { image: ravendb/ravendb:latest, mem_limit: 1500m, ... }
ravendb-b: { ... }
ravendb-c: { ... }
```

Klient łączy się do wszystkich trzech węzłów (`Program.cs`):
```csharp
// RavenSettings__Urls__0/1/2 = http://ravendb-a:8080, ravendb-b:8080, ravendb-c:8080
Urls = settings.Urls
```

`RavenInitializer` automatycznie formuje klaster przy starcie:
```csharp
await http.PostAsync($"{leader}/admin/cluster/bootstrap", ...);          // węzeł A → lider
foreach (var node in nodes.Skip(1))
    await http.PutAsync($"{leader}/admin/cluster/node?url={node}", ...);  // dołącz B i C
// po osiągnięciu pełnego członkostwa tworzy bazę z replication factor = liczba węzłów
await _store.Maintenance.Server.SendAsync(
    new CreateDatabaseOperation(new DatabaseRecord(db), replicationFactor: members), ct);
```

**Jak działa:** świeże węzły startują w stanie *passive*; initializer bootstrapuje węzeł A na
lidera, dołącza B i C, czeka aż staną się pełnymi członkami, po czym tworzy bazę `ExoPaper` z
replikacją na 3 węzły. Dane są replikowane między węzłami, a klient (z `DisableTopologyUpdates`)
zna pełną topologię klastra.
