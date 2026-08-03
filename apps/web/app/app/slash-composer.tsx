"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { KidAvatar } from "../../components/dashboard/kid-avatar";
import { Icon } from "../../components/design/Icon";
import { setViewContextAction } from "./view-context-actions";

/**
 * The composer's "/" mention layer (founder ask 2026-07-10 evening):
 * typing "/" opens a menu of the kids and the family's available skills;
 * picking one inserts a token ("/Story", "/letter-sounds-games") that
 * renders link-colored inline, Cowork-style. The message SENDS as plain
 * text, token included; the agent's instructions teach the convention,
 * and picking a kid also flips the app's selected kid (same cookie as
 * the switcher) so chat focus, the chip, and the mention always agree.
 *
 * The inline highlight uses the classic mirror trick: the real input's
 * text paints transparent (caret stays visible) over an aria-hidden
 * mirror that renders the same string with tokens colored. Color is the
 * ONLY difference, weight would change glyph widths and drift the caret.
 * Single-kid families still get skill mentions, but a kid pick skips the
 * context write: the switcher is hidden for them, so a context chip
 * would appear with no way to clear it.
 */

export interface SlashKid {
  id: string;
  name: string;
  /** The kid's profile photo (migration #75); null keeps the initial. */
  avatarUrl: string | null;
}

export interface SlashSkill {
  name: string;
  description: string;
}

