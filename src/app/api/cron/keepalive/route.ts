import { handleKeepalive } from "@/lib/cron";
import { getDb } from "@/lib/db/client";

export async function GET(req: Request) {
  return handleKeepalive(req, { db: await getDb() });
}
