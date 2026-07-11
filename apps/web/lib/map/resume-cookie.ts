import { cookies } from "next/headers";

import { MAP_RESUME_COOKIE } from "./tokens";

const MAP_RESUME_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export async function setMapResumeCookie(resumeToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MAP_RESUME_COOKIE, resumeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAP_RESUME_MAX_AGE_SECONDS,
  });
}
