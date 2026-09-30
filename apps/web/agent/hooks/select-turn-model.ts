import { defineHook } from "eve/hooks";

import { selectHomaTurnModel } from "../model";
import { turnModelState } from "../turn-model-state";

export default defineHook({
  events: {
    "turn.started"(_event, ctx) {
      turnModelState.update(() => selectHomaTurnModel(ctx.session.auth.current));
    },
  },
});
