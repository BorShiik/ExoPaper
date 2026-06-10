import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

const TRANSLATE_URL = "/api/translate";

/**
 * Hook that translates a text string via LibreTranslate when the current locale
 * differs from the source language. Returns the original text while translating
 * and a loading flag.
 *
 * Translations are cached in-memory per session to avoid redundant network calls.
 */
const cache = new Map<string, string>();

function cacheKey(text: string, target: string): string {
  return `${target}::${text}`;
}

export function useTranslate(
  text: string | undefined | null,
  sourceLocale = "en"
): { translated: string; isTranslating: boolean } {
  const { locale } = useLanguage();
  const [translated, setTranslated] = useState(text ?? "");
  const [isTranslating, setIsTranslating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // No translation needed — same locale or empty text.
    if (!text || locale === sourceLocale) {
      setTranslated(text ?? "");
      setIsTranslating(false);
      return;
    }

    const key = cacheKey(text, locale);
    const cached = cache.get(key);
    if (cached) {
      setTranslated(cached);
      setIsTranslating(false);
      return;
    }

    // Abort any previous in-flight request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsTranslating(true);

    fetch(TRANSLATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLocale,
        target: locale,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        const result = data.translatedText ?? text;
        cache.set(key, result);
        setTranslated(result);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("[useTranslate] Translation failed, using original:", err);
          setTranslated(text);
        }
      })
      .finally(() => setIsTranslating(false));

    return () => controller.abort();
  }, [text, locale, sourceLocale]);

  return { translated, isTranslating };
}

/**
 * Batch-translate multiple strings at once. Returns an array of translated strings
 * in the same order, plus a loading flag.
 */
export function useTranslateBatch(
  texts: (string | undefined | null)[],
  sourceLocale = "en"
): { translations: string[]; isTranslating: boolean } {
  const { locale } = useLanguage();
  const [translations, setTranslations] = useState<string[]>(
    texts.map((t) => t ?? "")
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cleaned = texts.map((t) => t ?? "");

    if (locale === sourceLocale) {
      setTranslations(cleaned);
      setIsTranslating(false);
      return;
    }

    // Check which need translation (not cached).
    const needTranslation: { index: number; text: string }[] = [];
    const results = [...cleaned];

    for (let i = 0; i < cleaned.length; i++) {
      if (!cleaned[i]) continue;
      const key = cacheKey(cleaned[i], locale);
      const cached = cache.get(key);
      if (cached) {
        results[i] = cached;
      } else {
        needTranslation.push({ index: i, text: cleaned[i] });
      }
    }

    if (needTranslation.length === 0) {
      setTranslations(results);
      setIsTranslating(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsTranslating(true);

    // Translate all uncached strings in parallel.
    Promise.all(
      needTranslation.map(({ text }) =>
        fetch(TRANSLATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text, source: sourceLocale, target: locale }),
          signal: controller.signal,
        })
          .then((r) => r.json())
          .then((d) => d.translatedText ?? text)
          .catch(() => text)
      )
    )
      .then((translated) => {
        for (let i = 0; i < needTranslation.length; i++) {
          const { index, text } = needTranslation[i];
          results[index] = translated[i];
          cache.set(cacheKey(text, locale), translated[i]);
        }
        setTranslations([...results]);
      })
      .finally(() => setIsTranslating(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts.join("||"), locale, sourceLocale]);

  return { translations, isTranslating };
}
