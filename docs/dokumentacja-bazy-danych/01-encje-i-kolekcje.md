# 1. Encje i kolekcje

RavenDB jest bazą dokumentową — każda encja jest serializowana do dokumentu JSON i należy do
**kolekcji** wyznaczonej przez nazwę typu (np. `Exoplanet` → kolekcja `Exoplanets`). Aplikacja
posiada **6 kolekcji**, co spełnia wymóg „minimum 3 kolekcje”.

---

## 1.1. `Exoplanet` → kolekcja `Exoplanets`

Plik: `ExoPaperRAG.Domain/Entities/Exoplanet.cs`

Główna encja katalogu — ~40 parametrów naukowych pojedynczej planety. Identyfikator jest
deterministyczny (z nazwy planety), dzięki czemu ponowny import nie tworzy duplikatów:

```csharp
public static string BuildId(string name) => $"exoplanets/{name.Replace(" ", "-")}";
```

Wybrane pola (pełna lista w pliku encji):

| Grupa | Pola |
|-------|------|
| Tożsamość/system | `Name`, `HostName`, `PlanetLetter`, `Aliases`, `NumberOfStars`, `NumberOfPlanets`, `RightAscension`, `Declination`, `VMagnitude`, `KMagnitude`, `GaiaMagnitude` |
| Odkrycie | `DiscoveryMethod`, `DiscoveryYear`, `DiscoveryFacility`, `DiscoveryTelescope`, `DiscoveryInstrument` |
| Masa/promień | `MassEarth`, `LowerBoundMassEarth`, `MassJupiter`, `MassProvenance`, `MsiniEarth`, `MassIsDerived`, `RadiusEarth`, `RadiusJupiter`, `RadiusIsDerived`, `DensityGramPerCm3` |
| Orbita | `OrbitalPeriodDays`, `Eccentricity`, `SemiMajorAxisAu`, `InclinationDeg` |
| Klimat | `EquilibriumTemperatureK`, `EquilibriumTemperatureIsDerived`, `InsolationFlux` |
| Gwiazda | `SpectralType`, `StellarEffectiveTemperatureK`, `StellarRadiusSolar`, `StellarMassSolar`, `StellarLuminosityLogSolar`, `StellarSurfaceGravity`, `StellarMetallicity`, `StellarAgeGyr`, `DistanceParsecs` |
| Metadane RAG | `HasEmbeddings`, `Tags`, `TagsProcessed`, `CachedAiGeneralSummary`, `CachedUncertaintySummary`, `LastTargetedHarvestUtc` |

**Pola wyliczane (logika domenowa)** — encja zawiera metody przeliczające jednostki i metrykę
kompletności danych (używaną później w indeksach i API):

```csharp
public int ComputeCompletenessPercent() { /* % wypełnionych kluczowych parametrów */ }
private void DeriveMass(ExoplanetScientificData d)         // Mjup → M⊕ (flaga MassIsDerived)
private void DeriveEquilibriumTemperature(...)             // T_eq z parametrów gwiazdy
```

Metody mutujące stan naukowy (używane przez `NasaSyncJob`):
`Create(...)`, `ApplyScientificUpdate(...)` — aktualizują pola, zachowując wzbogacenie (tagi,
embeddingi) i ustawiając `TagsProcessed = false` przy realnej zmianie.

---

## 1.2. `Paper` → kolekcja `Papers`

Plik: `ExoPaperRAG.Domain/Entities/Paper.cs`

Publikacja naukowa z arXiv.

```csharp
public class Paper
{
    public string Id { get; set; }                 // papers/{arxivId}
    public string Title { get; set; }
    public string Abstract { get; set; }
    public DateTime PublishedDate { get; set; }
    public List<string> AuthorIds { get; set; }    // relacja → Authors (Include)
    public List<string> ExoplanetIds { get; set; } // relacja → Exoplanets (entity-linking)
    public bool HasEmbeddings { get; set; }
    public int ChunkCount { get; set; }            // liczba fragmentów (chunków)
    public bool IsReviewed { get; set; }           // ustawiane przez PatchByQuery
    public bool LinksProcessed { get; set; }
    public static string ChunkId(string paperId, int index) => $"PaperChunks/{...}/{index}";
}
```

**Ważna decyzja projektowa:** wektory embeddingów **nie** są przechowywane w dokumencie `Paper`
— trzymane są w osobnej kolekcji `PaperChunks`, aby dokumenty `Paper` pozostały małe (inline setki
768-wymiarowych wektorów przekraczało limit 5 MB RavenDB i powodowało wolne zapisy).

---

## 1.3. `PaperChunk` → kolekcja `PaperChunks`

Plik: `ExoPaperRAG.Domain/Entities/Paper.cs`

Pojedynczy, zembeddowany fragment tekstu publikacji — **osobny dokument** indeksowany do
wyszukiwania wektorowego.

```csharp
public class PaperChunk
{
    public string Id { get; set; }        // PaperChunks/{arxivId}/{index}
    public string PaperId { get; set; }   // papers/{arxivId} — relacja (LoadDocument w indeksie)
    public int Index { get; set; }
    public string Text { get; set; }
    public float[] Vector { get; set; }   // embedding (nomic-embed-text)
}
```

---

## 1.4. `Author` → kolekcja `Authors`

Autor publikacji; identyfikator deterministyczny z nazwy (`authors/{slug}`). Powiązany z `Paper`
przez `Paper.AuthorIds` i ładowany przez `Include()`.

```csharp
public class Author
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Affiliation { get; set; }
}
```

---

## 1.5. `SyncTracker` → kolekcja `SyncTrackers`

Stan synchronizacji per dostawca danych (NASA, arXiv): `ProviderName`, `LastSyncUtc`,
`TotalDocumentsSynced`, `LastError`. Identyfikator: `SyncTrackers/{ProviderId}`. Używany przez
joby `NasaSyncJob` / `ArxivHarvesterJob` do śledzenia high-water-mark synchronizacji.

---

## 1.6. `OutboxEvent` → kolekcja `OutboxEvents`

Transakcyjny **outbox** dla zdarzeń czasu rzeczywistego (`PaperEmbedded`, `ExoplanetTagged`).
Workery zapisują zdarzenie w tej samej transakcji co zmianę danych, a `OutboxDispatcher`
dostarcza je przez SignalR. `OutboxCleanupService` usuwa stare wpisy.
