import { defineState } from "eve/context";
import { HOMA_MODEL } from "./model";
import type { Route } from "../lib/model-router/router";

/** Session-scoped accounting, never shared between families or concurrent runs. */
export const modelRouterState = defineState<Route>("homa.model-router", () => ({ model: HOMA_MODEL, reason: "disabled", routerMs: 0 }));
