import { getDb } from "@/lib/db/client";
import { generateRoast } from "@/lib/roast/generate";
import { handleCreate } from "@/lib/roasts/http";

// The generation chain has a 45 s deadline; leave headroom for the DB write.
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleCreate(req, { db: await getDb(), generate: generateRoast });
}
