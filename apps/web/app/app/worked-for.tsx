"use client";

import type { EveMessage } from "eve/react";
import { useState } from "react";

import { Icon } from "../../components/design/Icon";
import type { SemanticIconName } from "../../components/design/Icon";

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
  icon: SemanticIconName;
  label: string;
  /** One short finding line, when the tool's output carries one. */
  detail: string | null;
}

const STEP_REGISTRY: Record<string, { icon: SemanticIconName; label: string }> = {
  get_children: { icon: "people", label: "Checked your family's info" },
  create_printable: { icon: "document", label: "Made the page" },
  create_worksheet: { icon: "document", label: "Made the page" },
  show_material: { icon: "document", label: "Brought the page back" },
  generate_image: { icon: "image", label: "Made an image" },
  find_materials: { icon: "search", label: "Looked through your materials" },
  mark_material_final: { icon: "check", label: "Kept the final version" },
  remember: { icon: "edit", label: "Noted that" },
  forget: { icon: "erase", label: "Removed a note" },
  update_child_profile: { icon: "person", label: "Updated the profile" },
  save_skill: { icon: "bookmark_add", label: "Saved that as a skill" },
  forget_skill: { icon: "bookmark_remove", label: "Removed a skill" },
  load_skill: { icon: "book", label: "Checked your saved instructions" },
  save_knowledge: { icon: "book", label: "Saved research notes" },
  manage_child_progress: { icon: "tasks", label: "Updated progress" },
  recall: { icon: "history", label: "Searched my notes" },
  read_family_curriculum: { icon: "book", label: "Read the curriculum" },
  preview_curriculum_mapping: { icon: "tasks", label: "Built your review" },
  approve_curriculum_mapping: { icon: "check", label: "Saved what you approved" },
  log_hours: { icon: "time", label: "Logged the hours" },
  create_task: { icon: "calendar", label: "Set that up as a task" },
  delete_task: { icon: "calendar", label: "Removed a task" },
  list_tasks: { icon: "calendar", label: "Checked your tasks" },
  add_child: { icon: "person", label: "Added them to your family" },
  save_family_basics: { icon: "edit", label: "Saved your family's basics" },
  save_homeschool_profile: { icon: "edit", label: "Saved how you homeschool" },
  start_checklist: { icon: "tasks", label: "Opened the questions" },
  ask_for_details: { icon: "edit", label: "Asked for a few details" },
  score_child_report: { icon: "spark", label: "Built the progress report" },
  start_first_making: { icon: "spark", label: "Started making a page" },
  send_skeptic_brief: { icon: "mail", label: "Sent the report to your inbox" },
};

const FALLBACK_STEP = { icon: "tools" as const, label: "Worked on it" };

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
  if (toolName === "start_first_making" && typeof record.title === "string") {
    return record.title;
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
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="quiet-worked-for__toggle inline-flex min-h-8 items-center gap-1.5 text-sm text-subtle transition-colors hover:text-muted"
      >
        {label}
        <Icon name={open ? "expand" : "collapse"} size={16} />
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-0.5">
          {steps.map((step, index) => {
            return (
              <div key={index} className="flex items-start gap-2.5 py-1">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--stone-100)] text-muted">
                  <Icon name={step.icon} size={16} />
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
