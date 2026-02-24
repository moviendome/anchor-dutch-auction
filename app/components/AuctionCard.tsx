"use client";

import { useState } from "react";
import { useSelectedWalletAccount } from "@solana/react";
import { useWalletAccountTransactionSendingSigner } from "@solana/react";
import {
  useCurrentPrice,
  useBuyAuction,
  useCancelAuction,
  type AuctionAccount,
} from "@/hooks/useDutchAuction";
import type { UiWalletAccount } from "@wallet-standard/ui";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatPrice(raw: bigint, decimals = 9): string {
  const whole = raw / BigInt(10 ** decimals);
  const frac = raw % BigInt(10 ** decimals);
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
}

// Buy form - extracted so useWalletAccountTransactionSendingSigner is always called
function BuyForm({
  account,
  auction,
  currentPrice,
  onAction,
}: {
  account: UiWalletAccount;
  auction: AuctionAccount;
  currentPrice: bigint;
  onAction?: () => void;
}) {
  const signer = useWalletAccountTransactionSendingSigner(account, "solana:devnet");
  const { buy, sending, signature, error, reset } = useBuyAuction();

  const [buyerBuyAta, setBuyerBuyAta] = useState("");
  const [buyerSellAta, setBuyerSellAta] = useState("");
  const [sellerBuyAta, setSellerBuyAta] = useState("");

  const handleBuy = async () => {
    if (!buyerBuyAta || !buyerSellAta || !sellerBuyAta) return;
    reset();

    try {
      await buy(signer, {
        seller: auction.data.seller,
        sellMint: auction.data.sellMint,
        buyMint: auction.data.buyMint,
        buyerBuyAta,
        buyerSellAta,
        sellerBuyAta,
        maxPrice: currentPrice,
      });
      onAction?.();
    } catch {
      // error in hook
    }
  };

  return (
    <div className="space-y-2 rounded border border-accent/30 bg-bg-tertiary p-3">
      <p className="font-mono text-xs text-text-muted">
        // provide your token accounts
      </p>
      <input
        type="text"
        value={buyerBuyAta}
        onChange={(e) => setBuyerBuyAta(e.target.value)}
        placeholder="Your buy_mint ATA"
        className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
      />
      <input
        type="text"
        value={buyerSellAta}
        onChange={(e) => setBuyerSellAta(e.target.value)}
        placeholder="Your sell_mint ATA"
        className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
      />
      <input
        type="text"
        value={sellerBuyAta}
        onChange={(e) => setSellerBuyAta(e.target.value)}
        placeholder="Seller's buy_mint ATA"
        className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
      />
      <button
        onClick={handleBuy}
        disabled={sending || !buyerBuyAta || !buyerSellAta || !sellerBuyAta}
        className="w-full cursor-pointer rounded bg-accent px-3 py-1.5 font-mono text-sm font-semibold text-bg transition-all hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "buying..." : "confirm buy"}
      </button>
      {signature && (
        <div className="rounded border border-accent bg-success-bg p-2 text-sm text-accent">
          Purchased!{" "}
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent-dim"
          >
            View tx
          </a>
        </div>
      )}
      {error && (
        <div className="rounded border border-danger bg-danger-bg p-2 text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

// Cancel form - extracted for the same reason
function CancelForm({
  account,
  auction,
  onAction,
}: {
  account: UiWalletAccount;
  auction: AuctionAccount;
  onAction?: () => void;
}) {
  const signer = useWalletAccountTransactionSendingSigner(account, "solana:devnet");
  const { cancel, sending, signature, error, reset } = useCancelAuction();
  const [sellerSellAta, setSellerSellAta] = useState("");

  const handleCancel = async () => {
    if (!sellerSellAta) return;
    reset();

    try {
      await cancel(signer, {
        sellMint: auction.data.sellMint,
        sellerSellAta,
      });
      onAction?.();
    } catch {
      // error in hook
    }
  };

  return (
    <div className="space-y-2 rounded border border-danger/30 bg-bg-tertiary p-3">
      <input
        type="text"
        value={sellerSellAta}
        onChange={(e) => setSellerSellAta(e.target.value)}
        placeholder="Your sell_mint ATA (to receive tokens back)"
        className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
      />
      <button
        onClick={handleCancel}
        disabled={sending || !sellerSellAta}
        className="w-full cursor-pointer rounded bg-danger px-3 py-1.5 font-mono text-sm font-semibold text-bg transition-all hover:bg-danger/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "cancelling..." : "confirm cancel"}
      </button>
      {signature && (
        <div className="rounded border border-accent bg-success-bg p-2 text-sm text-accent">
          Cancelled!{" "}
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent-dim"
          >
            View tx
          </a>
        </div>
      )}
      {error && (
        <div className="rounded border border-danger bg-danger-bg p-2 text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

export default function AuctionCard({
  auction,
  onAction,
}: {
  auction: AuctionAccount;
  onAction?: () => void;
}) {
  const [selectedAccount] = useSelectedWalletAccount();
  const priceInfo = useCurrentPrice(auction.data);
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);

  const isSeller = selectedAccount?.address === auction.data.seller;

  const statusColor =
    priceInfo?.status === "active"
      ? "border-accent/50"
      : priceInfo?.status === "pending"
        ? "border-warning/50"
        : "border-border";

  const statusLabel =
    priceInfo?.status === "active"
      ? "live"
      : priceInfo?.status === "pending"
        ? "pending"
        : "ended";

  const statusBg =
    priceInfo?.status === "active"
      ? "border-accent bg-success-bg text-accent"
      : priceInfo?.status === "pending"
        ? "border-warning bg-warning-bg text-warning"
        : "border-border bg-bg-tertiary text-text-muted";

  return (
    <div
      className={`rounded-lg border ${statusColor} bg-bg-secondary p-4 transition-all duration-300 hover:-translate-y-0.5`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-muted">
              {truncateAddress(auction.address)}
            </span>
            <a
              href={`https://explorer.solana.com/address/${auction.address}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent underline hover:text-accent-dim"
            >
              explorer
            </a>
          </div>
          <p className="mt-1 font-mono text-xs text-text-muted">
            seller: {truncateAddress(auction.data.seller)}
            {isSeller && <span className="ml-1 text-accent">(you)</span>}
          </p>
        </div>
        <span
          className={`rounded border px-2 py-0.5 font-mono text-xs font-medium ${statusBg}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Token info */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded border border-border bg-bg-tertiary p-2">
          <p className="font-mono text-xs text-text-muted">selling</p>
          <p className="font-mono text-sm font-medium text-text">
            {formatPrice(auction.data.sellAmount)}
          </p>
          <p className="font-mono text-xs text-text-muted">
            {truncateAddress(auction.data.sellMint)}
          </p>
        </div>
        <div className="rounded border border-border bg-bg-tertiary p-2">
          <p className="font-mono text-xs text-text-muted">for</p>
          <p className="font-mono text-sm font-medium text-text">
            {truncateAddress(auction.data.buyMint)}
          </p>
        </div>
      </div>

      {/* Price and time */}
      {priceInfo && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-muted">
              current_price
            </span>
            <span className="font-mono text-lg font-semibold text-accent">
              {formatPrice(priceInfo.currentPrice)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-muted">
              {priceInfo.status === "pending" ? "starts_in" : "time_left"}
            </span>
            <span className="font-mono text-sm text-text-secondary">
              {formatTime(priceInfo.timeRemaining)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="h-full rounded-full bg-accent transition-all duration-1000"
              style={{ width: `${priceInfo.percentComplete}%` }}
            />
          </div>

          <div className="flex justify-between font-mono text-xs text-text-muted">
            <span>{formatPrice(auction.data.startPrice)}</span>
            <span>{formatPrice(auction.data.endPrice)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {priceInfo?.status === "active" && !isSeller && selectedAccount && (
        <div className="space-y-2">
          {!showBuyForm ? (
            <button
              onClick={() => setShowBuyForm(true)}
              className="w-full cursor-pointer rounded bg-accent px-4 py-2 font-mono text-sm font-semibold text-bg transition-all hover:bg-accent-dim"
            >
              {">"} buy()
            </button>
          ) : (
            <>
              <BuyForm
                account={selectedAccount}
                auction={auction}
                currentPrice={priceInfo.currentPrice}
                onAction={onAction}
              />
              <button
                onClick={() => setShowBuyForm(false)}
                className="w-full cursor-pointer rounded border border-border px-3 py-1.5 font-mono text-sm text-text-secondary transition-all hover:border-danger hover:text-danger"
              >
                cancel
              </button>
            </>
          )}
        </div>
      )}

      {priceInfo?.status === "pending" && isSeller && selectedAccount && (
        <div className="space-y-2">
          {!showCancelForm ? (
            <button
              onClick={() => setShowCancelForm(true)}
              className="w-full cursor-pointer rounded border border-danger bg-danger-bg px-4 py-2 font-mono text-sm font-semibold text-danger transition-all hover:bg-danger/20"
            >
              {">"} cancel()
            </button>
          ) : (
            <>
              <CancelForm
                account={selectedAccount}
                auction={auction}
                onAction={onAction}
              />
              <button
                onClick={() => setShowCancelForm(false)}
                className="w-full cursor-pointer rounded border border-border px-3 py-1.5 font-mono text-sm text-text-secondary transition-all hover:border-accent hover:text-accent"
              >
                back
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
