import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DutchAuction } from "../target/types/dutch_auction";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("dutch_auction", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.dutchAuction as Program<DutchAuction>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  let sellMint: PublicKey;
  let buyMint: PublicKey;
  let sellerSellAta: PublicKey;
  let sellerBuyAta: PublicKey;
  let buyerSellAta: PublicKey;
  let buyerBuyAta: PublicKey;
  let buyer: Keypair;
  let auctionPda: PublicKey;
  let auctionSellAta: PublicKey;

  const sellAmount = new anchor.BN(1_000_000_000); // 1 token (9 decimals)
  const startPrice = new anchor.BN(2_000_000_000); // 2 buy tokens per sell token
  const endPrice = new anchor.BN(1_000_000_000); // 1 buy token per sell token

  async function airdrop(pubkey: PublicKey, lamports: number) {
    const sig = await connection.requestAirdrop(pubkey, lamports);
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature: sig,
      ...latestBlockhash,
    });
  }

  before(async () => {
    buyer = Keypair.generate();
    await airdrop(buyer.publicKey, 10 * LAMPORTS_PER_SOL);

    // Create sell mint
    sellMint = await createMint(
      connection,
      payer,
      provider.wallet.publicKey,
      null,
      9
    );

    // Create buy mint
    buyMint = await createMint(
      connection,
      payer,
      provider.wallet.publicKey,
      null,
      9
    );

    // Create seller's sell token account and mint tokens
    sellerSellAta = await createAccount(
      connection,
      payer,
      sellMint,
      provider.wallet.publicKey
    );
    await mintTo(
      connection,
      payer,
      sellMint,
      sellerSellAta,
      provider.wallet.publicKey,
      1_000_000_000
    );

    // Create seller's buy token account
    sellerBuyAta = await createAccount(
      connection,
      payer,
      buyMint,
      provider.wallet.publicKey
    );

    // Create buyer's buy token account and mint tokens
    buyerBuyAta = await createAccount(
      connection,
      payer,
      buyMint,
      buyer.publicKey
    );
    await mintTo(
      connection,
      payer,
      buyMint,
      buyerBuyAta,
      provider.wallet.publicKey,
      10_000_000_000
    );

    // Create buyer's sell token account
    buyerSellAta = await createAccount(
      connection,
      payer,
      sellMint,
      buyer.publicKey
    );

    // Derive auction PDA
    [auctionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("auction"),
        provider.wallet.publicKey.toBuffer(),
        sellMint.toBuffer(),
      ],
      program.programId
    );

    // Derive auction sell ATA
    [auctionSellAta] = PublicKey.findProgramAddressSync(
      [Buffer.from("auction_sell_ata"), auctionPda.toBuffer()],
      program.programId
    );
  });

  it("initializes an auction", async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = new anchor.BN(currentTime + 2);
    const endTime = new anchor.BN(currentTime + 60);

    await program.methods
      .init(sellAmount, startPrice, endPrice, startTime, endTime)
      .accountsStrict({
        seller: provider.wallet.publicKey,
        sellMint: sellMint,
        buyMint: buyMint,
        auction: auctionPda,
        auctionSellAta: auctionSellAta,
        sellerSellAta: sellerSellAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Verify auction state
    const auction = await program.account.auction.fetch(auctionPda);
    expect(auction.seller.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );
    expect(auction.sellMint.toBase58()).to.equal(sellMint.toBase58());
    expect(auction.buyMint.toBase58()).to.equal(buyMint.toBase58());
    expect(auction.sellAmount.toNumber()).to.equal(1_000_000_000);
    expect(auction.startPrice.toNumber()).to.equal(2_000_000_000);
    expect(auction.endPrice.toNumber()).to.equal(1_000_000_000);

    // Verify tokens were transferred to auction
    const auctionSellAccount = await getAccount(connection, auctionSellAta);
    expect(Number(auctionSellAccount.amount)).to.equal(1_000_000_000);

    // Verify seller's sell token account is empty
    const sellerSellAccount = await getAccount(connection, sellerSellAta);
    expect(Number(sellerSellAccount.amount)).to.equal(0);
  });

  it("buys from the auction", async () => {
    // Wait for auction to start
    console.log("Waiting for auction to start...");
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const maxPrice = new anchor.BN(2_000_000_000); // willing to pay up to start price

    const buyerBuyBefore = await getAccount(connection, buyerBuyAta);

    await program.methods
      .buy(maxPrice)
      .accountsStrict({
        buyer: buyer.publicKey,
        seller: provider.wallet.publicKey,
        sellMint: sellMint,
        buyMint: buyMint,
        auction: auctionPda,
        auctionSellAta: auctionSellAta,
        buyerBuyAta: buyerBuyAta,
        buyerSellAta: buyerSellAta,
        sellerBuyAta: sellerBuyAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    // Verify buyer received sell tokens
    const buyerSellAccount = await getAccount(connection, buyerSellAta);
    expect(Number(buyerSellAccount.amount)).to.equal(1_000_000_000);

    // Verify seller received buy tokens
    const sellerBuyAccount = await getAccount(connection, sellerBuyAta);
    expect(Number(sellerBuyAccount.amount)).to.be.greaterThan(0);

    // Verify buyer paid some buy tokens
    const buyerBuyAfter = await getAccount(connection, buyerBuyAta);
    expect(Number(buyerBuyAfter.amount)).to.be.lessThan(
      Number(buyerBuyBefore.amount)
    );

    // Verify auction account is closed
    try {
      await program.account.auction.fetch(auctionPda);
      expect.fail("Auction account should be closed");
    } catch (err) {
      // Expected: account does not exist
    }
  });

  describe("cancel", () => {
    let cancelSellMint: PublicKey;
    let cancelBuyMint: PublicKey;
    let cancelSellerSellAta: PublicKey;
    let cancelAuctionPda: PublicKey;
    let cancelAuctionSellAta: PublicKey;

    before(async () => {
      // Create new mints for cancel test
      cancelSellMint = await createMint(
        connection,
        payer,
        provider.wallet.publicKey,
        null,
        9
      );

      cancelBuyMint = await createMint(
        connection,
        payer,
        provider.wallet.publicKey,
        null,
        9
      );

      cancelSellerSellAta = await createAccount(
        connection,
        payer,
        cancelSellMint,
        provider.wallet.publicKey
      );

      await mintTo(
        connection,
        payer,
        cancelSellMint,
        cancelSellerSellAta,
        provider.wallet.publicKey,
        1_000_000_000
      );

      [cancelAuctionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("auction"),
          provider.wallet.publicKey.toBuffer(),
          cancelSellMint.toBuffer(),
        ],
        program.programId
      );

      [cancelAuctionSellAta] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction_sell_ata"), cancelAuctionPda.toBuffer()],
        program.programId
      );

      // Initialize auction
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = new anchor.BN(currentTime + 60);
      const endTime = new anchor.BN(currentTime + 120);

      await program.methods
        .init(
          new anchor.BN(1_000_000_000),
          new anchor.BN(2_000_000_000),
          new anchor.BN(1_000_000_000),
          startTime,
          endTime
        )
        .accountsStrict({
          seller: provider.wallet.publicKey,
          sellMint: cancelSellMint,
          buyMint: cancelBuyMint,
          auction: cancelAuctionPda,
          auctionSellAta: cancelAuctionSellAta,
          sellerSellAta: cancelSellerSellAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("cancels an auction and returns tokens", async () => {
      // Verify tokens are in auction
      const auctionSellAccount = await getAccount(
        connection,
        cancelAuctionSellAta
      );
      expect(Number(auctionSellAccount.amount)).to.equal(1_000_000_000);

      await program.methods
        .cancel()
        .accountsStrict({
          seller: provider.wallet.publicKey,
          sellMint: cancelSellMint,
          auction: cancelAuctionPda,
          auctionSellAta: cancelAuctionSellAta,
          sellerSellAta: cancelSellerSellAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Verify seller got tokens back
      const sellerSellAccount = await getAccount(
        connection,
        cancelSellerSellAta
      );
      expect(Number(sellerSellAccount.amount)).to.equal(1_000_000_000);

      // Verify auction account is closed
      try {
        await program.account.auction.fetch(cancelAuctionPda);
        expect.fail("Auction account should be closed");
      } catch (err) {
        // Expected: account does not exist
      }
    });
  });
});
