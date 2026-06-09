import { useAppStore } from "../../stores/appStore";
import { Zap, Tag, Radio } from "lucide-react";
import { useT } from "../../i18n/LanguageContext";
import type { TranslationKey } from "../../i18n/translations";

const eventIcons: Record<string, React.ReactNode> = {
  PaperEmbedded: <Zap className="h-3.5 w-3.5 text-accent-cyan" />,
  ExoplanetTagged: <Tag className="h-3.5 w-3.5 text-accent-green" />,
};

function parsePayload(payload: string): Record<string, unknown> {
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function formatEventMessage(
  eventType: string,
  payload: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
): string {
  const data = parsePayload(payload);
  if (eventType === "PaperEmbedded") {
    return t("feed.paperEmbedded", {
      title: (data.Title as string) || (data.paperId as string) || "",
    });
  }
  if (eventType === "ExoplanetTagged") {
    const tags = (data.Tags as string[]) || [];
    return t("feed.exoplanetTagged", {
      planet: (data.PlanetId as string)?.split("/")[1] || "Planet",
      tags: tags.join(", "),
    });
  }
  return `${eventType}: ${payload.slice(0, 60)}`;
}

export default function RecentEventsPanel() {
  const t = useT();
  const events = useAppStore((s) => s.events);

  return (
    <div className="glass rounded-xl p-5 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="h-4 w-4 text-accent-blue animate-pulse-glow" />
        <h3 className="text-sm font-semibold text-text-primary">{t("feed.title")}</h3>
        <span className="ml-auto text-[10px] font-mono text-text-muted uppercase tracking-wider">
          {t("feed.realtime")}
        </span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        {events.length === 0 && (
          <p className="text-xs text-text-muted py-6 text-center">
            {t("feed.waiting")}
          </p>
        )}

        {events.map((evt) => {
          const cleanType = evt.eventType.replace("planet:", "");
          return (
            <div
              key={evt.id}
              className="flex items-start gap-2.5 rounded-lg px-3 py-2 bg-space-800/50 animate-slide-in-right"
            >
              <div className="mt-0.5 shrink-0">
                {eventIcons[cleanType] || (
                  <Zap className="h-3.5 w-3.5 text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-primary truncate">
                  {formatEventMessage(cleanType, evt.payload, t)}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {evt.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
