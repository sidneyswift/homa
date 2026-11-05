import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { GenerativeLab } from "./ui";

export const metadata = { title: "App2 interaction lab", robots: { index: false, follow: false } };
export default async function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return <main><p>Sign in to Homa to try the interaction lab.</p><Link href="/app2">Back to App 2</Link></main>;
  return <GenerativeLab account={user.id} />;
}