interface MenuItem {
  key: string;
  group: "kids" | "skills";
  token: string;
  label: string;
  sub?: string;
  kidId?: string;
  kidIndex?: number;
  kidAvatarUrl?: string | null;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Skill names are lowercase-hyphen by schema ("materials-studio"),
 * which reads like leaked code to a parent (reader gate 2026-07-10).
 * The row shows a plain sentence-case label; the inserted token keeps
 * the real name, which is what the agent's load_skill matches. */
function skillLabel(name: string): string {
  const words = name.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The "/query" the caret currently sits at the end of, if any. */
function activeSlashQuery(
  draft: string,
  caret: number,
): { start: number; query: string } | null {
  const before = draft.slice(0, caret);
  const match = /(^|\s)\/([a-zA-Z0-9][a-zA-Z0-9 -]{0,39}|)$/.exec(before);
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
}

export function SlashComposer({
  kids,
  skills,
  draft,
  onDraftChange,
  placeholder,
}: {
  kids: SlashKid[];
  skills: SlashSkill[];
  draft: string;
  onDraftChange: (next: string) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const allItems = useMemo<MenuItem[]>(
    () => [
      ...kids.map((kid, index) => ({
        key: `kid-${kid.id}`,
        group: "kids" as const,
        token: `/${kid.name}`,
        label: kid.name,
        kidId: kid.id,
        kidIndex: index,
        kidAvatarUrl: kid.avatarUrl,
      })),
      ...skills.map((skill) => ({
        key: `skill-${skill.name}`,
        group: "skills" as const,
        token: `/${skill.name}`,
        label: skillLabel(skill.name),
        sub: skill.description,
      })),
    ],
    [kids, skills],
  );

  // Tokens matched longest-first so "/Mary Jane" wins over "/Mary".
  const tokenRegex = useMemo(() => {
    if (allItems.length === 0) return null;
    const names = allItems
      .map((item) => escapeRegex(item.token))
      .sort((a, b) => b.length - a.length)
      .join("|");
    return new RegExp(`(${names})`, "g");
  }, [allItems]);

  const slash = activeSlashQuery(draft, caret);
  const query = slash?.query.toLowerCase() ?? "";
  // Match the plain label ("Materials studio") and the raw token
  // ("/materials-studio") both, so typing either form finds the row.
  const matches = slash
    ? allItems.filter((item) =>
        `${item.label} ${item.token}`.toLowerCase().includes(query),
      )
    : [];
  const menuOpen = slash !== null && matches.length > 0 && dismissedFor !== slash.start;
  const active = matches[Math.min(activeIndex, matches.length - 1)];

  function syncCaret() {
    setCaret(inputRef.current?.selectionStart ?? 0);
  }

  function pick(item: MenuItem) {
    if (!slash) return;
    const after = draft.slice(caret);
    const next = `${draft.slice(0, slash.start)}${item.token} ${after}`;
    onDraftChange(next);
    const newCaret = slash.start + item.token.length + 1;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCaret, newCaret);
      setCaret(newCaret);
    });
    // A kid mention IS a context pick (one mental model with the
    // switcher), except for single-kid families, where the hidden
    // switcher could never clear it again.
    if (item.kidId && kids.length > 1) {
      const kidId = item.kidId;
      startTransition(async () => {
        await setViewContextAction(kidId);
      });
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!menuOpen) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + delta + matches.length) % matches.length);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (active) pick(active);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedFor(slash?.start ?? null);
    }
  }

  const kidMatches = matches.filter((item) => item.group === "kids");
  const skillMatches = matches.filter((item) => item.group === "skills");

  function menuRow(item: MenuItem) {
    const isActive = active?.key === item.key;
    return (
      <button
        key={item.key}
        type="button"
        role="menuitem"
        data-slash-item=""
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => pick(item)}
        onMouseEnter={() => setActiveIndex(matches.indexOf(item))}
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm transition-colors duration-(--dur-fast) ease-out ${
          isActive ? "bg-page" : ""
        }`}
      >
        {item.group === "kids" ? (
          <KidAvatar
            name={item.label}
            index={item.kidIndex ?? 0}
            avatarUrl={item.kidAvatarUrl ?? null}
            size={26}
          />
        ) : (
          <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-page text-subtle">
            <Icon name="command" size={16} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-body">{item.label}</span>
          {item.sub ? (
            <span className="block truncate text-[0.72rem] text-subtle">{item.sub}</span>
          ) : null}
        </span>
      </button>
    );
  }

  // The mirror renders the draft with tokens link-colored; everything
  // else keeps the input's own metrics so the caret never drifts.
  const segments =
    tokenRegex === null ? [draft] : draft.split(tokenRegex).filter((part) => part !== "");

  return (
    <div className="relative min-w-0 flex-1">
      {menuOpen ? (
        <div
          role="menu"
          aria-label="Mention a kid or a skill"
          id="slash-composer-menu"
          className="absolute bottom-full left-0 z-50 mb-3 max-h-80 w-72 origin-bottom-left overflow-y-auto rounded-md border border-border-subtle bg-card p-1.5 shadow-lg transition-[opacity,translate,scale] duration-(--dur-base) ease-out starting:translate-y-1 starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none"
        >
          {kidMatches.length > 0 ? (
            <div role="group" aria-label="Kids">
              <p
                role="presentation"
                className="px-2.5 pb-1 pt-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-subtle"
              >
                Kids
              </p>
              {kidMatches.map(menuRow)}
            </div>
          ) : null}
          {kidMatches.length > 0 && skillMatches.length > 0 ? (
            <div role="separator" className="mx-2 my-1 h-px bg-border-subtle" />
          ) : null}
          {skillMatches.length > 0 ? (
            // "Homa's skills", not "Skills": under the kids' names, a
            // bare "skills" read as the KIDS' skills, a report-card
            // flinch the reader gate caught (2026-07-10).
            <div role="group" aria-label="Homa's skills">
              <p
                role="presentation"
                className="px-2.5 pb-1 pt-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-subtle"
              >
                Homa&apos;s skills
              </p>
              {skillMatches.map(menuRow)}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        ref={mirrorRef}
        aria-hidden="true"
        data-slash-mirror=""
        className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-base text-strong"
      >
        {segments.map((part, index) =>
          tokenRegex && allItems.some((item) => item.token === part) ? (
            <span key={index} className="text-brand">
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          ),
        )}
      </div>

      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => {
          onDraftChange(event.target.value);
          setDismissedFor(null);
          setActiveIndex(0);
          requestAnimationFrame(syncCaret);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        onScroll={() => {
          if (mirrorRef.current && inputRef.current) {
            mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
          }
        }}
        placeholder={placeholder}
        className="relative min-h-10 w-full bg-transparent text-base text-transparent outline-none placeholder:text-subtle"
        style={{ caretColor: "var(--text-strong)" }}
      />
    </div>
  );
}
