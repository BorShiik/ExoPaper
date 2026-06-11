# 2. Indeksy

RavenDB używa dwóch rodzajów indeksów:

- **auto-indeksy** — tworzone automatycznie przez serwer na podstawie zapytań dynamicznych,
- **indeksy statyczne** — definiowane w kodzie jako klasy dziedziczące po
  `AbstractIndexCreationTask<T>`. Wdrażane przy starcie przez `RavenInitializer`.

Wszystkie indeksy statyczne znajdują się w `ExoPaperRAG.Application/Indexes/`.

---

## 2.1. Auto-indeksy (zapytania dynamiczne)

Zapytania pisane bez wskazania indeksu, np. `session.Query<Exoplanet>().Where(...)`, są
obsługiwane przez **auto-indeksy** generowane przez RavenDB w locie. Przy pierwszym zapytaniu
serwer tworzy indeks typu `Auto/Exoplanets/By...` i utrzymuje go automatycznie.

Przykłady w kodzie:

```csharp
// ExoplanetQueries.cs — filtrowanie po metodzie odkrycia (auto-index)
var query = session.Query<Exoplanet>();
if (!string.IsNullOrEmpty(request.DiscoveryMethod))
    query = query.Where(p => p.DiscoveryMethod == request.DiscoveryMethod);

// PaperQueries.cs — publikacje powiązane z planetą (auto-index na kolekcji)
await session.Query<Paper>()
    .Where(x => x.ExoplanetIds.Contains(docId))
    .ToListAsync(ct);
```

---

## 2.2. Indeks statyczny z polem wyliczanym — `Exoplanets_ByHabitability`

Plik: `ExoPaperRAG.Application/Indexes/Exoplanets_ByHabitability.cs`

Indeks oblicza **nowe pole logiczne** `IsPotentiallyHabitable` (pole wyliczane w C#/LINQ),
którego nie ma w dokumencie — na podstawie temperatury gwiazdy i półosi wielkiej orbity:

```csharp
public class Exoplanets_ByHabitability : AbstractIndexCreationTask<Exoplanet>
{
    public class Result { public bool IsPotentiallyHabitable { get; set; } }

    public Exoplanets_ByHabitability()
    {
        Map = exoplanets => from planet in exoplanets
                            select new Result
                            {
                                IsPotentiallyHabitable =
                                    planet.StellarEffectiveTemperatureK != null
                                    && planet.SemiMajorAxisAu != null
                                    && planet.SemiMajorAxisAu >= 0.95
                                    && planet.SemiMajorAxisAu <= 1.37
                            };
    }
}
```

Zapytanie wykorzystujące to wyliczane pole (`GetHabitableExoplanetsQueryHandler`):

```csharp
await session.Query<Exoplanets_ByHabitability.Result, Exoplanets_ByHabitability>()
    .Where(x => x.IsPotentiallyHabitable)   // filtr po polu WYLICZONYM w indeksie
    .OfType<Exoplanet>()
    .Skip(request.Skip).Take(...)
    .ToListAsync(ct);
```

---

## 2.3. Indeks map-reduce z polami wyliczanymi — `Exoplanets_StatsByDiscoveryMethod`

Plik: `ExoPaperRAG.Application/Indexes/Exoplanets_StatsByDiscoveryMethod.cs`

Agregacja statystyk per metoda odkrycia. Faza **Map** projektuje, faza **Reduce** grupuje i
liczy pola wyliczane `Count`, `TotalMass`, `AverageMass`:

```csharp
public class Exoplanets_StatsByDiscoveryMethod
    : AbstractIndexCreationTask<Exoplanet, Exoplanets_StatsByDiscoveryMethod.Result>
{
    public class Result
    {
        public string DiscoveryMethod { get; set; }
        public int Count { get; set; }
        public double TotalMass { get; set; }
        public double AverageMass { get; set; }   // pole wyliczane
    }

    public Exoplanets_StatsByDiscoveryMethod()
    {
        Map = exoplanets => from planet in exoplanets
                            select new Result {
                                DiscoveryMethod = planet.DiscoveryMethod ?? "Unknown",
                                Count = 1,
                                TotalMass = planet.MassEarth ?? 0,
                                AverageMass = 0
                            };

        Reduce = results => from result in results
                            group result by result.DiscoveryMethod into g
                            select new Result {
                                DiscoveryMethod = g.Key,
                                Count = g.Sum(x => x.Count),
                                TotalMass = g.Sum(x => x.TotalMass),
                                AverageMass = g.Sum(x => x.TotalMass) / g.Sum(x => x.Count)
                            };
    }
}
```

Zapytanie (`GetDiscoveryStatsQueryHandler`) — zasila wykres „Metody odkrycia” na dashboardzie.

---

## 2.4. Indeks full-text search — `Papers_ByAbstractSearch`

Plik: `ExoPaperRAG.Application/Indexes/Papers_ByAbstractSearch.cs`

Pole `Abstract` jest indeksowane w trybie `FieldIndexing.Search` (analizator pełnotekstowy):

```csharp
public class Papers_ByAbstractSearch : AbstractIndexCreationTask<Paper>
{
    public Papers_ByAbstractSearch()
    {
        Map = papers => from paper in papers
                        select new { Abstract = paper.Abstract, paper.PublishedDate };

        Index(x => x.Abstract, FieldIndexing.Search);   // full-text
    }
}
```

Zapytania używają `.Search(...)` (patrz `03-zapytania-i-crud.md`, sekcja Full-Text Search).

---

## 2.5. Indeks wektorowy (Vector Search) — `Papers_ByVector`

Plik: `ExoPaperRAG.Application/Indexes/Papers_ByVector.cs`

Indeks **wektorowy** (silnik **Corax**) zbudowany nad kolekcją `PaperChunks`. Zawiera trzy
istotne mechanizmy:

1. **Pole wyliczane wektorowe** `CreateVector(chunk.Vector)`,
2. **LoadDocument** — pobiera `ExoplanetIds` z powiązanego dokumentu `Paper` (re-indeksacja przy
   zmianie powiązania),
3. **Store** — pola projektowane bez ładowania dużego dokumentu źródłowego.

```csharp
public class Papers_ByVector : AbstractIndexCreationTask<PaperChunk, Papers_ByVector.Result>
{
    public class Result {
        public string PaperId { get; set; }
        public string[] ExoplanetIds { get; set; }
        public int ChunkIndex { get; set; }
        public string Text { get; set; }
        public object Vector { get; set; }
    }

    public Papers_ByVector()
    {
        Map = chunks => from chunk in chunks
                        where chunk.Vector != null && chunk.Vector.Length > 0
                        let paper = LoadDocument<Paper>(chunk.PaperId)      // dokument powiązany
                        select new Result {
                            PaperId = chunk.PaperId,
                            ExoplanetIds = paper != null ? paper.ExoplanetIds.ToArray()
                                                         : System.Array.Empty<string>(),
                            ChunkIndex = chunk.Index,
                            Text = chunk.Text,
                            Vector = CreateVector(chunk.Vector)            // pole wektorowe
                        };

        Store(x => x.PaperId, FieldStorage.Yes);
        Store(x => x.ChunkIndex, FieldStorage.Yes);
        Store(x => x.Text, FieldStorage.Yes);

        SearchEngineType = SearchEngineType.Corax;                        // wymagane dla wektorów
        VectorIndexes.Add(x => x.Vector, new VectorOptions());
    }
}
```
