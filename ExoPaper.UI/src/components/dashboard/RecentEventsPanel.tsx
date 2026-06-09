import { useAppStore } from "../../stores/appStore";
import { Zap, Tag } from "lucide-react";
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
    <div className="flex flex-col h-full animate-fade-in">
      <div className="space-y-2 pr-1 h-full">
        {events.length === 0 && (
          <div className="font-mono text-[10px] sm:text-xs text-[#A3BE8C] opacity-80 leading-relaxed space-y-1.5 py-2">
            <p className="animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
              {">> [SYS] OutboxDispatcher listening to RavenDB Subscriptions..."}
            </p>
            <p className="animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
              {">> [DB] Connected to cluster nodes: exopaper_db_a, b, c"}
            </p>
            <p className="animate-fade-in" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
              {">> [AI] Ollama server attached (models: llama3:8b, nomic-embed-text)"}
            </p>
            <p className="animate-pulse text-[#88C0D0] mt-4 font-bold" style={{ animationDelay: "700ms", animationFillMode: "both" }}>
              {">> AWAITING TELEMETRY PAYLOAD..."}
            </p>
          </div>
        )}

        {events.map((evt) => {
          const cleanType = evt.eventType.replace("planet:", "");
          return (
            <div
              key={evt.id}
              className="flex items-start gap-2.5 rounded-lg px-3 py-2 bg-[#2E3440]/60 border border-[#434C5E]/30 animate-slide-in-right"
            >
              <div className="mt-0.5 shrink-0">
                {eventIcons[cleanType] || (
                  <Zap className="h-3.5 w-3.5 text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#ECEFF4] font-medium truncate">
                  {formatEventMessage(cleanType, evt.payload, t)}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5 font-mono">
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
