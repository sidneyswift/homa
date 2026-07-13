import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getMapSubject } from "@homa/core";

import { Logo } from "../../../../../components/brand/Logo";
import { ProgressView } from "../../../../../components/progress/progress-view";
import { getFamilyThread } from "../../../../../lib/admin/chats-data";
import {
  getFamilyProgressDeep,
  getFamilyTasks,
} from "../../../../../lib/admin/family-deep-data";
import { requireFounder } from "../../../../../lib/admin/gate";
import { getFamilyScreenData } from "../../../../../lib/admin/screen-data";
import { currentWeekIndex } from "../../../../../lib/dashboard";
import { scopedToViewContext } from "../../../../../lib/materials/binder";
import type { ViewContext } from "../../../../../lib/view-context";
import { BinderView } from "../../../../app/binder/binder-view";
import { TaskHistory } from "../../../../app/tasks/task-history";
import type { TaskRunView } from "../../../../app/tasks/tasks-view";
import { ChatThread } from "../../../chats/thread";
import { EmptyNote } from "../../../ui";
import { isUuid } from "../family-shell";
import { ScreenTaskCards, XrayCard } from "./screen-pieces";

/**
 * Her screen (deep view direction 3): the parent app rendered for one
 * family, founder-gated and read-only by construction. Where the app's
 * own components are pure props-in renders (Progress, Binder, task
 * history) the mirror mounts the REAL component over admin-fetched
 * rows, so what the founder sees cannot drift from what she sees.
 * Session-bound surfaces (the live chat client, plan check-offs, task
 * editors) render as read-only equivalents instead: this page wires no
 * actions and imports no server actions. X-ray pins the machine truth
 * (tables, sessions, costs) onto the same pixels.
 */

export const metadata: Metadata = { title: "Her screen" };

const SCREEN_TABS = [
  { id: "chat", label: "Chat" },
  { id: "progress", label: "Progress" },
  { id: "planner", label: "Planner" },
  { id: "binder", label: "Binder" },
  { id: "tasks", label: "Tasks" },
] as const;
type ScreenTab = (typeof SCREEN_TABS)[number]["id"];

export default async function AdminFamilyScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ tab?: string; childId?: string; xray?: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!isUuid(familyId)) notFound();
  const query = await searchParams;
  const tab: ScreenTab = (SCREEN_TABS.some((entry) => entry.id === query.tab)
    ? query.tab
    : "chat") as ScreenTab;
  const xray = query.xray === "1";

  const data = await getFamilyScreenData(familyId);
  if (!data) notFound();
  const now = new Date();

  const focusChild =
    data.children.find((child) => child.id === query.childId) ??
    (tab === "progress" ? data.children[0] ?? null : null);
  const viewContext: ViewContext = focusChild
    ? { kind: "child", childId: focusChild.id }
    : { kind: "family" };

  const href = (next: { tab?: ScreenTab; childId?: string | null; xray?: boolean }) => {
    const search = new URLSearchParams();
    search.set("tab", next.tab ?? tab);
    const child = next.childId === undefined ? focusChild?.id ?? null : next.childId;
    if (child) search.set("childId", child);
    if (next.xray ?? xray) search.set("xray", "1");
    return `/admin/families/${familyId}/screen?${search.toString()}`;
  };

  return (
    <div>
      <Link
        href={`/admin/families/${familyId}`}
        className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
      >
        Back to the family file
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-[var(--radius-lg)] bg-[var(--pop-navy)] px-4 py-2.5 text-sm text-white">
        <p>
          Viewing as <b>{data.family.parentName ?? data.family.name}</b> · read-only · nothing
          here reaches the family
        </p>
        <Link
          href={href({ xray: !xray })}
          className={
            xray
              ? "ml-auto inline-flex min-h-9 items-center rounded-pill bg-[var(--gold-300)] px-3.5 py-1 font-mono text-xs font-bold text-[var(--gold-ink-strong)]"
              : "ml-auto inline-flex min-h-9 items-center rounded-pill border border-white/40 px-3.5 py-1 font-mono text-xs font-bold text-white hover:border-white"
          }
        >
          X-ray: {xray ? "on" : "off"}
        </Link>
      </div>

      <div className="flex flex-col overflow-hidden rounded-b-[var(--radius-lg)] border border-t-0 border-border-default bg-page shadow-[var(--shadow-md)] lg:flex-row">
        <aside className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-subtle bg-card p-2.5 lg:w-[184px] lg:flex-col lg:border-b-0 lg:border-r lg:p-3.5">
          <span className="hidden px-2 pb-2 lg:block">
            <Logo size={22} />
          </span>
          {SCREEN_TABS.map((entry) => (
            <Link
              key={entry.id}
              href={href({ tab: entry.id })}
              aria-current={tab === entry.id ? "page" : undefined}
              className={
                tab === entry.id
                  ? "flex min-h-10 items-center whitespace-nowrap rounded-md bg-brand-soft px-3 py-2 text-[0.9rem] font-bold text-[var(--clay-700)]"
                  : "flex min-h-10 items-center whitespace-nowrap rounded-md px-3 py-2 text-[0.9rem] font-medium text-muted hover:bg-page hover:text-body"
              }
            >
              {entry.label}
            </Link>
          ))}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-6">
          {data.children.length > 1 && (tab === "progress" || tab === "binder" || tab === "planner") ? (
            <nav aria-label="Mirror kid scope" className="mb-4 flex flex-wrap gap-1.5">
              <Link
                href={href({ childId: null })}
                className={
                  !focusChild
                    ? "inline-flex min-h-9 items-center rounded-pill bg-brand-soft px-3 py-1 text-sm font-bold text-[var(--clay-700)]"
                    : "inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3 py-1 text-sm text-muted hover:text-body"
                }
              >
                Whole family
              </Link>
              {data.children.map((child) => (
                <Link
                  key={child.id}
                  href={href({ childId: child.id })}
                  className={
                    focusChild?.id === child.id
                      ? "inline-flex min-h-9 items-center rounded-pill bg-brand-soft px-3 py-1 text-sm font-bold text-[var(--clay-700)]"
                      : "inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3 py-1 text-sm text-muted hover:text-body"
                  }
                >
                  {child.name}
                </Link>
              ))}
            </nav>
          ) : null}

          {tab === "chat" ? <ChatTab familyId={familyId} timeZone={data.family.timeZone} xray={xray} /> : null}
          {tab === "progress" ? (
            <ProgressTab familyId={familyId} data={data} childId={focusChild?.id ?? null} xray={xray} />
          ) : null}
          {tab === "planner" ? (
            <PlannerTab data={data} childId={focusChild?.id ?? null} xray={xray} now={now} />
          ) : null}
          {tab === "binder" ? (
            <BinderTab
              data={data}
              viewContext={viewContext}
              scopeChildName={focusChild?.name ?? null}
              xray={xray}
              now={now}
            />
          ) : null}
          {tab === "tasks" ? <TasksTab familyId={familyId} timeZone={data.family.timeZone} xray={xray} /> : null}
        </main>
      </div>
    </div>
  );
}

