import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/operator/auth";
import { signState } from "@/lib/integrations/crypto";
import { googleAuthorizeUrl, googleConfigured } from "@/lib/integrations/google";

export async function GET(req: Request) {
  const auth = await requireStaff();
  if (auth.error) redirect("/");
  const product = new URL(req.url).searchParams.get("product") === "calendar" ? "calendar" : "drive";
  if (!googleConfigured()) redirect(`/operator/sources?error=google_not_configured`);
  redirect(googleAuthorizeUrl(signState({ schoolId: auth.session.schoolId, personId: auth.session.personId, p: product }), product));
}
