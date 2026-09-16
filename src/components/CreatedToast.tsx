"use client";

import { useEffect } from "react";
import { useToast } from "@/components/Toast";

/** Fires a "bill created" toast once after createPost redirects here with ?created=1, then strips the param. */
export default function CreatedToast() {
  const toast = useToast();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.get("created")) return;
    // Strip synchronously via history so StrictMode's second effect run sees a clean URL and doesn't re-toast.
    url.searchParams.delete("created");
    window.history.replaceState(null, "", url.pathname + url.search);
    toast("สร้างบิลแล้ว");
  }, [toast]);

  return null;
}
