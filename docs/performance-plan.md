# План повышения Performance (Lighthouse 44 → цель 85+)

Маршрут теста: `http://localhost:3000/#/planets` (прод-сборка nginx, порт `3000:80`).

## 1. Диагноз — что именно тянет метрики вниз

| Метрика Lighthouse | Значение | Корневая причина в коде |
|---|---|---|
| Reduce unused JavaScript | **2 816 KiB** | `vendor-three` (three 0.184 + drei + fiber) грузится на `/planets`, хотя каталог — чистый CSS |
| Minimize main-thread work | **2.7 s** | Бесконечный `useFrame`-loop `CosmicHero` + spring-физика framer-motion на 24 карточках |
| Reduce JS execution time | **2.0 s** | Парс/компиляция three.js + инициализация сцены |
| Total Blocking Time | **970 ms** | Компиляция WebGL-шейдеров + long tasks при старте сцены |
| Use efficient cache lifetimes | **2 220 KiB** | nginx отдаёт `/assets/*` без `Cache-Control: immutable` |
| Forced reflow | — | `getBoundingClientRect()` в `handleMove` на каждом `mousemove` карточки (tilt) |
| Render-blocking requests | 80 ms | CSS-бандл без сжатия/preload |
| bfcache restoration | 1 failure | Постоянное WebSocket-соединение SignalR блокирует back/forward cache |
| FCP / LCP | 2.1 s / 3.0 s | LCP-элемент перекрыт тяжёлым стартом главного потока |

**Вывод:** ~80% проблемы — один декоративный 3D-фон на контентных маршрутах. Остальное — кэш-заголовки nginx и framer-motion.

---

## 2. Приоритет 1 — убрать живой WebGL-фон с `/planets` и `/papers`  ⭐ максимальный эффект

### Проблема
`Layout.tsx` монтирует `CosmicHero` на всех маршрутах, кроме `/planet/:id`:
```tsx
const showGlobalCanvas = !location.pathname.startsWith("/planet/");
```
То есть на `/planets` и `/papers` за каталогом работает полноценный `<Canvas>` с three.js,
`<Stars/>`, `PerformanceMonitor`, `StarMesh`, `PlanetMesh` и ленивым postprocessing — и всё это
поверх затемнено scrim'ом (`isContentRoute` → почти чёрный градиент). Платим полную цену WebGL за
фон, которого почти не видно.

### Решение (рекомендуемое — A): фон по типу маршрута
Живой космос оставить только там, где он — главный герой (Dashboard `/` и деталь планеты),
а на контентных маршрутах показать **дешёвый статический фон** (CSS/SVG-звёзды, 0 JS, 0 WebGL).

```tsx
// Layout.tsx
const isContentRoute =
  location.pathname.startsWith("/planets") || location.pathname.startsWith("/papers");

// Живой Canvas — только на лёгких по контенту маршрутах (Dashboard)
const showLiveCanvas = !location.pathname.startsWith("/planet/") && !isContentRoute;

return (
  <div className="relative min-h-screen bg-[#05070f] overflow-hidden">
    {showLiveCanvas && (
      <div className="fixed inset-0 z-0" onWheel={...}>
        <Suspense fallback={null}><CosmicHero /></Suspense>
      </div>
    )}

    {/* Статический космос для каталога/публикаций — без three.js */}
    {isContentRoute && <StaticCosmos />}
    ...
```

`StaticCosmos` — чистый CSS: пара radial-gradient + SVG-noise/звёзды как `background-image`
(можно переиспользовать существующий scrim-градиент + лёгкий слой точек). Никаких импортов из
`three`/`@react-three/*`, поэтому **`vendor-three` вообще не попадает в граф загрузки `/planets`**.

### Альтернативы
- **B (компромисс):** оставить `CosmicHero`, но на контентных маршрутах передавать проп
  `frameloop="demand"` + `dpr={0.5}` + остановить `useFrame` (рендер только при наведении/скролле).
  Убирает 970 ms TBT-loop, но three.js всё ещё грузится (~unused JS остаётся).
- **C:** рендерить `CosmicHero` один раз и **замораживать** при уходе с Dashboard
  (`gl.setAnimationLoop(null)`), пряча `<div>` через `visibility:hidden`. Сложнее, эффект как у B.

**Рекомендую A** — единственный вариант, который убирает и JS-вес, и main-thread loop сразу.

### Ожидаемый эффект A
TBT 970 → ~150 ms · main-thread 2.7 → ~0.9 s · JS exec 2.0 → ~0.6 s · unused JS −~1.8 MB.
Performance ≈ **44 → 70+** только за этот шаг.

---

## 3. Приоритет 2 — nginx: кэш + сжатие  (5 строк, нулевой риск)

Vite пишет хэш в имена файлов (`index-a1b2c3.js`), значит ассеты иммутабельны — их можно кэшировать
навсегда. Сейчас заголовков нет → повторный визит перекачивает 2 220 KiB.

```nginx
# nginx.conf — в server { ... }

# Сжатие (модуль gzip есть в nginx:alpine из коробки)
gzip on;
gzip_vary on;
gzip_comp_level 6;
gzip_min_length 1024;
gzip_types text/css application/javascript application/json image/svg+xml application/wasm;

location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
}

# Иммутабельные ассеты с хэшем — кэш на год
location /assets/ {
    root /usr/share/nginx/html;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# index.html никогда не кэшировать (иначе клиент не увидит новую сборку)
location = /index.html {
    root /usr/share/nginx/html;
    add_header Cache-Control "no-cache";
}
```

