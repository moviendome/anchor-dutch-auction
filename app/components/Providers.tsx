"use client";

import { type ReactNode } from "react";
import { SelectedWalletAccountContextProvider } from "@solana/react";
import type { UiWallet } from "@wallet-standard/react";

const STORAGE_KEY = "dutch-auction-wallet";

function getSelectedWallet(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function storeSelectedWallet(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

function deleteSelectedWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SelectedWalletAccountContextProvider
      filterWallets={(wallet: UiWallet) => wallet.accounts.length > 0}
      stateSync={{
        getSelectedWallet,
        storeSelectedWallet,
        deleteSelectedWallet,
      }}
    >
      {children}
    </SelectedWalletAccountContextProvider>
  );
}
