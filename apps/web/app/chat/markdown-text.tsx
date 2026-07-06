"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Homa's replies as markdown inside a chat bubble: lists, bold,
 * links, and inline code, styled with design-system tokens and sized to
 * live inside a message bubble (headings render as emphasized lines, not
 * page-scale display type).
 */
export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-strong">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand underline underline-offset-2"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="ml-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-5 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <p className="font-display text-base font-semibold text-strong">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="font-display text-base font-semibold text-strong">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="font-semibold text-strong">{children}</p>
          ),
          code: ({ children }) => (
            <code className="rounded bg-page px-1.5 py-0.5 font-mono text-[0.9em]">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-sage pl-3 text-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border-subtle" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