> Brotli даёт ещё ~15% сверху, но требует пересборки nginx с модулем — не в базовом образе.
> Альтернатива без кастомного образа: `vite-plugin-compression` (пред-сжать в build) + `gzip_static on`.

**Эффект:** −2 220 KiB на повторных визитах, частично снимает render-blocking 80 ms, меньше transfer-size.

---

## 4. Приоритет 3 — framer-motion на сетке из 24 карточек

`PlanetCard` на каждую карточку поднимает `useMotionValue ×2 + useSpring ×2 + useTransform`, а
`handleMove` дёргает `getBoundingClientRect()` на каждом `mousemove` → это и есть **Forced reflow**.

1. **Сжать бандл** — перейти на `LazyMotion` + `m`-компоненты (грузит только нужные фичи):
   ```tsx
   import { LazyMotion, domAnimation, m } from "framer-motion";
   // обернуть приложение: <LazyMotion features={domAnimation}> ... </LazyMotion>
   // заменить <motion.button> → <m.button>
   ```
   Экономит ~30–40 KiB и часть main-thread инициализации.
2. **Убрать forced reflow в tilt** — кэшировать `rect` на `mouseenter`, не читать в `mousemove`,
   и обновлять значения внутри `requestAnimationFrame`. Либо вовсе отключить per-card tilt на
   `/planets` (на 24 пружинных контроллерах он заметно грузит поток).
3. **Анимацию появления** карточек (`initial/animate` + `delay`) заменить CSS-анимацией
   (`@keyframes` + `animation-delay`) — entrance не требует JS-движка.

**Эффект:** меньше long tasks, уходит «Forced reflow», −~40 KiB JS.

---

## 5. Приоритет 4 — bfcache (1 failure reason)

Постоянное соединение SignalR (`useSignalR` живёт весь lifetime приложения) держит открытый
WebSocket → браузер не кладёт страницу в back/forward cache.

```ts
// useSignalR.ts
useEffect(() => {
  const onHide = () => connection.stop();          // освободить WS перед уходом
  const onShow = () => connection.start().catch(() => {});
  window.addEventListener("pagehide", onHide);
  window.addEventListener("pageshow", onShow);
  return () => { /* cleanup */ };
}, []);
```
Эффект на сам балл небольшой, но снимает флаг и ускоряет навигацию «назад».

---

## 6. Приоритет 5 — code-split тяжёлых библиотек по их маршрутам

`MarkdownText` (react-markdown + remark-math + **rehype-katex + katex CSS**) импортируется
**статически** в `DashboardPage` и `PapersPage`. katex — это ~23 KiB CSS + тяжёлый JS, который
попадает в чанк страницы, хотя нужен только когда реально показан markdown с формулами.

1. Сделать `MarkdownText` ленивым:
   ```tsx
   const MarkdownText = lazy(() => import("../ui/MarkdownText"));
   // оборачивать в <Suspense fallback={<span className="opacity-60">…</span>}>
   ```
   Тогда katex/markdown грузятся только при фактическом рендере summary/abstract.
2. Точнее нарезать вендоры в `vite.config.ts`:
   ```ts
   manualChunks(id) {
     if (id.includes('node_modules')) {
       if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';
       if (id.includes('katex') || id.includes('react-markdown') ||
           id.includes('remark') || id.includes('rehype') || id.includes('micromark'))
         return 'vendor-markdown';
       if (id.includes('framer-motion')) return 'vendor-motion';
       if (id.includes('react') || id.includes('zustand')) return 'vendor-react';
       return 'vendor';
     }
   }
   ```
   `vendor-markdown` и `vendor-three` теперь грузятся только на маршрутах, где реально нужны.

---

## 7. Приоритет 6 — мелкие, но дешёвые улучшения

- **Drop console/debugger в проде** — `esbuild: { drop: ['console','debugger'] }` в vite.config.
- **`build.target: 'es2020'`** (или выше) — меньше транспайл-полифиллов.
- **drei: импортировать узко** — уже из barrel `@react-three/drei`; убедиться, что tree-shaking
  не тянет лишнее (проверить по `rollup-plugin-visualizer`).
- **preconnect к API** — `<link rel="preconnect" href="http://localhost:5000">` в `index.html`
  (или dns-prefetch) — ускоряет первый запрос данных.
- **`frameloop="demand"`** для статичных сцен (деталь планеты, когда нет вращения).
- **StrictMode** даёт двойной рендер только в dev — на прод-балл не влияет, трогать не нужно.
- **Анализ бандла:** добавить `rollup-plugin-visualizer` и один раз посмотреть реальную карту —
  подтвердить, что после шага 2 на `/planets` не осталось three/katex.

---

## 8. Порядок внедрения и ожидаемый результат

| Шаг | Усилие | Риск | Δ Performance (накопительно) |
|---|---|---|---|
| 1. Статический фон на `/planets`,`/papers` | средне | низкий | 44 → ~72 |
| 2. nginx кэш + gzip | 5 мин | нулевой | → ~76 (и резко на повторных визитах) |
| 3. framer-motion (LazyMotion + RAF tilt) | средне | низкий | → ~80 |
| 5. lazy MarkdownText + нарезка вендоров | низко | низкий | → ~84 |
| 4. bfcache + 6. мелочи | низко | низкий | → ~86 + плавность навигации |

**Главный рычаг — шаг 1.** Шаги 2 и 5 почти бесплатны и безопасны. Шаги 3–4 — полировка.

После внедрения прогнать Lighthouse заново на `/planets`, `/papers` и `/` (Dashboard грузит
живой Canvas — там цель скромнее, ~70–80, и это нормально).
