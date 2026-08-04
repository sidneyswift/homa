"use client";

import { useState } from "react";

import { ContextSwitcher } from "../../../components/dashboard/context-switcher";
import {
  ContextPanel,
  Icon,
  PageHeader,
  QuietAction,
  QuietFrame,
  QuietStatus,
  VoiceSafeSlot,
  WorkStage,
  Workspace,
} from "../../../components/design";
import type { SidebarKid } from "../../../components/dashboard/sidebar";

const FIXTURE_KIDS: SidebarKid[] = [
  { id: "fixture-maya", name: "Maya", ageMonths: 108, avatarUrl: null },
  { id: "fixture-eli", name: "Eli", ageMonths: 84, avatarUrl: null },
];

/**
 * A deterministic signed-in composition specimen. It uses the same
 * ContextSwitcher and composition atoms as /app, while the local selection
 * callback keeps this public, noindex fixture independent of auth state.
 */
export function AuthenticatedContextFixture() {
  const [selected, setSelected] = useState("family");
  const selectedName = selected === "family"
    ? "the whole family"
    : FIXTURE_KIDS.find((kid) => kid.id === selected)?.name ?? "the whole family";

  return (
    <section
      data-brand-fixture="quiet-authenticated-context-v1"
      className="quiet-fixture__authenticated"
      aria-labelledby="authenticated-context-title"
    >
      <div className="quiet-fixture__authenticated-toolbar">
        <div>
          <p className="quiet-fixture__eyebrow">Signed-in composition</p>
          <h2 id="authenticated-context-title">The work stays in view.</h2>
        </div>
        <ContextSwitcher
          kids={FIXTURE_KIDS}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <Workspace layout="stage-context" className="quiet-fixture__authenticated-workspace">
        <WorkStage labelledBy="authenticated-stage-title">
          <PageHeader
            heading="This week, with Maya"
            headingId="authenticated-stage-title"
            eyebrow="Your work"
            description="The stage holds the useful thing. Context stays close without taking over."
            actions={
              <QuietAction kind="secondary" icon={<Icon name="next" size={16} />}>
                Open plan
              </QuietAction>
            }
          />
          <QuietFrame as="article" tone="paper" className="quiet-fixture__authenticated-work">
            <p className="quiet-fixture__artifact-label">A useful next move</p>
            <h3>Make a pattern page with kitchen tools.</h3>
            <p>Homa keeps the child, the work, and the next small step together.</p>
            <QuietStatus tone="constructive">Ready to build on</QuietStatus>
          </QuietFrame>
        </WorkStage>

        <ContextPanel
          mode="docked"
          labelledBy="authenticated-context-panel-title"
          className="quiet-fixture__authenticated-context hidden lg:block"
        >
          <p className="quiet-fixture__eyebrow">Selected context</p>
          <h3 id="authenticated-context-panel-title">{selectedName}</h3>
          <p>Switching here changes the view, not the family&apos;s records.</p>
          <QuietStatus tone="info">Context is clear</QuietStatus>
        </ContextPanel>
      </Workspace>

      <VoiceSafeSlot placement="inline" label="Voice controls specimen">
        <QuietStatus tone="info">Voice rests safely below the work.</QuietStatus>
      </VoiceSafeSlot>
    </section>
  );
}
