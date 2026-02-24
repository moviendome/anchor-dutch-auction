"use client";

import { useState } from "react";
import { useSelectedWalletAccount } from "@solana/react";
import { useAuctions } from "@/hooks/useDutchAuction";
import AuctionCard from "./AuctionCard";

type Filter = "all" | "mine";

export default function AuctionList() {
  const [selectedAccount] = useSelectedWalletAccount();
  const { auctions, loading, error, refetch } = useAuctions();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered =
    filter === "mine" && selectedAccount
      ? auctions.filter((a) => a.data.seller === selectedAccount.address)
      : auctions;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-mono text-lg font-semibold text-accent">
          # auctions
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-border">
            <button
              onClick={() => setFilter("all")}
              className={`cursor-pointer px-3 py-1 font-mono text-xs transition-colors ${
                filter === "all"
                  ? "bg-accent text-bg"
                  : "text-text-secondary hover:text-accent"
              }`}
            >
              all
            </button>
            <button
              onClick={() => setFilter("mine")}
              className={`cursor-pointer px-3 py-1 font-mono text-xs transition-colors ${
                filter === "mine"
                  ? "bg-accent text-bg"
                  : "text-text-secondary hover:text-accent"
              }`}
            >
              mine
            </button>
          </div>
          <button
            onClick={refetch}
            className="cursor-pointer rounded border border-border bg-bg-tertiary px-3 py-1 font-mono text-xs text-text-secondary transition-all hover:border-accent hover:text-accent"
          >
            refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-bg-secondary p-8 text-center font-mono text-text-muted">
          Loading auctions...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-bg-secondary p-8 text-center font-mono text-text-muted">
          {filter === "mine"
            ? "You have no auctions. Create one in the Sell tab."
            : "No auctions found on-chain."}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((auction) => (
            <AuctionCard
              key={auction.address}
              auction={auction}
              onAction={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
