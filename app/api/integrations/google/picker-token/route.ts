import { db } from "@/lib/db/client";
import { config } from "@/lib/config";
import { requireStaff } from "@/lib/operator/auth";
import { decrypt } from "@/lib/integrations/crypto";
import { googleAccessToken } from "@/lib/integrations/google";

/** A short-lived Drive access token for the Picker (drive.file scope only; the refresh token never leaves the server). */
export async function GET(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const sourceId = new URL(req.url).searchParams.get("source");
  const { data: src } = await db().from("sources").select("id,school_id,kind,token_enc").eq("id", sourceId ?? "").maybeSingle();
  if (!src || src.school_id !== auth.session.schoolId || src.kind !== "drive" || !src.token_enc) return Response.json({ error: "Connect Google Drive first." }, { status: 404 });
  const accessToken = await googleAccessToken(decrypt(src.token_enc));
  return Response.json({ accessToken, apiKey: config.integrations.google.pickerApiKey, appId: config.integrations.google.appId }, { headers: { "cache-control": "no-store" } });
}
