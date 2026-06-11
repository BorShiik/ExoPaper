# Dokumentacja Frontendu (React / Vite)

Interfejs użytkownika w ExoPaper to bardzo responsywna i bogata graficznie aplikacja jedostronicowa (SPA), rozwijana w katalogu `ExoPaper.UI`. Narzędziem budowania (bundlerem) jest **Vite**, który zapewnia niezwykle krótki czas kompilacji i szybkie odświeżanie modułów w trybie deweloperskim (HMR).

## Stack Technologiczny Frontendu

- **React 18** - rdzeń renderujący.
- **TypeScript** - dbanie o mocne typowanie danych przychodzących z backendu (w folderze `src/types` zdefiniowano odpowiedniki C#-owych obiektów DTO).
- **Zustand** - menadżer stanu (tzw. State Management). W przeciwieństwie do Reduxa jest lekki, zwięzły i nie generuje dużej ilości tzw. boilerplate code. Odpowiada za zachowanie pozycji przewijania (scroll), zachowanie parametrów filtrowania i sortowania na liście planet, aby po powrocie z detali planety na listę głównego katalogu stan był nietknięty.
- **Tailwind CSS** - framework stylujący (Utility-First). Całość stylów aplikacji napisana jest w plikach `.tsx` jako klasy (np. `bg-[#2E3440] hover:bg-white/10`).
- **React Three Fiber (R3F) & Drei** - Reactowy wrapper dla potężnej biblioteki 3D **Three.js**. Pozwala tworzyć interaktywną grafikę 3D bezpośrednio z komponentów JSX.

## Interaktywny Model Planety 3D

Podczas przeglądania szczegółów danej planety, duża część ekranu zajęta jest przez przestrzenną animację. 
Modele te nie są pre-renderowanymi plikami graficznymi – są w pełni proceduralne i generowane matematycznie na karcie graficznej urządzenia (WebGL).

* **Mechanika generacji:** Na bazie parametrów zwróconych z API dla konkretnej planety (Equilibrium Temperature, Promień/Masa, Typ Gwiazdy) komponent `VolumetricAtmosphere.tsx` i materiały przypisane do sfery w R3F dynamicznie miksują kolory tekstur.
* Planeta krążąca blisko swojej gwiazdy M-Dwarf o temperaturze ponad 1000K będzie pomalowana odcieniami pomarańczy i łamanej skorupy (tzw. "Lava World"), zaś egzoplaneta chłodna będzie miała gęstą atmosferę lub tekstury oceaniczne/lodowe. Zmienia się także odcień emitowanego przez gwiazdę na tło światła.

## Obsługa Wielojęzyczności i Tłumaczeń (i18n)

Ze względu na to, że większość publikacji astronomicznych oraz danych z NASA występuje wyłącznie w języku angielskim, cała apka i jej mechanizmy "oddychają" na żywo w języku docelowym (Polskim lub Angielskim).

W tym celu w `ExoPaper.UI` zastosowano autorski **hook `useTranslate`**:
- Tekst przychodzący asynchronicznie z REST API backendu jest przechwytywany i wysyłany (za kulisami) zapytaniem POST do endpointu `/api/translate`.
- Gdy nginx kieruje żądanie do kontenera `libretranslate`, ten zwraca spolszczoną wersję zdania.
- Hook przechowuje ten rezultat w **pamięci podręcznej sesji (cache)**, co optymalizuje ponowne wejścia na tę samą podstronę, uniemożliwiając obciążanie silnika tłumaczeń tymi samymi abstrakty.
- Istnieje także wersja `useTranslateBatch`, która zoptymalizowana jest do tłumaczenia kilkudziesięciu krótkich tytułów równocześnie, np. na liście powiązanych artykułów.

## Zabezpieczenia Nginx i Architektura Plików

Aplikacja kliencka jest pakowana i serwowana w kontenerze `exopaper_ui` w oparciu o obraz `nginx:alpine`.
- Budowanie komendą `npm run build` kompiluje JSX w statyczne pliki `html/css/js`.
- Zostają one skopiowane do ścieżki `/usr/share/nginx/html`.
- Skonfigurowany plik konfiguracyjny `nginx.conf` w tym kontenerze zajmuje się tzw. Routingiem SPA (każde niezidentyfikowane żądanie np. `/planet/Earth` przerzuca na plik `index.html`, gdzie React Router zajmuje się resztą).
- Nginx wystawia również na porcie 80 punkty końcowe `/api/`, dokonując weryfikacji i przekaźnictwa (Proxy Pass) z odpowiednimi timeoutami dla długotrwałych procesów, takich jak zapytania do LLM o odpowiedź.
