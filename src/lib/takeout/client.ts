import { transfer, wrap } from "comlink";
import type { ProcessResult, processTakeout } from "./process";

/** Reads the file and turns it into a Summary inside a Web Worker. The raw history never leaves the browser. */
export async function processInWorker(file: File): Promise<ProcessResult> {
  const worker = new Worker(new URL("../../workers/takeout.worker.ts", import.meta.url), { type: "module" });
  try {
    const api = wrap<{ processTakeout: typeof processTakeout }>(worker);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Transfer instead of copy: a 200 MB zip shouldn't exist twice in memory.
    return await api.processTakeout(file.name, transfer(bytes, [bytes.buffer]));
  } finally {
    worker.terminate();
  }
}
