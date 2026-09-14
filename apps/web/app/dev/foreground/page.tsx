import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ForegroundPreview } from "./preview";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const session = z.string().uuid().safeParse(params.session);
  if (!session.success) redirect(`/dev/foreground?session=${randomUUID()}`);
  return <ForegroundPreview session={session.data} />;
}
