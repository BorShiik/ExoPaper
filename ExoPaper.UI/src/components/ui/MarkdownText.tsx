import { Suspense, lazy } from "react";

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

interface Props {
  text: string;
  className?: string;
}

/**
 * Lightweight wrapper that code-splits the heavy markdown/KaTeX renderer. While the chunk
 * loads (or if it's not needed yet) it shows the raw text as plain prose, so nothing flashes
 * empty. All call sites stay unchanged.
 */
export default function MarkdownText({ text, className = "" }: Props) {
  return (
    <Suspense
      fallback={
        <div className={`prose prose-invert prose-sm max-w-none whitespace-pre-wrap ${className}`}>
          {text}
        </div>
      }
    >
      <MarkdownRenderer text={text} className={className} />
    </Suspense>
  );
}
