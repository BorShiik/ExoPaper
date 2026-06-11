# Frontend Documentation (React / Vite)

The user interface in ExoPaper is a highly responsive and visually rich Single Page Application (SPA), developed within the `ExoPaper.UI` directory. The build tool (bundler) is **Vite**, which ensures incredibly short compilation times and fast Hot Module Replacement (HMR) during development.

## Frontend Technology Stack

- **React 18** - The core rendering engine.
- **TypeScript** - Ensures strong typing for data arriving from the backend (equivalent C# DTOs are defined in `src/types`).
- **Zustand** - State Manager. Unlike Redux, it is lightweight, concise, and does not generate a large amount of boilerplate code. It is responsible for preserving scroll position and maintaining filtering/sorting parameters on the planet list, so the state remains intact when returning from planet details back to the main catalog.
- **Tailwind CSS** - A Utility-First styling framework. All application styles are written inside `.tsx` files as classes (e.g., `bg-[#2E3440] hover:bg-white/10`).
- **React Three Fiber (R3F) & Drei** - A React wrapper for the powerful **Three.js** 3D library. It allows creating interactive 3D graphics directly from JSX components.

## Interactive 3D Planet Model

While viewing the details of a given planet, a large portion of the screen is occupied by a spatial animation.
These models are not pre-rendered graphic files – they are fully procedural and mathematically generated on the device's graphics card (WebGL).

* **Generation Mechanics:** Based on parameters returned from the API for a specific planet (Equilibrium Temperature, Radius/Mass, Star Type), the `VolumetricAtmosphere.tsx` component and materials assigned to the R3F sphere dynamically mix texture colors.
* A planet orbiting close to its M-Dwarf star with a temperature over 1000K will be painted in shades of orange and broken crust (a "Lava World"), whereas a cooler exoplanet will have a dense atmosphere or oceanic/ice textures. The hue of the light emitted by the star onto the background also changes accordingly.

## Multi-language Support and Translations (i18n)

Since the majority of astronomical publications and NASA data exist exclusively in English, the entire app and its mechanics "breathe" live in the target language (Polish or English).

For this purpose, a custom **`useTranslate` hook** is used in `ExoPaper.UI`:
- Text arriving asynchronously from the backend REST API is intercepted and sent (behind the scenes) via a POST request to the `/api/translate` endpoint.
- When Nginx routes the request to the `libretranslate` container, it returns the localized version of the sentence.
- The hook stores this result in the **session cache**, which optimizes subsequent visits to the same subpage, preventing the translation engine from being overloaded with identical abstracts.
- There is also a `useTranslateBatch` version, optimized for translating dozens of short titles simultaneously, e.g., on the related articles list.

## Nginx Security and File Architecture

The client application is bundled and served within the `exopaper_ui` container based on the `nginx:alpine` image.
- Building with the `npm run build` command compiles JSX into static `html/css/js` files.
- These are copied to the `/usr/share/nginx/html` path.
- The configured `nginx.conf` file in this container handles SPA Routing (any unidentified request, e.g., `/planet/Earth`, redirects to `index.html`, where React Router takes over).
- Nginx also exposes the `/api/` endpoints on port 80, verifying and forwarding (Proxy Pass) requests with appropriate timeouts for long-running processes, such as queries to the LLM.
