# Wprowadzenie do projektu ExoPaper

## O projekcie

**ExoPaper** to zaawansowana aplikacja internetowa (platforma RAG - Retrieval-Augmented Generation), służąca do eksploracji, analizy i wizualizacji danych o egzoplanetach. Projekt łączy surowe dane astronomiczne pobierane z archiwum NASA (NASA Exoplanet Archive) z najnowszymi publikacjami naukowymi z bazy arXiv, a następnie wykorzystuje lokalne modele sztucznej inteligencji (LLM) do generowania czytelnych i wyczerpujących podsumowań.

Głównym celem systemu jest ułatwienie dostępu do wiedzy o egzoplanetach. Zamiast przebijać się przez surowe tabele z parametrami fizycznymi lub skomplikowane prace badawcze, użytkownik otrzymuje przystępne streszczenia, trójwymiarowe wizualizacje ciał niebieskich oraz możliwość zadawania pytań asystentowi AI w języku naturalnym.

## Główne funkcjonalności

1. **Katalog Egzoplanet (Synchronizacja NASA):**
   - System automatycznie (w tle) pobiera najnowsze informacje o odkrytych planetach pozasłonecznych, korzystając z protokołu TAP (Table Access Protocol) archiwum NASA.
   - Użytkownik ma dostęp do listy planet, z możliwością filtrowania (np. według metody odkrycia, statusu kandydata HWO) oraz sortowania.

2. **Integracja z arXiv (Publikacje Naukowe):**
   - Aplikacja potrafi wyszukiwać artykuły naukowe na portalu arXiv, w których wspomniana jest dana egzoplaneta.
   - Publikacje są zapisywane w bazie danych, a ich abstrakty służą jako baza wiedzy (kontekst) dla lokalnej sztucznej inteligencji.

3. **Lokalna Sztuczna Inteligencja (Ollama):**
   - System nie polega na zewnętrznych, płatnych API (takich jak OpenAI). Zamiast tego wykorzystuje lokalnie uruchamiany silnik **Ollama** z modelami językowymi (np. `llama3.2:3b` do generacji tekstu oraz `nomic-embed-text` do tworzenia wektorów).
   - Modele AI generują podsumowania właściwości fizycznych planety, oceniają jej potencjalną habitabilność (zdatność do zamieszkania) oraz pozwalają na prowadzenie czatu z użytkownikiem (odpowiadanie na pytania na bazie przypisanych publikacji naukowych).

4. **Wyszukiwanie Wektorowe (Semantic Search):**
   - Dzięki bazie RavenDB abstrakty publikacji są wektoryzowane. Umożliwia to semantyczne wyszukiwanie informacji – użytkownik zadaje pytanie, a system znajduje najbardziej pasujące fragmenty tekstu, na podstawie których AI formułuje odpowiedź.

5. **Wizualizacja 3D:**
   - W interfejsie użytkownika zaimplementowano interaktywny, trójwymiarowy model planety i jej gwiazdy macierzystej (przy użyciu biblioteki Three.js / React Three Fiber).

6. **Tłumaczenia w locie (LibreTranslate):**
   - Treści pobierane z anglojęzycznych źródeł (NASA, arXiv, jak i odpowiedzi AI) są na bieżąco tłumaczone na język polski przy użyciu zintegrowanego, lokalnego silnika **LibreTranslate**.

## Grupa Docelowa
Aplikacja jest skierowana do entuzjastów astronomii, studentów, badaczy oraz osób po prostu ciekawych kosmosu, które poszukują zagregowanych i łatwo przyswajalnych informacji na temat nowo odkrytych światów.