async function ChatTab({
  familyId,
  timeZone,
  xray,
}: {
  familyId: string;
  timeZone: string;
  xray: boolean;
}) {
  const messages = await getFamilyThread(familyId, {
    limit: 120,
    familyVisible: true,
  });
  const sessionCount = new Set(messages.map((message) => message.sessionId)).size;
  return (
    <div className="mx-auto max-w-[780px]">
      <ChatThread messages={messages} timeZone={timeZone} xray={xray} />
      {xray ? (
        <XrayCard title="What she never sees">
          <p>
            {messages.length} visible messages across {sessionCount} sessions from{" "}
            <code>conversation_messages</code> (visibility=family; the internal dispatch prompts
            show in the family file&apos;s Chats tab).{" "}
            <Link href={`/admin/sessions?family=${familyId}`} className="underline">
              All this family&apos;s sessions
            </Link>
            .
          </p>
        </XrayCard>
      ) : null}
    </div>
  );
}

async function ProgressTab({
  familyId,
  data,
  childId,
  xray,
}: {
  familyId: string;
  data: NonNullable<Awaited<ReturnType<typeof getFamilyScreenData>>>;
  childId: string | null;
  xray: boolean;
}) {
  const kid = data.children.find((child) => child.id === childId) ?? data.children[0];
  if (!kid) return <EmptyNote>No kids added yet.</EmptyNote>;
  const deep = await getFamilyProgressDeep(familyId);
  const kidDeep = deep.find((entry) => entry.childId === kid.id);
  const report = data.reports.get(kid.id) ?? null;

  if (!kidDeep?.view || kidDeep.view.subjects.length === 0) {
    return (
      <EmptyNote>
        {kid.name}&apos;s live progress is empty so far; her page shows a warm start-here note
        instead of this placeholder.
      </EmptyNote>
    );
  }

  return (
    <div>
      <ProgressView
        view={{ ...kidDeep.view, conflicts: [] }}
        reportHref={report?.token ? `/onboarding/r/${report.token}` : null}
        report={report}
        eras={kidDeep.eras}
        plans={data.plans
          .filter((plan) => plan.childId === kid.id)
          .map((plan) => ({
            subjectId: plan.subjectId,
            done: plan.done,
            total: plan.total,
            retestAt: plan.retestAt,
          }))}
        kids={[{ id: kid.id, name: kid.name, avatarUrl: kid.avatar_url }]}
      />
      {xray ? (
        <XrayCard title="Where this page comes from">
          <p>
            Tiles: <code>child_progress_live</code> projected {kidDeep.view.projectedAt.slice(0, 16)}
            {" · "}chart: <code>child_reports.history</code> re-normalized over{" "}
            <code>child_progress_evidence</code> ({kidDeep.eras.length} eras)
            {" · "}open-conflict actions are hidden in this mirror (read-only).
          </p>
        </XrayCard>
      ) : null}
    </div>
  );
}

