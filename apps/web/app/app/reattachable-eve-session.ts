import type { ClientSession, SessionState } from "eve/client";

export interface ReattachableEveSession {
  readonly session: ClientSession;
  adopt(state: SessionState): void;
}

/**
 * Keeps one object identity for EveAgentStore while allowing recovery to
 * replace the ClientSession it delegates to. EveAgentStore.reset() retains an
 * externally supplied session, so adopting before reset reattaches the store
 * to the durable session recovered from the server.
 */
export function createReattachableEveSession(input: {
  createSession: (state?: SessionState) => ClientSession;
  initialSession?: SessionState;
}): ReattachableEveSession {
  let current = input.createSession(input.initialSession);
  const session = new Proxy(current, {
    get(_target, property) {
      const value = Reflect.get(current, property, current);
      return typeof value === "function" ? value.bind(current) : value;
    },
  }) as ClientSession;

  return {
    session,
    adopt(state) {
      current = input.createSession(state);
    },
  };
}
