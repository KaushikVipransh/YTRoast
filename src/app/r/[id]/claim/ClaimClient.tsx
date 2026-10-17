"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The secret link is /r/<id>/claim#key=<token>. Browsers never send the fragment to the server, so the key
 * stays out of logs; this component POSTs it to claim ownership, then opens the roast.
 */
export function ClaimClient({ id }: { id: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(window.location.hash.slice(1)).get("key") ?? "";
    fetch(`/api/roast/${id}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    })
      .then((res) => (res.ok ? router.replace(`/r/${id}`) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [id, router]);

  return (
    <p className="font-mono">
      {failed ? "that secret link didn't work. it may be from a deleted roast." : "getting your file back…"}
    </p>
  );
}
