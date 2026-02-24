# Dutch Auction Frontend

A Next.js frontend for the Dutch Auction Solana program. Create descending-price token auctions, browse live auctions, and buy at the current price.

Built as part of the [Cyfrin Updraft](https://updraft.cyfrin.io/) Rust & Solana course.

## Stack

- [@solana/kit](https://github.com/anza-xyz/solana-web3.js) — Modern Solana SDK (v6)
- [@solana/react](https://github.com/anza-xyz/solana-web3.js) — Kit-native wallet hooks
- [@wallet-standard/react](https://github.com/wallet-standard/wallet-standard) — Wallet discovery
- [Codama](https://github.com/codama-idl/codama) — Generated typed program client
- [Next.js](https://nextjs.org/) — React framework
- [Tailwind CSS](https://tailwindcss.com/) — Styling

No legacy `@solana/web3.js` v1 or `@solana/wallet-adapter-*` dependencies.

## Program

Deployed on Devnet: [`BgU4SppsedWxpVqyAGyRkebCpYAZZoFsyWvNL3kgxT5u`](https://explorer.solana.com/address/BgU4SppsedWxpVqyAGyRkebCpYAZZoFsyWvNL3kgxT5u?cluster=devnet)

## Setup

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Regenerating the Program Client

If the on-chain program changes, regenerate the typed client from the IDL:

```sh
cd ..
node codama.mjs
```

This reads `target/idl/dutch_auction.json` and outputs Kit-native TypeScript to `app/generated/`.

## Usage

1. Get devnet SOL from [faucet.solana.com](https://faucet.solana.com/)
2. Create two SPL tokens on devnet (`spl-token create-token` + `spl-token create-account` + `spl-token mint`)
3. Connect a Solana wallet (Phantom, Solflare, etc.) set to Devnet
4. **Sell tab**: create an auction specifying sell/buy mints, amount, price range, and duration
5. **Buy tab**: browse active auctions with live price countdown and buy at the current price
6. Sellers can cancel auctions before the start time

## Links

- [Blog Post](https://moviendo.me)
- [GitHub](https://github.com/moviendome)
