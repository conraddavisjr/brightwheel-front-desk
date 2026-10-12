import { redirect } from "next/navigation";
import { db, must } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { encrypt, verifyState } from "@/lib/integrations/crypto";
import { exchangeNotionCode } from "@/lib/integrations/notion";
import { syncSource } from "@/lib/integrations/sync";
import { audit } from "@/lib/operator/manualSource";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = await requireStaff();
  if (auth.error) redirect("/");
  const state = verifyState(url.searchParams.get("state"));
  if (!state || state.schoolId !== auth.session.schoolId || state.p !== "notion") redirect("/operator/sources?error=state");
  if (url.searchParams.get("error")) redirect("/operator/sources?error=notion_denied");
  let target = "/operator/sources?connected=notion";
  try {
    const t = await exchangeNotionCode(url.searchParams.get("code") ?? "");
    const existing = await db().from("sources").select("id").eq("school_id", auth.session.schoolId).eq("kind", "notion").eq("config->>workspaceId", t.workspaceId).maybeSingle();
    const row = { school_id: auth.session.schoolId, kind: "notion", name: "Notion", account_label: t.workspaceName ?? "Notion workspace", token_enc: encrypt(t.accessToken), status: "connected", config: { workspaceId: t.workspaceId } };
    const source = existing.data
      ? must(await db().from("sources").update(row).eq("id", existing.data.id).select("id").single(), "source")
      : must(await db().from("sources").insert(row).select("id").single(), "source");
    await audit(auth.session.schoolId, auth.session.personId, "source.connect", { kind: "notion", name: t.workspaceName });
    const r = await syncSource(source.id);
    target += `&docs=${r.documents}&held=${r.held}`;
  } catch (err) {
    console.error("[notion] connect failed", err);
    target = "/operator/sources?error=notion_failed";
  }
  redirect(target);
}
