import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Props {
  text: string;
  className?: string;
}

/**
 * The actual markdown + KaTeX renderer. Pulled into its own chunk via React.lazy in
 * MarkdownText so the heavy react-markdown / remark / rehype / KaTeX bundle (and its CSS)
 * only loads when markdown is genuinely rendered — never on the catalog route.
 */
export default function MarkdownRenderer({ text, className = "" }: Props) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-[#070b14]/70 prose-pre:border prose-pre:border-white/10 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
