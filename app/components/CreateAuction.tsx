"use client";

import { useState, type FormEvent } from "react";
import { useSelectedWalletAccount } from "@solana/react";
import { useWalletAccountTransactionSendingSigner } from "@solana/react";
import { useCreateAuction } from "@/hooks/useDutchAuction";
import type { UiWalletAccount } from "@wallet-standard/ui";

const DURATION_OPTIONS = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
];

const DELAY_SECONDS = 30;

function CreateAuctionForm({
  account,
  onCreated,
}: {
  account: UiWalletAccount;
  onCreated?: () => void;
}) {
  const signer = useWalletAccountTransactionSendingSigner(account, "solana:devnet");
  const { create, sending, signature, error, reset } = useCreateAuction();

  const [sellMint, setSellMint] = useState("");
  const [buyMint, setBuyMint] = useState("");
  const [sellerSellAta, setSellerSellAta] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [endPrice, setEndPrice] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [tokenProgram, setTokenProgram] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    reset();

    if (
      !sellMint ||
      !buyMint ||
      !sellerSellAta ||
      !sellAmount ||
      !startPrice ||
      !endPrice ||
      !duration
    )
      return;

    const decimals = 9;
    const now = Math.floor(Date.now() / 1000);
    const startTime = now + DELAY_SECONDS;
    const endTime = startTime + duration;

    try {
      await create(signer, {
        sellMint,
        buyMint,
        sellerSellAta,
        sellAmount: BigInt(Math.floor(parseFloat(sellAmount) * 10 ** decimals)),
        startPrice: BigInt(
          Math.floor(parseFloat(startPrice) * 10 ** decimals)
        ),
        endPrice: BigInt(Math.floor(parseFloat(endPrice) * 10 ** decimals)),
        startTime: BigInt(startTime),
        endTime: BigInt(endTime),
        tokenProgram: tokenProgram || undefined,
      });
      onCreated?.();
    } catch {
      // error in hook state
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-xs text-text-muted">
            sell_mint (token to sell)
          </label>
          <input
            type="text"
            value={sellMint}
            onChange={(e) => setSellMint(e.target.value)}
            placeholder="Token mint address"
            className="w-full rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs text-text-muted">
            buy_mint (token to receive)
          </label>
          <input
            type="text"
            value={buyMint}
            onChange={(e) => setBuyMint(e.target.value)}
            placeholder="Token mint address"
            className="w-full rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block font-mono text-xs text-text-muted">
          seller_sell_ata (your token account for sell_mint)
        </label>
        <input
          type="text"
          value={sellerSellAta}
          onChange={(e) => setSellerSellAta(e.target.value)}
          placeholder="Associated token account address"
          className="w-full rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block font-mono text-xs text-text-muted">
            sell_amount
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
            placeholder="100"
            className="w-full rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs text-text-muted">
            start_price
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={startPrice}
            onChange={(e) => setStartPrice(e.target.value)}
            placeholder="10"
            className="w-full rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs text-text-muted">
            end_price
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={endPrice}
            onChange={(e) => setEndPrice(e.target.value)}
            placeholder="1"
            className="w-full rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block font-mono text-xs text-text-muted">
          token_program (optional, defaults to SPL Token)
        </label>
        <input
          type="text"
          value={tokenProgram}
          onChange={(e) => setTokenProgram(e.target.value)}
          placeholder="Leave empty for SPL Token, or paste Token-2022 address"
          className="w-full rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block font-mono text-xs text-text-muted">
          duration
        </label>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.seconds}
              type="button"
              onClick={() => setDuration(opt.seconds)}
              className={`flex-1 cursor-pointer rounded border px-3 py-2 font-mono text-sm font-medium transition-all duration-200 ${
                duration === opt.seconds
                  ? "border-accent bg-accent text-bg"
                  : "border-border bg-bg-tertiary text-text-secondary hover:border-accent hover:text-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {duration && startPrice && endPrice && (
        <div className="rounded border border-border bg-bg-tertiary p-3">
          <p className="font-mono text-xs text-text-muted">// preview</p>
          <p className="mt-1 font-mono text-sm text-text-secondary">
            Price drops from{" "}
            <span className="text-accent">{startPrice}</span> to{" "}
            <span className="text-accent">{endPrice}</span> over{" "}
            <span className="text-text">
              {DURATION_OPTIONS.find((d) => d.seconds === duration)?.label}
            </span>
          </p>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Starts in ~{DELAY_SECONDS}s after tx confirms
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={
          sending ||
          !sellMint ||
          !buyMint ||
          !sellerSellAta ||
          !sellAmount ||
          !startPrice ||
          !endPrice ||
          !duration
        }
        className="w-full cursor-pointer rounded bg-accent px-4 py-2 font-mono text-sm font-semibold text-bg transition-all duration-200 hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "> creating..." : "> init()"}
      </button>

      {signature && (
        <div className="mt-4 rounded border border-accent bg-success-bg p-3 text-sm text-accent">
          Auction created!{" "}
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent-dim"
          >
            View transaction
          </a>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-danger bg-danger-bg p-3 text-sm text-danger">
          {error}
        </div>
      )}
    </form>
  );
}

export default function CreateAuction({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const [selectedAccount] = useSelectedWalletAccount();

  return (
    <div className="rounded-lg border border-accent/30 bg-bg-secondary p-6 transition-all duration-300">
      <h2 className="mb-4 font-mono text-lg font-semibold text-accent">
        # create_auction
      </h2>

      {selectedAccount ? (
        <CreateAuctionForm account={selectedAccount} onCreated={onCreated} />
      ) : (
        <p className="text-sm text-text-muted">
          Connect your wallet to create an auction.
        </p>
      )}
    </div>
  );
}
