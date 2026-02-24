"use client";

import { useState } from "react";
import { useSelectedWalletAccount } from "@solana/react";
import WalletButton from "@/components/WalletButton";
import ClusterBadge from "@/components/ClusterBadge";
import CreateAuction from "@/components/CreateAuction";
import AuctionList from "@/components/AuctionList";

type Tab = "sell" | "buy";

export default function Home() {
  const [selectedAccount] = useSelectedWalletAccount();
  const [tab, setTab] = useState<Tab>("buy");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-accent/30 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg font-semibold text-accent">
              $ dutch_auction
            </h1>
            <ClusterBadge />
          </div>
          <WalletButton />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="mx-auto max-w-[960px] px-6 py-8">
          {!selectedAccount ? (
            <div className="space-y-6">
              {/* Hero */}
              <div className="rounded-lg border border-accent/30 bg-bg-secondary p-8 transition-all duration-300">
                <h2 className="mb-3 font-mono text-2xl font-semibold text-accent">
                  // dutch_auction
                </h2>
                <p className="mb-4 text-lg text-text-secondary">
                  A descending-price auction on Solana. The seller sets a
                  start price that linearly decreases to an end price over a
                  time window. Buyers can purchase at the current price at any
                  moment &mdash; first come, first served.
                </p>
                <div className="rounded border border-border bg-bg-tertiary p-4 font-mono text-sm text-text-muted">
                  <p className="text-accent">{">"} price = start_price - (elapsed / duration) * price_range</p>
                  <p className="mt-1">// price drops every second until someone buys</p>
                </div>
              </div>

              {/* Stack */}
              <div className="rounded-lg border border-border bg-bg-secondary p-6">
                <h3 className="mb-3 font-mono text-sm font-semibold text-accent">
                  # stack
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      name: "Anchor",
                      desc: "Solana framework",
                      href: "https://www.anchor-lang.com/",
                    },
                    {
                      name: "@solana/kit",
                      desc: "Modern SDK",
                      href: "https://github.com/anza-xyz/kit",
                    },
                    {
                      name: "Codama",
                      desc: "Client gen",
                      href: "https://github.com/codama-idl/codama",
                    },
                    {
                      name: "@solana/react",
                      desc: "Wallet hooks",
                      href: "https://github.com/anza-xyz/kit",
                    },
                  ].map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-border bg-bg-tertiary px-3 py-2 text-center transition-all duration-200 hover:border-accent hover:-translate-y-0.5"
                    >
                      <p className="font-mono text-sm font-medium text-text">
                        {item.name}
                      </p>
                      <p className="text-xs text-text-muted">{item.desc}</p>
                    </a>
                  ))}
                </div>
              </div>

              {/* How to test */}
              <div className="rounded-lg border border-border bg-bg-secondary p-6">
                <h3 className="mb-4 font-mono text-sm font-semibold text-accent">
                  # how_to_test
                </h3>
                <ol className="space-y-3">
                  {[
                    {
                      step: "Get devnet SOL",
                      detail:
                        "Grab free tokens from the faucet for gas fees.",
                      link: {
                        label: "faucet.solana.com",
                        href: "https://faucet.solana.com/",
                      },
                    },
                    {
                      step: "Create SPL tokens",
                      detail:
                        'Use "spl-token create-token" and "spl-token mint" to create test tokens on devnet.',
                    },
                    {
                      step: "Connect your wallet",
                      detail:
                        "Use Phantom, Solflare, or any Solana wallet set to Devnet.",
                    },
                    {
                      step: "Create an auction (Sell tab)",
                      detail:
                        "Enter mint addresses, amount, price range, and duration. Tokens are escrowed on-chain.",
                    },
                    {
                      step: "Watch the price drop (Buy tab)",
                      detail:
                        "The price decreases linearly every second. Buy at any moment for the current price.",
                    },
                    {
                      step: "Buy or cancel",
                      detail:
                        "Buyers purchase at the live price. Sellers can cancel before the auction starts.",
                    },
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-accent/40 font-mono text-xs font-semibold text-accent">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-mono text-sm font-medium text-text">
                          {item.step}
                        </p>
                        <p className="text-sm text-text-muted">
                          {item.detail}
                          {item.link && (
                            <>
                              {" "}
                              <a
                                href={item.link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent underline hover:text-accent-dim"
                              >
                                {item.link.label}
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Connect CTA */}
              <div className="flex justify-center">
                <WalletButton />
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Tab switcher */}
              <div className="flex rounded-lg border border-border bg-bg-secondary p-1">
                <button
                  onClick={() => setTab("sell")}
                  className={`flex-1 cursor-pointer rounded-md px-4 py-2 font-mono text-sm font-medium transition-all ${
                    tab === "sell"
                      ? "bg-accent text-bg"
                      : "text-text-secondary hover:text-accent"
                  }`}
                >
                  {">"} sell
                </button>
                <button
                  onClick={() => setTab("buy")}
                  className={`flex-1 cursor-pointer rounded-md px-4 py-2 font-mono text-sm font-medium transition-all ${
                    tab === "buy"
                      ? "bg-accent text-bg"
                      : "text-text-secondary hover:text-accent"
                  }`}
                >
                  {">"} buy
                </button>
              </div>

              {/* Tab content */}
              {tab === "sell" && <CreateAuction />}
              {tab === "buy" && <AuctionList />}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-accent/20 py-6">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 font-mono text-sm text-text-muted">
          <span>$ dutch_auction v0.1.0</span>
          <div className="flex gap-4">
            <a
              href="https://github.com/moviendome"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary transition-colors hover:text-accent"
            >
              GitHub
            </a>
            <a
              href="https://moviendo.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary transition-colors hover:text-accent"
            >
              Blog
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
