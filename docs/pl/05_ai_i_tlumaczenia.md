# Logika AI i Tłumaczeń

W przeciwieństwie do typowych, nowoczesnych projektów, w których "AI" oznacza jedynie bezmyślne przekazywanie klucza API do OpenAI, **ExoPaper od samego początku został zaprojektowany by polegać w stu procentach na lokalnie zhostowanych, otwartoźródłowych modelach sztucznej inteligencji**. Gwarantuje to pełną prywatność i darmowe korzystanie z pełnego wachlarza technologii, opierając jedynie rachunek na karcie graficznej urządzenia hostującego.

## Środowisko Wykonawcze LLM (Ollama)

Silnik wnioskowania to **Ollama** pracująca wewnątrz sieci Dockerowej. Backend (.NET) komunikuje się z nią poprzez zapytania HTTP do dedykowanego adresu `http://ollama:11434`. Dostęp do procesora graficznego NVIDIA (akceleracja CUDA) pozwala na błyskawiczne procesowanie potężnych zapytań (tzw. "Context Window").

Używane są dwa modele:
1. **Llama 3.2 (3 miliardy parametrów - 3B):** Niezwykle wydajny i "lekki" z punktu widzenia zapotrzebowania na vRAM model od Meta. Wybrany ze względu na znakomity stosunek wielkości do bystrości w przetwarzaniu długich artykułów naukowych.
2. **Nomic Embed Text:** Mały, specjalistyczny model, którego jedynym zadaniem jest konwersja tekstu na macierze/wektory liczb. Niezbędny do funkcjonalności Semantic Search.

### 1. Inżynieria Zapytań (Prompt Engineering) i Złudzenia (Hallucinations)

Model Llama 3.2:3b odpowiada za generowanie ładnych i zwięzłych opisów planet dla sekcji "Analiza AI". Czasami problemem dla mniejszych modeli LLM bywa nadmierne koloryzowanie (zmyślanie). Aby zminimalizować "halucynacje", w kodzie źródłowym (`GetPlanetAiSummaryQueryHandler.cs`) nałożono **restrykcyjny "System Prompt"**:
- Model ma zakaz zmyślania metryk, których nie podano mu jako zmiennych z API NASA.
- Moduł oceny warunków życiowych (`habitability_assessment`) ma żelazny nakaz kierowania się weryfikacją sztywnej matematyki: jeśli parametr "Equilibrium Temperature" z bazy NASA przekracza próg 320 Kelwinów lub "Orbital Period" (okres obiegu dookoła gwiazdy) jest niezwykle mały (np. poniżej 10 dni – co stawia planetę zaraz przy piecu słonecznym), to Llama **musi kategorycznie zaprzeczyć** występowaniu ciekłej wody i habitabilności, zapobiegając szerzeniu dezinformacji.
- Format wyjścia: Model otrzymuje do wypełnienia instrukcję JSON, aby backend mógł ładnie przeparsować go dla UI bez ryzyka rozsypania tekstu.

### 2. Retrieval-Augmented Generation (RAG)

W momencie zadawania pytania przez asystenta chatbota wbudowanego w UI, użyto mechanizmu RAG:
1. Twoje pytanie (np. *"Czy na tej planecie występują chmury siarkowe?"*) jest najpierw przetwarzane na ciąg liczb przez `nomic-embed-text`.
2. Z tą "linijką liczb" RavenDB analizuje zindeksowaną bazę abstraktów arXiv dotyczących wybranej planety i znajduje te teksty naukowe, których przestrzeń wielowymiarowa znajduje się najbliżej liczbowej przestrzeni pytania.
3. Artykuły te (odkryte fakty) stanowią "suplement", który doklejany jest w locie (injected) do pamięci systemowej modelu Llama 3.2. Dopiero z tak sklejonym podręcznikiem Llama pisze wygenerowaną, ostateczną odpowiedź na Twoje pytanie, co uwiarygodnia wypowiedzi AI w aplikacji.

---

## Moduł Tłumaczeniowy (LibreTranslate)

Ponieważ aplikacja udostępniana jest po polsku, ale świat astronomii "mówi" w 99% językiem angielskim, użyto **LibreTranslate** jako translatora. 

### Dlaczego Tłumaczenie po stronie Klienta, a nie Bazy?
Tłumaczenia w ExoPaper wykonywane są w głównej mierze przez komponenty w UI (Frontend), a nie w locie po stronie backendu podczas zapisywania do bazy:
- **Niezależność:** W przyszłości aplikacja może zostać bez zmian kodu przełączona na inny język (np. język hiszpański lub niemiecki), podczas gdy baza (RavenDB) cały czas przechowuje neutralne, zunifikowane anglojęzyczne źródła (The Ground Truth).
- **Elastyczność UI:** Tłumaczenia mogą być wyzwalane asynchronicznie, gdy dany tekst wchodzi w kadr przewijania, nie zablokowując procesu generowania odpowiedzi.

Nginx z `exopaper_ui` służy jako lokalny kurier — przechwytuje ze ścieżki przeglądarki wywołanie `/api/translate` i uderza do zamkniętego w sieci dockera `libretranslate:5000`. Wynik wędruje do stanu Hook'a `useTranslate`, który cachuje (buforuje) ten zwrot w pamięci tymczasowej (RAM) sesji dla oszczędzenia zasobów.
