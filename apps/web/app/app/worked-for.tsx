"use client";

import type { EveMessage } from "eve/react";
import {
  BookOpen,
  BookmarkMinus,
  BookmarkPlus,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eraser,
  FileText,
  History,
  Image as ImageIcon,
  ListChecks,
  PenLine,
  Search,
  Sparkles,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

/**
 * The worked-for line (approved chat redesign, D2 steal kept by founder
 * note): one quiet "Worked for N seconds" per reply that used tools,
 * closed by default, opening into the reasoning chain: each tool call
 * as a plain-words past-tense step with an icon, never a tool name,
 * never raw model thoughts. Steps come straight from the dynamic-tool
 * parts eve already streams; anything unmapped falls back to a generic
 * step so new tools ship without UI work.
 */

export interface WorkedForStep {
  icon: LucideIcon;
  label: string;
  /** One short finding line, when the tool's output carries one. */
  detail: string | null;
}

const STEP_REGISTRY: Record<string, { icon: LucideIcon; label: string }> = {
  get_children: { icon: Users, label: "Checked your family's info" },
  create_printable: { icon: FileText, label: "Made the page" },
  create_worksheet: { icon: FileText, label: "Made the page" },
  show_material: { icon: FileText, label: "Brought the page back" },
  generate_image: { icon: ImageIcon, label: "Made an image" },
  find_materials: { icon: Search, label: "Looked through your materials" },
  mark_material_final: { icon: Check, label: "Kept the final version" },
  remember: { icon: PenLine, label: "Noted that" },
  forget: { icon: Eraser, label: "Removed a note" },
  update_child_profile: { icon: UserRound, label: "Updated the profile" },
  save_skill: { icon: BookmarkPlus, label: "Saved that as a skill" },
  forget_skill: { icon: BookmarkMinus, label: "Removed a skill" },
  load_skill: { icon: BookOpen, label: "Checked your saved instructions" },
  save_knowledge: { icon: BookOpen, label: "Saved research notes" },
  manage_child_progress: { icon: ListChecks, label: "Updated progress" },
  recall: { icon: History, label: "Searched my notes" },
  log_hours: { icon: Clock, label: "Logged the hours" },
  create_task: { icon: CalendarClock, label: "Set that up as a task" },
  delete_task: { icon: CalendarClock, label: "Removed a task" },
  list_tasks: { icon: CalendarClock, label: "Checked your tasks" },
  add_child: { icon: UserRound, label: "Added them to your family" },
  save_family_basics: { icon: PenLine, label: "Saved your family's basics" },
  save_homeschool_profile: { icon: PenLine, label: "Saved how you homeschool" },
  start_checklist: { icon: ListChecks, label: "Opened the questions" },
  score_child_report: { icon: Sparkles, label: "Built the progress report" },
};

const FALLBACK_STEP = { icon: Wrench, label: "Worked on it" };

/** Findings worth a line under the step, per tool output shape. */
function stepDetail(toolName: string, output: unknown): string | null {
  const record = (output ?? {}) as Record<string, unknown>;
  if (
    toolName === "create_printable" ||
    toolName === "create_worksheet" ||
    toolName === "show_material"
  ) {
    const material = (record.material ?? record.worksheet ?? {}) as Record<string, unknown>;
    if (typeof material.title === "string") return material.title;
  }
  if (toolName === "load_skill" && typeof record.name === "string") return record.name;
  if (toolName === "add_child" && typeof record.childName === "string") return record.childName;
  if (toolName === "score_child_report" && typeof record.childName === "string") {
    return record.childName;
  }
  if (toolName === "recall" && typeof record.results === "number") {
    return record.results === 1 ? "Found 1 note" : `Found ${record.results} notes`;
  }
  return null;
}

/**
 * workedForSteps(message): the finished tool calls of one assistant
 * message as chain steps, in part order. Empty when the message used no
 * tools (no line renders).
 */
export function workedForSteps(message: EveMessage): WorkedForStep[] {
  const steps: WorkedForStep[] = [];
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
    const entry = STEP_REGISTRY[part.toolName] ?? FALLBACK_STEP;
    steps.push({
      icon: entry.icon,
      label: entry.label,
      detail: stepDetail(part.toolName, part.output),
    });
  }
  return steps;
}

export function WorkedForLine({
  steps,
  seconds,
}: {
  steps: readonly WorkedForStep[];
  seconds: number | null;
}) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  const label =
    seconds !== null && seconds > 0
      ? `Worked for ${seconds} ${seconds === 1 ? "second" : "seconds"}`
      : "Worked on it";
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-8 items-center gap-1.5 text-sm text-subtle transition-colors hover:text-muted"
      >
        {label}
        <Chevron size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-0.5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex items-start gap-2.5 py-1">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--stone-100)] text-muted">
                  <Icon size={13} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-body">
                    {step.label}
                  </span>
                  {step.detail ? (
                    <span className="block text-sm text-muted">{step.detail}</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
