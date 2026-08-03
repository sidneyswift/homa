import { notFound } from "next/navigation";

import { ChoiceCardBench } from "./choice-card-bench";

/**
 * The choice-card bench renders production transcript components with
 * synthetic data. Keep the environment boundary in this server component so
 * a production build cannot expose the bench or its fixture scenarios.
 */
export default function ChoiceCardBenchPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ChoiceCardBench />;
}
