"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { enforceCopyLaws } from "../../lib/copy-laws-runtime";

/**
 * Renders Homa's replies as markdown inside a chat bubble: lists, bold,
 * links, and inline code, styled with design-system tokens and sized to
 * live inside a message bubble (headings render as emphasized lines, not
 * page-scale display type).
 *
 * The em-dash law is enforced here rather than only asked for in the
 * prompt. Every other generated surface already has a deterministic
 * check behind that ask; chat had only the ask, and it leaked (2 of 208
 * family-visible assistant messages in prod on 2026-07-21, and the first
 * turn of the first chat-onboarding walk). Doing it at render covers
 * live text and scrollback in one place and cannot break streaming,
 * because the function is pure and idempotent.
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
        {enforceCopyLaws(text)}
      </ReactMarkdown>
    </div>
  );
}
