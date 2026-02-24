"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signAndSendTransactionMessageWithSigners,
  getBase58Decoder,
  type Address,
  type TransactionSigner,
} from "@solana/kit";
import {
  getInitInstructionAsync,
  getBuyInstructionAsync,
  getCancelInstructionAsync,
  type Auction,
  getAuctionDecoder,
  getAuctionSize,
  DUTCH_AUCTION_PROGRAM_ADDRESS,
} from "@/generated";

// --- RPC setup ---

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const WS_URL = RPC_URL.replace("https://", "wss://").replace(
  "http://",
  "ws://"
);

export const rpc = createSolanaRpc(RPC_URL);
export const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);

// --- Types ---

export interface AuctionAccount {
  address: Address;
  data: Auction;
}

export interface CurrentPriceInfo {
  currentPrice: bigint;
  timeRemaining: number;
  percentComplete: number;
  status: "pending" | "active" | "ended";
}

// --- Price calculation (mirrors on-chain logic) ---

export function calculateCurrentPrice(auction: Auction): CurrentPriceInfo {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const startTime = auction.startTime;
  const endTime = auction.endTime;

  if (now < startTime) {
    const remaining = Number(endTime - now);
    return {
      currentPrice: auction.startPrice,
      timeRemaining: remaining,
      percentComplete: 0,
      status: "pending",
    };
  }

  if (now >= endTime) {
    return {
      currentPrice: auction.endPrice,
      timeRemaining: 0,
      percentComplete: 100,
      status: "ended",
    };
  }

  const elapsed = now - startTime;
  const duration = endTime - startTime;
  const priceRange = auction.startPrice - auction.endPrice;

  const priceDecrease = (priceRange * elapsed) / duration;
  const currentPrice = auction.startPrice - priceDecrease;

  const remaining = Number(endTime - now);
  const percent = Number((elapsed * 100n) / duration);

  return {
    currentPrice,
    timeRemaining: remaining,
    percentComplete: percent,
    status: "active",
  };
}

// --- Hook: live price ticker ---

export function useCurrentPrice(auction: Auction | null): CurrentPriceInfo | null {
  const [info, setInfo] = useState<CurrentPriceInfo | null>(null);

  useEffect(() => {
    if (!auction) {
      setInfo(null);
      return;
    }

    const tick = () => setInfo(calculateCurrentPrice(auction));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [auction]);

  return info;
}

// --- Hook: fetch all auctions ---

export function useAuctions() {
  const [auctions, setAuctions] = useState<AuctionAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await rpc
        .getProgramAccounts(DUTCH_AUCTION_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            { dataSize: BigInt(getAuctionSize()) },
          ],
        })
        .send();

      const decoder = getAuctionDecoder();
      const decoded: AuctionAccount[] = [];

      for (const item of result) {
        try {
          const raw = item.account.data;
          let bytes: Uint8Array;
          if (typeof raw === "string") {
            bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
          } else if (Array.isArray(raw) && typeof raw[0] === "string") {
            bytes = Uint8Array.from(atob(raw[0] as string), (c) =>
              c.charCodeAt(0)
            );
          } else {
            bytes = raw as unknown as Uint8Array;
          }
          const data = decoder.decode(bytes);
          decoded.push({
            address: item.pubkey as Address,
            data,
          });
        } catch {
          // skip malformed accounts
        }
      }

      if (mountedRef.current) {
        setAuctions(decoded);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch auctions");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const id = setInterval(fetch, 15000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetch]);

  return { auctions, loading, error, refetch: fetch };
}

// --- Transaction helpers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAndSend(
  signer: TransactionSigner,
  instruction: any,
): Promise<string> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  );

  const signatureBytes = await signAndSendTransactionMessageWithSigners(message);
  return getBase58Decoder().decode(signatureBytes);
}

// --- Hook: create auction ---

export function useCreateAuction() {
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (
      signer: TransactionSigner,
      params: {
        sellMint: string;
        buyMint: string;
        sellerSellAta: string;
        sellAmount: bigint;
        startPrice: bigint;
        endPrice: bigint;
        startTime: bigint;
        endTime: bigint;
        tokenProgram?: string;
      }
    ) => {
      setSending(true);
      setSignature(null);
      setError(null);

      try {
        const ix = await getInitInstructionAsync({
          seller: signer,
          sellMint: address(params.sellMint),
          buyMint: address(params.buyMint),
          sellerSellAta: address(params.sellerSellAta),
          sellAmount: params.sellAmount,
          startPrice: params.startPrice,
          endPrice: params.endPrice,
          startTime: params.startTime,
          endTime: params.endTime,
          tokenProgram: params.tokenProgram
            ? address(params.tokenProgram)
            : undefined,
        });

        const sig = await buildAndSend(signer, ix);
        setSignature(sig);
        return sig;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        throw err;
      } finally {
        setSending(false);
      }
    },
    []
  );

  return { create, sending, signature, error, reset: () => { setSignature(null); setError(null); } };
}

// --- Hook: buy from auction ---

export function useBuyAuction() {
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = useCallback(
    async (
      signer: TransactionSigner,
      params: {
        seller: string;
        sellMint: string;
        buyMint: string;
        buyerBuyAta: string;
        buyerSellAta: string;
        sellerBuyAta: string;
        maxPrice: bigint;
        tokenProgram?: string;
      }
    ) => {
      setSending(true);
      setSignature(null);
      setError(null);

      try {
        const ix = await getBuyInstructionAsync({
          buyer: signer,
          seller: address(params.seller),
          sellMint: address(params.sellMint),
          buyMint: address(params.buyMint),
          buyerBuyAta: address(params.buyerBuyAta),
          buyerSellAta: address(params.buyerSellAta),
          sellerBuyAta: address(params.sellerBuyAta),
          maxPrice: params.maxPrice,
          tokenProgram: params.tokenProgram
            ? address(params.tokenProgram)
            : undefined,
        });

        const sig = await buildAndSend(signer, ix);
        setSignature(sig);
        return sig;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        throw err;
      } finally {
        setSending(false);
      }
    },
    []
  );

  return { buy, sending, signature, error, reset: () => { setSignature(null); setError(null); } };
}

// --- Hook: cancel auction ---

export function useCancelAuction() {
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(
    async (
      signer: TransactionSigner,
      params: {
        sellMint: string;
        sellerSellAta: string;
        tokenProgram?: string;
      }
    ) => {
      setSending(true);
      setSignature(null);
      setError(null);

      try {
        const ix = await getCancelInstructionAsync({
          seller: signer,
          sellMint: address(params.sellMint),
          sellerSellAta: address(params.sellerSellAta),
          tokenProgram: params.tokenProgram
            ? address(params.tokenProgram)
            : undefined,
        });

        const sig = await buildAndSend(signer, ix);
        setSignature(sig);
        return sig;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        throw err;
      } finally {
        setSending(false);
      }
    },
    []
  );

  return { cancel, sending, signature, error, reset: () => { setSignature(null); setError(null); } };
}
