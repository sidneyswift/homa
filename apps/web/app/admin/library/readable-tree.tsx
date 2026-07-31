import type { ReadableNode } from "../../../lib/materials/library-reader";

/**
 * Renders one analysis document's node tree (see library-reader.ts for
 * why the tree exists at all: the corpus has no fixed schema, so the
 * reader walks whatever a drop happens to carry).
 *
 * The visual grammar is deliberately flat and quiet. Depth is shown by
 * a hairline rule and a small indent, never by nested boxes: a document
 * five levels deep turns into five nested cards otherwise, and the
 * founder reading it is trying to answer "what did we learn about this
 * worksheet", not admire a widget.
 */

function Text({ label, value }: { label: string; value: string }) {
  const long = value.length > 90;
  if (!label) {
    return <p className="text-[0.84rem] leading-relaxed text-body">{value}</p>;
  }
  return (
    <div className={long ? "" : "flex flex-wrap gap-x-2.5"}>
      <p className="shrink-0 text-[0.78rem] font-semibold text-muted">{label}</p>
      <p className="text-[0.84rem] leading-relaxed text-body">{value}</p>
    </div>
  );
}

function Chips({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-[0.78rem] font-semibold text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="rounded-pill bg-page px-2.5 py-0.5 text-[0.75rem] text-body"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReadableTree({
  nodes,
  depth = 0,
}: {
  nodes: ReadableNode[];
  depth?: number;
}) {
  return (
    <div className={depth === 0 ? "space-y-5" : "space-y-2.5"}>
      {nodes.map((node, index) => {
        const key = `${node.kind}-${node.label}-${index}`;

        if (node.kind === "text") return <Text key={key} label={node.label} value={node.value} />;
        if (node.kind === "chips") return <Chips key={key} label={node.label} values={node.values} />;

        if (node.kind === "section") {
          if (depth === 0) {
            return (
              <section
                key={key}
                className="rounded-[var(--radius-md)] border border-border-subtle bg-card px-4 py-3.5"
              >
                <h3 className="font-display text-[0.95rem] font-bold text-strong">{node.label}</h3>
                <div className="mt-2.5">
                  <ReadableTree nodes={node.children} depth={depth + 1} />
                </div>
              </section>
            );
          }
          return (
            <div key={key} className="border-l border-border-subtle pl-3">
              <p className="text-[0.78rem] font-bold text-strong">{node.label}</p>
              <div className="mt-1.5">
                <ReadableTree nodes={node.children} depth={depth + 1} />
              </div>
            </div>
          );
        }

        // entries: an array of objects, each with its own heading.
        const body = (
          <div className="space-y-2.5">
            {node.items.map((item, itemIndex) => (
              <div key={`${item.heading}-${itemIndex}`} className="border-l border-border-subtle pl-3">
                <p className="text-[0.78rem] font-bold text-strong">{item.heading}</p>
                <div className="mt-1.5">
                  <ReadableTree nodes={item.children} depth={depth + 1} />
                </div>
              </div>
            ))}
          </div>
        );

        if (depth === 0) {
          return (
            <section
              key={key}
              className="rounded-[var(--radius-md)] border border-border-subtle bg-card px-4 py-3.5"
            >
              <h3 className="font-display text-[0.95rem] font-bold text-strong">
                {node.label}
                <span className="ml-2 font-sans text-[0.72rem] font-semibold text-subtle">
                  {node.items.length}
                </span>
              </h3>
              <div className="mt-2.5">{body}</div>
            </section>
          );
        }
        return (
          <div key={key}>
            <p className="text-[0.78rem] font-semibold text-muted">{node.label}</p>
            <div className="mt-1.5">{body}</div>
          </div>
        );
      })}
    </div>
  );
}
