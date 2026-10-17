import { getDb } from "@/lib/db/client";
import { handleDelete, handleUpdate } from "@/lib/roasts/http";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return handleUpdate(req, (await params).id, { db: await getDb() });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handleDelete(req, (await params).id, { db: await getDb() });
}
