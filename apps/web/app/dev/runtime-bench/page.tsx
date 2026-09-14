import { notFound } from "next/navigation";

import { benchEnabled } from "../../../lib/runtime-bench";
import { RuntimeBench } from "./runtime-bench";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!benchEnabled(process.env)) notFound();
  return <RuntimeBench />;
}
