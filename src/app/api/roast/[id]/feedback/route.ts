import { getDb } from "@/lib/db/client";
import { handleFeedback } from "@/lib/roasts/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleFeedback(req, (await params).id, { db: await getDb() });
}
