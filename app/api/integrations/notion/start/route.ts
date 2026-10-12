import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/operator/auth";
import { signState } from "@/lib/integrations/crypto";
import { notionAuthorizeUrl, notionConfigured } from "@/lib/integrations/notion";

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) redirect("/");
  if (!notionConfigured()) redirect("/operator/sources?error=notion_not_configured");
  redirect(notionAuthorizeUrl(signState({ schoolId: auth.session.schoolId, personId: auth.session.personId, p: "notion" })));
}
