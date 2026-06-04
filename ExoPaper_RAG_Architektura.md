# Architektura i projektowanie funkcjonalne systemu informacyjno-analitycznego ExoPaper RAG

Współczesna astrofizyka i planetologia przeżywają epokę bezprecedensowego wzrostu ilości danych obserwacyjnych. Od momentu wystrzelenia kosmicznego teleskopu Kepler i późniejszego wdrożenia misji TESS oraz James Webb Space Telescope (JWST), paradygmat badań przesunął się z prostego odkrywania egzoplanet w stronę ich głębokiej charakteryzacji i poszukiwania biosygnatur. Według stanu na początek 2026 roku, archiwa NASA zawierają informacje o ponad 6200 potwierdzonych egzoplanetach i milionach obiektów kandydujących (Kepler Objects of Interest — KOI, Threshold-Crossing Events — TCE). Równolegle z tym wykładniczo rośnie zasób nieustrukturyzowanych publikacji naukowych zamieszczanych na platformie arXiv.

Problemem, z którym mierzą się współcześni badacze, jest izolacja twardych danych parametrycznych (okresy orbitalne, masy, promienie) od semantycznego kontekstu dyskusji naukowych (modele atmosfer, problemy szumu gwiazdowego, hipotezy o migracji). Opracowywany system „ExoPaper RAG” ma na celu zniwelowanie tej luki, oferując architekturę opartą na stosie C# ASP.NET Core i RavenDB, gdzie ścisłe filtry relacyjne integrują się z semantycznym wyszukiwaniem wektorowym (Retrieval-Augmented Generation), opierającym się na lokalnych dużych modelach językowych (LLM).

Niniejszy raport stanowi wyczerpującą analizę dziedziny oraz decyzji projektowych niezbędnych do realizacji platformy o profesjonalnym standardzie, zdolnej sprostać wymaganiom astrofizyków w przygotowaniach do przyszłych misji, takich jak Habitable Worlds Observatory (HWO).

---

## BLOK 1: Projektowanie funkcjonalności (Perspektywa astrofizyczna)

Aby system stanowił realną wartość dla społeczności naukowej, jego funkcjonalność musi być bezpośrednio zgodna ze strategicznymi dokumentami NASA, w szczególności z oficjalnie zatwierdzoną listą „luk naukowych” (Exoplanet Exploration Program Science Gaps). Luki te określają najpoważniejsze problemy utrudniające zrozumienie architektury układów planetarnych i modelowanie atmosfer egzoplanet.

### Kluczowe funkcje analityczne (Killer Features) dla badaczy

Analiza potrzeb planetologów wskazuje na konieczność odejścia od koncepcji prostych agregatorów katalogów na rzecz inteligentnych systemów walidacji krzyżowej i wykrywania ukrytych zależności. Projektowany interaktywny pulpit nawigacyjny (dashboard) powinien realizować następujące możliwości wysokiego poziomu:

- **Walidacja krzyżowa potencjalnych biosygnatur i analiza szumu gwiazdowego:** W astrofizyce istnieje fundamentalny problem: aktywność gwiazd (plamy, pochodnie, koronalne wyrzuty masy), znana jako „szum gwiazdowy” (Stellar Jitter, Science Gap #8), potrafi generować przesunięcia widmowe, które przy wykorzystaniu metody prędkości radialnych są błędnie interpretowane jako oddziaływanie grawitacyjne planet o małej masie. System ExoPaper RAG będzie w stanie automatycznie zestawiać parametry planet z semantyczną treścią preprintów. Lokalny LLM będzie identyfikował ostrzeżenia o wysokim poziomie aktywności chromosferycznej. W interfejsie dashboardu takie planety będą oznaczane wizualnymi wskaźnikami 3D (Three.js), co pozwoli błyskawicznie ocenić ryzyko fałszywie pozytywnego wykrycia biosygnatur (Science Gap #16).
- **Moduł szacowania docelowych prób dla przyszłych misji (Precursor Science Target Yield Estimation):** Misja Habitable Worlds Observatory stawia sobie za cel bezpośrednią charakteryzację 25 potencjalnie nadających się do zamieszkania światów. Proces doboru celów zależy od powszechności występowania planet skalistych (Science Gap #5) oraz wpływu pyłu egzozodiakalnego (Science Gap #11). Gęste dyski pyłowe sprawiają, że metoda bezpośredniego obrazowania staje się nieefektywna. ExoPaper RAG pozwoli łączyć twarde filtry z szacunkami gęstości pyłu wyekstrahowanymi przez RAG z tekstów naukowych, tworząc listy najbardziej „czystych” celów.
- **Automatyczne mapowanie mgły fotochemicznej i aerozoli:** Zastosowanie spektroskopii transmisyjnej wobec tranzytujących subneptunów często daje „płaskie” widma z powodu mgły fotochemicznej. ExoPaper RAG skanuje korpus arXiv pod kątem nieprzezroczystości (Science Gap #13, #15). Na podstawie grafów wiedzy silnik Three.js będzie dynamicznie renderował profil wizualny planety, dostarczając natychmiastowe zrozumienie stanu zbadania obiektu.
- **Analiza dyspersji pomiarów i śledzenie metryk niepewności (Uncertainty Tracking):** Dane o planetach w NASA Exoplanet Archive są organizowane według publikacji (tabele ps) i mogą być sprzeczne. Zwykłe bazy zwracają wszystkie wartości, ale ExoPaper RAG wykorzysta LLM do syntezy podsumowania wyjaśniającego przyczyny rozbieżności (np. różnice w sprzęcie pomiarowym), co radykalnie ułatwi podejmowanie decyzji.

### Integracja parametrów matematycznych i wyszukiwania semantycznego

Wartość wdrożenia algorytmów Retrieval-Augmented Generation w bazach danych szeregów czasowych jest maksymalizowana przy zapytaniach hybrydowych. Łączą one ograniczenia relacyjne oraz semantyczne podobieństwo wektorów. Architektura ADQL będzie tłumaczona na zapytania RavenDB z filtrami wektorowymi.

Poniżej przedstawiono przykłady nieoczywistych scenariuszy wyszukiwania:

**1. Identyfikacja skalistych światów z przeszkodami obserwacyjnymi (Szum gwiazdowy i pył)**

- **Parametry NASA (filtry RavenDB / ADQL):** Masa: `0.5 <= pl_masse <= 2.0` | Ekscentryczność: `pl_orbeccen < 0.1` | Metoda: `discoverymethod = 'Radial Velocity'`
- **Semantyczne zapytanie RAG (arXiv):** "Wpływ gęstego pyłu egzozodiakalnego na bezpośrednie obrazowanie", "Problemy ekstrakcji sygnatur widmowych z powodu koronalnych wyrzutów masy".
- **Sens i uzasadnienie:** Wyszukiwanie układów formalnie spełniających kryteria "ziemi", ale wymagających nowych metod tłumienia szumu gwiazdowego (_Mitigating stellar jitter_).

**2. Analiza mechanizmów migracji "Gorących Jowiszów" i ekstremalnych orbit**

- **Parametry NASA (filtry RavenDB / ADQL):** Promień: `pl_radj > 1.0` (jowiszowy) | Okres: `pl_orbper < 10` dni | Ekscentryczność: `pl_orbeccen > 0.4`
- **Semantyczne zapytanie RAG (arXiv):** "Mechanizmy dynamicznego rozpraszania", "Efekt Kozai-Lidova", "Pływowe kołowanie orbit w układach podwójnych".
- **Sens i uzasadnienie:** Gromadzenie publikacji wyjaśniających, w jaki sposób planeta-gigant mogła znaleźć się na tak bliskiej i wydłużonej orbicie względem gwiazdy, z pominięciem klasycznych teorii formowania się w dysku protoplanetarnym.

**3. Ocena perspektyw spektroskopii transmisyjnej subneptunów**

- **Parametry NASA (filtry RavenDB / ADQL):** Promień: `1.5 <= pl_rade <= 3.0` | Masa: `pl_masse < 10.0` | Metoda: `discoverymethod = 'Transit'`
- **Semantyczne zapytanie RAG (arXiv):** "Degeneracja widm transmisyjnych", "Mgła fotochemiczna w atmosferach bogatych w wodór", "Nieprzezroczystość warstwy chmur i rozpraszanie Rayleigha".
- **Sens i uzasadnienie:** Identyfikacja planet, których atmosfery są podatne na tworzenie się aerozoli na dużych wysokościach, sprawiających, że obserwacje JWST lub HWO stają się bezowocne (Science Gap #13, #15).

---

## BLOK 2: Harmonogram (Roadmap) rozwoju (Perspektywa architektoniczna)

Projektowanie rozproszonego, heterogenicznego systemu integrującego strumienie surowych danych z API NASA, masywne korpusy tekstów z arXiv oraz lokalne moce obliczeniowe do wnioskowania (_inference_) dużych modeli językowych (Ollama), wymaga rygorystycznego przestrzegania zasad asynchroniczności, idempotencji i odporności na awarie.

Realizacja podzielona jest na trzy logiczne fazy:

### Faza 1: Ingestia danych i agregacja katalogów (Sprinty 1-2)

Konieczne jest opracowanie niezawodnych potoków ekstrakcji danych (ETL), uwzględniających surowe limity usług zewnętrznych (API NASA blokuje klucze po przekroczeniu limitu, arXiv pozwala na 1 zapytanie co 3 sekundy).

- Głównym wzorcem po stronie C# ASP.NET Core będzie wykorzystanie `IHostedService` z biblioteką Polly (_Retry with Exponential Backoff_, _Circuit Breaker_).
- Wyekstrahowane dane są zapisywane w RavenDB. Zamiast SQL, wykorzystany zostanie mechanizm **RavenDB MapReduce Indexes**, pozwalający na asynchroniczną agregację (np. `Planets_Statistics_ByDiscoveryMethod`), co zwraca dane statystyczne natychmiast bez skanowania bazy.

### Faza 2: Budowa asynchronicznego potoku RAG (Sprinty 3-4)

Druga faza to semantyczne wzbogacanie danych. Lokalne LLM (Ollama) wymagają zasobów VRAM, wykluczając synchroniczne wywołania.

- Architektura oprze się na **RavenDB Data Subscriptions** (_Batch Processing_ z gwarancją dostarczenia). Klient C# przekazuje tekst do modelu w celu wygenerowania podsumowania i embeddingu.
- W warstwie logiki biznesowej zastosowany zostanie wzorzec **CQRS** (MediatR). RavenDB 7.0 natywnie obsługuje **Vector Search**, a wygenerowane osadzenia są zapisywane bezpośrednio w dokumentach.

### Faza 3: Tworzenie grafu wiedzy i wizualizacja (Sprinty 5-6)

Ostatni etap to proceduralne generowanie powiązań i aktualizacja UI (Vue.js/React).

- Dla spójności operacji wykorzystany zostanie wzorzec **Outbox**. Po przetworzeniu artykułu generowane jest zdarzenie, przesyłane do klienta przez **SignalR (WebSockets)**.
- Planowane jest wykorzystanie **RavenDB AI ETL**, aby automatycznie klasyfikować nowe dokumenty (np. tagować kandydatów do HWO) za pomocą LLM.

---

## BLOK 3: Onboarding dla dewelopera (Wprowadzenie w temat)

Inżynieria danych astrofizycznych wymaga zrozumienia, że wielkości astronomiczne zawsze posiadają błędy pomiarowe (_uncertainties_) i limity (_limits_). Reprezentacja masy jako zwykłego `double` jest niewystarczająca.

### Ściągawka: Kluczowe koncepcje astrofizyczne dla bazy danych

- **Metoda tranzytowa (Transit Method):** Dostarcza dokładny promień (`pl_radj`, `pl_rade`) i okres (`pl_orbper`), ale nie masę. Pola masy muszą być `Nullable<double>`.
- **Metoda prędkości radialnych (Radial Velocity):** Dostarcza dolną granicę masy (`pl_bmasse`) i ekscentryczność (`pl_orbeccen`), ale nie promień.
- **Strefa zamieszkiwalna (Habitable Zone):** Dynamicznie obliczana wielkość zależna od temperatury gwiazdy (`st_teff`), jasności i wielkiej półosi orbity (`pl_orbsmax`).
- **Szum gwiazdowy (Stellar Jitter):** Tło aktywności gwiazdy maskujące sygnały od małych planet (Science Gap #8).
- **Pył egzozodiakalny (Exozodiacal Dust):** Pył utrudniający bezpośrednie obrazowanie (Science Gap #11).

### Techniczne niuanse i pułapki API (Gotchas)

**NASA Exoplanet Archive (TAP / ADQL):**

- **Float values:** ADQL może zaokrąglać liczby w `SELECT`, ale porównywać oryginały w `WHERE`. Rzutowanie na VARCHAR w TAP usuwa wiodące zera (np. `.85` zamiast `0.85`). Wymaga to customowych `JsonConverter` w C#.
- **Multiple Publications:** Dane są zorganizowane według publikacji. Należy używać tabeli `pscomppars` dla wartości reprezentatywnych (_default solution_).

**arXiv API:**

- **Max results:** Przekroczenie 30 000 wyników w Query API powoduje HTTP 400. Należy używać protokołu **OAI-PMH** (`oaipmh.arxiv.org/oai`).
- **Throttling:** Max 1 żądanie co 3 sekundy. Wymagany `SemaphoreSlim` w `HttpClient`.
- **Błędy w XML:** Błędy API są zwracane jako Atom XML z tagiem `<title>Error</title>`.
- **Sortowanie:** Domyślnie arXiv sortuje według trafności (_relevancy_), a nie daty. Należy sortować programowo po tagu `<published>`.

Opracowanie systemu ExoPaper RAG to ambitna integracja wiedzy domenowej z zaawansowanymi możliwościami ekosystemu .NET i architektury NoSQL RavenDB. Przestrzeganie powyższych zasad pozwoli stworzyć narzędzie o wysokim standardzie akademickim.
