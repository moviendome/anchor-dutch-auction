"use client";

import { useState, useRef, useEffect } from "react";
import { useWallets, useConnect, useDisconnect } from "@wallet-standard/react";
import { useSelectedWalletAccount } from "@solana/react";
import type { UiWallet, UiWalletAccount } from "@wallet-standard/ui";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function ConnectOption({
  wallet,
  onConnect,
}: {
  wallet: UiWallet;
  onConnect: (account: UiWalletAccount) => void;
}) {
  const [isConnecting, connect] = useConnect(wallet);

  return (
    <button
      disabled={isConnecting}
      onClick={async () => {
        try {
          const accounts = await connect();
          if (accounts[0]) onConnect(accounts[0]);
        } catch {
          // connection rejected
        }
      }}
      className="flex w-full items-center gap-3 rounded px-3 py-2 text-left font-mono text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-accent disabled:opacity-50"
    >
      {wallet.icon && (
        <img src={wallet.icon} alt="" className="h-5 w-5 rounded" />
      )}
      <span>{isConnecting ? "Connecting..." : wallet.name}</span>
    </button>
  );
}

function DisconnectButton({
  wallet,
  onDisconnect,
}: {
  wallet: UiWallet;
  onDisconnect: () => void;
}) {
  const [isDisconnecting, disconnect] = useDisconnect(wallet);

  return (
    <button
      disabled={isDisconnecting}
      onClick={async () => {
        try {
          await disconnect();
        } catch {
          // ignore
        }
        onDisconnect();
      }}
      className="w-full rounded px-3 py-2 text-left font-mono text-sm text-danger transition-colors hover:bg-danger-bg disabled:opacity-50"
    >
      {isDisconnecting ? "Disconnecting..." : "Disconnect"}
    </button>
  );
}

export default function WalletButton() {
  const wallets = useWallets();
  const [selectedAccount, setSelectedAccount] = useSelectedWalletAccount();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const connectedWallet = selectedAccount
    ? wallets.find((w) =>
        w.accounts.some((a) => a.address === selectedAccount.address)
      )
    : null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selectedAccount) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded border border-accent/40 bg-bg-tertiary px-3 py-1.5 font-mono text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-bg"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          {truncateAddress(selectedAccount.address)}
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-bg-secondary p-2 shadow-lg">
            {connectedWallet ? (
              <DisconnectButton
                wallet={connectedWallet}
                onDisconnect={() => {
                  setSelectedAccount(undefined);
                  setIsOpen(false);
                }}
              />
            ) : (
              <button
                onClick={() => {
                  setSelectedAccount(undefined);
                  setIsOpen(false);
                }}
                className="w-full rounded px-3 py-2 text-left font-mono text-sm text-danger transition-colors hover:bg-danger-bg"
              >
                Disconnect
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded bg-accent px-4 py-1.5 font-mono text-sm font-semibold text-bg transition-colors hover:bg-accent-dim"
      >
        Connect
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-accent/30 bg-bg-secondary p-2 shadow-lg">
          <p className="mb-2 px-3 py-1 font-mono text-xs text-text-muted">
            Select wallet
          </p>
          {wallets.length === 0 && (
            <p className="px-3 py-2 text-sm text-text-muted">
              No wallets found. Install Phantom or Solflare.
            </p>
          )}
          {wallets.map((wallet) => (
            <ConnectOption
              key={wallet.name}
              wallet={wallet}
              onConnect={(account) => {
                setSelectedAccount(account);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