function PlannerTab({
  data,
  childId,
  xray,
  now,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getFamilyScreenData>>>;
  childId: string | null;
  xray: boolean;
  now: Date;
}) {
  const plans = data.plans.filter((plan) => (childId ? plan.childId === childId : true));
  const nameById = new Map(data.children.map((child) => [child.id, child.name]));
  if (plans.length === 0) {
    return <EmptyNote>No four-week plans on this scope yet.</EmptyNote>;
  }
  return (
    <div className="mx-auto max-w-[900px]">
      <h2 className="font-display text-xl font-semibold text-strong">This week</h2>
      <p className="mt-1 text-sm text-muted">
        Read-only mirror of the week board; check-offs live on the family&apos;s own page.
      </p>
      <div className="mt-4 grid gap-3">
        {plans.map((plan) => {
          const weekIndex = currentWeekIndex(plan, now.getTime());
          const week = plan.weeks[weekIndex];
          const subjectName = getMapSubject(plan.subjectId)?.displayName ?? plan.subjectId;
          return (
            <div
              key={`${plan.childId}:${plan.subjectId}`}
              className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-display text-base font-bold text-strong">{subjectName}</p>
                <p className="text-sm text-muted">
                  {nameById.get(plan.childId) ?? "kid"} · week {weekIndex + 1} of{" "}
                  {plan.weeks.length} · {plan.done} of {plan.total} done overall
                </p>
              </div>
              {week ? (
                <>
                  <p className="mt-1.5 text-sm font-semibold text-body">{week.focus}</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {week.activities.map((activity, index) => {
                      const done = Boolean(plan.progress[`${week.week}.${index}`]);
                      return (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span
                            aria-hidden="true"
                            className={
                              done
                                ? "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--sage-500)] text-[0.6rem] font-bold text-white"
                                : "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border border-border-default bg-card"
                            }
                          >
                            {done ? "\u2713" : ""}
                          </span>
                          <span className={done ? "text-muted line-through" : "text-body"}>
                            {activity}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {xray ? (
        <XrayCard title="Where this board comes from">
          <p>
            <code>child_plans</code> rows ({plans.length} on this scope), week picked by{" "}
            <code>currentWeekIndex</code> from each plan&apos;s retest clock; check states are the
            server-synced <code>progress</code> map, the same rows her page reads.
          </p>
        </XrayCard>
      ) : null}
    </div>
  );
}

function BinderTab({
  data,
  viewContext,
  scopeChildName,
  xray,
  now,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getFamilyScreenData>>>;
  viewContext: ViewContext;
  scopeChildName: string | null;
  xray: boolean;
  now: Date;
}) {
  const scoped = scopedToViewContext(data.binder, viewContext);
  return (
    <div className="mx-auto max-w-[1040px]">
      <BinderView
        materials={scoped}
        scopeChildName={scopeChildName}
        timeZone={data.family.timeZone}
        now={now}
      />
      {xray ? (
        <XrayCard title="Where these come from">
          <p>
            {scoped.length} final rows from <code>materials</code> (Blob previews and
            PDFs); generation provenance per item lives on the family file&apos;s{" "}
            <Link href={`/admin/families/${data.family.id}/materials`} className="underline">
              Materials tab
            </Link>
            .
          </p>
        </XrayCard>
      ) : null}
    </div>
  );
}

async function TasksTab({
  familyId,
  timeZone,
  xray,
}: {
  familyId: string;
  timeZone: string;
  xray: boolean;
}) {
  const { schedules, runs } = await getFamilyTasks(familyId);
  const historyRuns: TaskRunView[] = runs
    .filter((run) => run.kind !== "fleet_research")
    .map((run) => ({
      id: run.id,
      kind: run.kind as TaskRunView["kind"],
      status: run.status as TaskRunView["status"],
      title: run.title,
      summary: run.summary,
      deliveredChannel: (run.deliveredChannel as TaskRunView["deliveredChannel"]) ?? null,
      startedAt: run.startedAt,
    }));
  return (
    <div className="mx-auto max-w-[820px]">
      <h2 className="font-display text-xl font-semibold text-strong">Homa&apos;s tasks</h2>
      <ScreenTaskCards schedules={schedules} timeZone={timeZone} />
      <div className="mt-6">
        <TaskHistory runs={historyRuns} timeZone={timeZone} />
      </div>
      {xray ? (
        <XrayCard title="Where this page comes from">
          <p>
            {schedules.length} <code>agent_schedules</code> rows (prompts readable on the family
            file&apos;s{" "}
            <Link href={`/admin/families/${familyId}/tasks`} className="underline">
              Tasks tab
            </Link>
            ) and {historyRuns.length} <code>homa_task_runs</code> rows; the on/off switches and
            editor are disabled in this mirror.
          </p>
        </XrayCard>
      ) : null}
    </div>
  );
}
