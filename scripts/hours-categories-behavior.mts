import { runCategoryBehavior } from "../apps/web/evals/hours-read/categories-behavior";
import { mapDb } from "../apps/web/lib/map/db";
try { await runCategoryBehavior(); } finally { await mapDb().end(); }
