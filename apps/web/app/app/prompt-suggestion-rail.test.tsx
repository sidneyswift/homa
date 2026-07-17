import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PromptSuggestionRail } from "./prompt-suggestion-rail";

interface TestElementProps {
  children?: ReactNode;
  onClick?: () => void;
}

function visitElements(
  node: ReactNode,
  visit: (element: ReactElement<TestElementProps>) => void,
): void {
  if (Array.isArray(node)) {
    for (const child of node) visitElements(child, visit);
    return;
  }
  if (!isValidElement<TestElementProps>(node)) return;
  visit(node);
  visitElements(node.props.children, visit);
}

function buttonsIn(node: ReactNode): ReactElement<TestElementProps>[] {
  const buttons: ReactElement<TestElementProps>[] = [];
  visitElements(node, (element) => {
    if (element.type === "button") buttons.push(element);
  });
  return buttons;
}

describe("PromptSuggestionRail", () => {
  it("renders the delayed loading state as an accessible status", () => {
    const html = renderToStaticMarkup(
      <PromptSuggestionRail
        phase="loading"
        suggestions={[]}
        onSelect={() => {}}
      />,
    );

    assert.match(html, /role="status"/u);
    assert.match(html, /Finding another idea\.\.\./u);
    assert.doesNotMatch(html, /<button/u);
  });

  it("renders one suggestion as one full-width segment", () => {
    const html = renderToStaticMarkup(
      <PromptSuggestionRail
        phase="ready"
        suggestions={["Email this"]}
        onSelect={() => {}}
      />,
    );

    assert.equal(html.match(/<button/gu)?.length, 1);
    assert.match(html, /grid-cols-1/u);
    assert.doesNotMatch(html, /absolute inset-y-3 left-0 w-px/u);
  });

  it("renders two equal segments with exactly one hairline divider", () => {
    const html = renderToStaticMarkup(
      <PromptSuggestionRail
        phase="ready"
        suggestions={["Email this", "Make another"]}
        onSelect={() => {}}
      />,
    );

    assert.equal(html.match(/<button/gu)?.length, 2);
    assert.match(html, /grid-cols-2/u);
    assert.equal(
      html.match(/absolute inset-y-3 left-0 w-px bg-border-subtle/gu)?.length,
      1,
    );
  });

  it("uses flat 48px targets with an ArrowRight affordance", () => {
    const html = renderToStaticMarkup(
      <PromptSuggestionRail
        phase="ready"
        suggestions={["Email this", "Make another"]}
        onSelect={() => {}}
      />,
    );

    assert.doesNotMatch(html, /rounded-pill/u);
    assert.equal(html.match(/min-h-12/gu)?.length, 2);
    assert.equal(html.match(/lucide-arrow-right/gu)?.length, 2);
  });

  it("passes the exact visible text and index to selection", () => {
    const selections: Array<readonly [number, string]> = [];
    const tree = PromptSuggestionRail({
      phase: "ready",
      suggestions: ["Email this", "Make another"],
      onSelect: (index, suggestion) => {
        selections.push([index, suggestion]);
      },
    });

    const buttons = buttonsIn(tree);
    buttons[1]?.props.onClick?.();

    assert.deepEqual(selections, [[1, "Make another"]]);
  });

  it("renders no zero-result or pre-threshold rail", () => {
    const pending = renderToStaticMarkup(
      <PromptSuggestionRail
        phase="pending"
        suggestions={[]}
        onSelect={() => {}}
      />,
    );
    const emptyReady = renderToStaticMarkup(
      <PromptSuggestionRail
        phase="ready"
        suggestions={[]}
        onSelect={() => {}}
      />,
    );

    assert.equal(pending, "");
    assert.equal(emptyReady, "");
  });
});
