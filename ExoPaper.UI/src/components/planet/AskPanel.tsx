import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useT } from "../../i18n/LanguageContext";

interface AskSource {
  paperId: string;
  title: string;
}
interface AskChunk {
  type: string;
  content?: string;
  sources?: AskSource[];
}

interface Props {
  /** Optional planet id to ground the answer. */
  exoplanetId?: string;
}

/**
 * Conversational RAG panel. Streams the LLM answer token-by-token over SignalR
 * (server method "StreamAsk") and shows the source publications used for grounding.
 */
export default function AskPanel({ exoplanetId }: Props) {
  const t = useT();
  const connection = useAppStore((s) => s.connection);
  const isConnected = useAppStore((s) => s.isConnected);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => () => subRef.current?.dispose(), []);

  const ask = () => {
    if (!connection || !isConnected || streaming || !question.trim()) return;

    subRef.current?.dispose();
    setAnswer("");
    setSources([]);
    setError(null);
    setStreaming(true);

    subRef.current = connection
      .stream("StreamAsk", {
        question: question.trim(),
        exoplanetId: exoplanetId ?? null,
        take: 6,
      })
      .subscribe({
        next: (chunk: AskChunk) => {
          if (chunk?.type === "sources") setSources(chunk.sources ?? []);
          else if (chunk?.type === "token") setAnswer((a) => a + (chunk.content ?? ""));
        },
        complete: () => setStreaming(false),
        error: (e: unknown) => {
          console.error(e);
          setError(t("ask.error"));
          setStreaming(false);
        },
      });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <div className="glass rounded-xl p-5 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-accent-purple" />
        <h3 className="text-sm font-semibold text-text-primary">{t("ask.title")}</h3>
      </div>

      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("ask.placeholder")}
          disabled={streaming}
          className="flex-1 rounded-lg bg-space-900 border border-space-700/60 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-purple/50 focus:outline-none focus:ring-1 focus:ring-accent-purple/30 transition-all disabled:opacity-50"
        />
        <button
          onClick={ask}
          disabled={!isConnected || streaming || !question.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-xs font-semibold text-white hover:bg-accent-purple/80 transition-all disabled:opacity-40"
        >
          {streaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {t("ask.button")}
        </button>
      </div>

      {!isConnected && <p className="mt-2 text-[10px] text-text-muted">{t("ask.offline")}</p>}

      {error && (
        <div className="mt-3 rounded-lg bg-accent-red/10 border border-accent-red/20 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      {(answer || streaming) && (
        <div className="mt-3 rounded-lg bg-space-800/60 p-4">
          {streaming && !answer ? (
            <p className="text-[11px] text-text-muted">{t("ask.thinking")}</p>
          ) : (
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
              {answer}
              {streaming && (
                <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-accent-purple" />
              )}
            </p>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
            {t("ask.sources")}
          </p>
          <ol className="space-y-1">
            {sources.map((s, i) => (
              <li key={s.paperId} className="text-[11px] text-text-secondary leading-snug">
                <span className="text-accent-purple font-mono">[{i + 1}]</span> {s.title}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
