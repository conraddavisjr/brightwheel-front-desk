import { db } from "@/lib/db/client";
import { searchKnowledge } from "@/lib/retrieval/search";
const [slug, ...q] = process.argv.slice(2);
async function main() {
const { data } = await db().from("schools").select("id").eq("slug", slug).single();
const r = await searchKnowledge(data!.id, q.join(" "), 8);
console.log("strength", r.strength, "conflict", r.conflict?.note ?? null);
for (const p of r.passages) console.log(p.id, p.rrf.toFixed(4), "vec", p.vecRank, "fts", p.ftsRank, "d", p.distance?.toFixed(3), "|", p.title, ">", p.heading.split(" > ").slice(1).join(" > "), "|", p.text.slice(0, 80).replace(/\n/g, " "));
}
main();
