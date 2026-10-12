import { redirect } from "next/navigation";
import { db, must } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { encrypt, verifyState } from "@/lib/integrations/crypto";
import { exchangeGoogleCode } from "@/lib/integrations/google";
import { syncSource } from "@/lib/integrations/sync";
import { audit } from "@/lib/operator/manualSource";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = await requireStaff();
  if (auth.error) redirect("/");
  const state = verifyState(url.searchParams.get("state"));
  if (!state || state.schoolId !== auth.session.schoolId || !["drive", "calendar"].includes(state.p)) redirect("/operator/sources?error=state");
  if (url.searchParams.get("error")) redirect(`/operator/sources?error=google_denied`);
  const kind = state.p as "drive" | "calendar";
  let target = `/operator/sources?connected=${kind}`;
  try {
    const t = await exchangeGoogleCode(url.searchParams.get("code") ?? "");
    const sameAccount = await db().from("sources").select("id,config").eq("school_id", auth.session.schoolId).eq("kind", kind).eq("account_label", t.email ?? "").maybeSingle();
    const demo = sameAccount.data ? null : (await db().from("sources").select("id,config").eq("school_id", auth.session.schoolId).eq("kind", kind).is("token_enc", null).limit(1).maybeSingle()).data;
    const existing = { data: sameAccount.data ?? demo };
    const row = {
      school_id: auth.session.schoolId,
      kind,
      name: kind === "drive" ? "Google Drive" : "Google Calendar",
      account_label: t.email,
      token_enc: encrypt(t.refreshToken),
      status: "connected",
      config: kind === "calendar" ? { calendarId: "primary" } : { fileIds: (existing.data?.config as { fileIds?: string[] } | undefined)?.fileIds ?? [] },
    };
    const source = existing.data
      ? must(await db().from("sources").update(row).eq("id", existing.data.id).select("id").single(), "source")
      : must(await db().from("sources").insert(row).select("id").single(), "source");
    await audit(auth.session.schoolId, auth.session.personId, "source.connect", { kind, name: t.email });
    if (kind === "calendar") {
      const r = await syncSource(source.id);
      target += `&events=${r.events}`;
    } else {
      // Next: the director picks files in the Google Picker.
      target += `&pick=${source.id}`;
    }
  } catch (err) {
    console.error("[google] connect failed", err);
    target = `/operator/sources?error=${kind}_failed`;
  }
  redirect(target);
}
