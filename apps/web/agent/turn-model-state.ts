import { defineState } from "eve/context";

import { HOMA_MODEL, type HomaTurnModel } from "./model";

/** Reset from authenticated context each turn; isolated across concurrent sessions. */
export const turnModelState = defineState<HomaTurnModel>(
  "homa.turn-model",
  () => HOMA_MODEL,
);
