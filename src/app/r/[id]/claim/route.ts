import { getDb } from "@/lib/db/client";
import { handleClaim } from "@/lib/roasts/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleClaim(req, (await params).id, { db: await getDb() });
}
