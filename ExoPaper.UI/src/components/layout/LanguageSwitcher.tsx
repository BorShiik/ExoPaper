import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import { LOCALES } from "../../i18n/translations";
import { cn } from "../../lib/utils";

/** Compact EN/PL language selector with an accessible dropdown. */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent-blue/40 hover:bg-space-700/60 transition-all focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{current.flag}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-xl border border-border bg-space-800/95 backdrop-blur-md shadow-xl shadow-black/40 animate-fade-in-up"
        >
          {LOCALES.map((l) => (
            <li key={l.code}>
              <button
                role="option"
                aria-selected={l.code === locale}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-xs font-medium transition-colors",
                  l.code === locale
                    ? "bg-accent-blue/15 text-accent-blue"
                    : "text-text-secondary hover:bg-space-700 hover:text-text-primary"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider opacity-70">
                    {l.flag}
                  </span>
                  {l.label}
                </span>
                {l.code === locale && <Check className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
