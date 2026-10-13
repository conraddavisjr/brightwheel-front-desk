"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { startDemoSession } from "@/lib/demo/signIn";

const Input = z.object({ school: z.enum(["sunflower-valley", "harbor-kids"]), role: z.enum(["director", "parent"]) });

/**
 * Sign in as a demo person and go to their home. Setting the session cookie in
 * a Server Action clears the client router cache, so nothing prefetched under
 * the previous identity (like a signed-out redirect to "/") is reused.
 */
export async function signInAs(school: string, role: string): Promise<{ error: string }> {
  const parsed = Input.safeParse({ school, role });
  if (!parsed.success) return { error: "Pick a school and a role." };
  const result = await startDemoSession(parsed.data.school, parsed.data.role);
  if ("error" in result) return { error: result.error };
  redirect(result.redirect);
}
