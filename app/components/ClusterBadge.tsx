"use client";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export default function ClusterBadge() {
  return (
    <span className="rounded border border-accent/40 bg-bg-tertiary px-2 py-0.5 font-mono text-xs font-medium text-accent">
      {CLUSTER}
    </span>
  );
}
