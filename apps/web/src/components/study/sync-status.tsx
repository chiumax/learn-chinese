"use client";

import { RefreshCw } from "lucide-react";

export function SyncStatus({
  remaining,
  onSync,
  isSyncing,
  isError,
}: {
  remaining: number;
  onSync: () => void;
  isSyncing: boolean;
  isError: boolean;
}) {
  return (
    <p className="text-muted-foreground flex items-center justify-center gap-3 text-center text-sm">
      <span>{remaining} left</span>
      <button
        className="hover:text-foreground inline-flex items-center gap-1 underline"
        onClick={onSync}
        disabled={isSyncing}
      >
        <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "syncing…" : isError ? "offline" : "sync"}
      </button>
    </p>
  );
}
