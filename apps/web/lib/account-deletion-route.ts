import { NextResponse } from "next/server";

import type { AccountDeletionResult } from "./account-deletion";

interface AccountDeletionActor {
  family: { id: string };
  memberUserId: string | null;
}

export interface AccountDeletionPostDependencies {
  resolveActor: (request: Request) => Promise<AccountDeletionActor | null>;
  requestDeletion: (input: {
    familyId: string;
    userId: string;
    confirmation: unknown;
  }) => Promise<AccountDeletionResult>;
  clearBrowserSession: () => Promise<void>;
}

export function createAccountDeletionPost(
  dependencies: AccountDeletionPostDependencies,
) {
  return async function accountDeletionPost(request: Request): Promise<Response> {
    const actor = await dependencies.resolveActor(request);
    if (!actor?.memberUserId) {
      return NextResponse.json({ ok: false, reason: "no-session" }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as { confirmation?: unknown } | null;
    const result = await dependencies.requestDeletion({
      familyId: actor.family.id,
      userId: actor.memberUserId,
      confirmation: body?.confirmation,
    });
    if (result.accessClosed && !request.headers.has("authorization")) {
      await dependencies.clearBrowserSession();
    }
    return NextResponse.json({ ok: result.state !== "rejected", ...result }, {
      status: result.state === "rejected" ? 400 : 200,
    });
  };
}
