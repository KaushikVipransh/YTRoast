"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

/** The sticky viral-loop CTA on someone else's roast (PRD F20). */
export function RoastMeNext() {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t-2 border-ink bg-butter p-4 text-center">
      <Link href="/roast" className="text-lg font-black uppercase" onClick={() => track("roast_me_next_click")}>
        roast me next →
      </Link>
    </div>
  );
}
