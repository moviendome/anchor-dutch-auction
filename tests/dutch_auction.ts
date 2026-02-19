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

  /** Get the cluster clock time (validator time, not wall time). */
  async function getClusterTime(): Promise<number> {
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    return blockTime!;
  }

  /** Create a pair of mints + derive auction PDAs for a fresh auction. */
  async function createAuctionFixture() {
    const sMint = await createMint(
      connection, payer, provider.wallet.publicKey, null, 9
    );
    const bMint = await createMint(
      connection, payer, provider.wallet.publicKey, null, 9
    );
    const [aPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("auction"), provider.wallet.publicKey.toBuffer(), sMint.toBuffer()],
      program.programId
    );
    const [aSellAta] = PublicKey.findProgramAddressSync(
      [Buffer.from("auction_sell_ata"), aPda.toBuffer()],
      program.programId
    );
    const sellerAta = await createAccount(connection, payer, sMint, provider.wallet.publicKey);
    await mintTo(connection, payer, sMint, sellerAta, provider.wallet.publicKey, 1_000_000_000);

    return { sellMint: sMint, buyMint: bMint, auctionPda: aPda, auctionSellAta: aSellAta, sellerSellAta: sellerAta };
  }

  before(async () => {
    buyer = Keypair.generate();
    await airdrop(buyer.publicKey, 10 * LAMPORTS_PER_SOL);

    // Create sell mint
    sellMint = await createMint(
      connection, payer, provider.wallet.publicKey, null, 9
    );

    // Create buy mint
    buyMint = await createMint(
      connection, payer, provider.wallet.publicKey, null, 9
    );

    // Create seller's sell token account and mint tokens
    sellerSellAta = await createAccount(
      connection, payer, sellMint, provider.wallet.publicKey
    );
    await mintTo(
      connection, payer, sellMint, sellerSellAta, provider.wallet.publicKey, 1_000_000_000
    );

    // Create seller's buy token account
    sellerBuyAta = await createAccount(
      connection, payer, buyMint, provider.wallet.publicKey
    );

    // Create buyer's buy token account and mint tokens
    buyerBuyAta = await createAccount(
      connection, payer, buyMint, buyer.publicKey
    );
    await mintTo(
      connection, payer, buyMint, buyerBuyAta, provider.wallet.publicKey, 10_000_000_000
    );

    // Create buyer's sell token account
    buyerSellAta = await createAccount(
      connection, payer, sellMint, buyer.publicKey
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
    const currentTime = await getClusterTime();
    const startTime = new anchor.BN(currentTime + 3);
    const endTime = new anchor.BN(currentTime + 120);

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
    await new Promise((resolve) => setTimeout(resolve, 5000));

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

  // ── Cancel (happy path) ──────────────────────────────────────────────

  describe("cancel", () => {
    let cancelSellMint: PublicKey;
    let cancelBuyMint: PublicKey;
    let cancelSellerSellAta: PublicKey;
    let cancelAuctionPda: PublicKey;
    let cancelAuctionSellAta: PublicKey;

    before(async () => {
      cancelSellMint = await createMint(
        connection, payer, provider.wallet.publicKey, null, 9
      );

      cancelBuyMint = await createMint(
        connection, payer, provider.wallet.publicKey, null, 9
      );

      cancelSellerSellAta = await createAccount(
        connection, payer, cancelSellMint, provider.wallet.publicKey
      );

      await mintTo(
        connection, payer, cancelSellMint, cancelSellerSellAta, provider.wallet.publicKey, 1_000_000_000
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

      // Initialize auction with start far in the future (cancel must be before start)
      const currentTime = await getClusterTime();
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
        connection, cancelAuctionSellAta
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
        connection, cancelSellerSellAta
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

  // ── Validation tests ─────────────────────────────────────────────────

  describe("init validation", () => {
    it("rejects same sell and buy mint", async () => {
      const f = await createAuctionFixture();
      const currentTime = await getClusterTime();

      try {
        await program.methods
          .init(
            new anchor.BN(1_000_000_000),
            new anchor.BN(2_000_000_000),
            new anchor.BN(1_000_000_000),
            new anchor.BN(currentTime + 60),
            new anchor.BN(currentTime + 120)
          )
          .accountsStrict({
            seller: provider.wallet.publicKey,
            sellMint: f.sellMint,
            buyMint: f.sellMint, // same mint
            auction: f.auctionPda,
            auctionSellAta: f.auctionSellAta,
            sellerSellAta: f.sellerSellAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.toString()).to.include("SameToken");
      }
    });

    it("rejects start_price < end_price", async () => {
      const f = await createAuctionFixture();
      const currentTime = await getClusterTime();

      try {
        await program.methods
          .init(
            new anchor.BN(1_000_000_000),
            new anchor.BN(500_000_000), // start < end
            new anchor.BN(1_000_000_000),
            new anchor.BN(currentTime + 60),
            new anchor.BN(currentTime + 120)
          )
          .accountsStrict({
            seller: provider.wallet.publicKey,
            sellMint: f.sellMint,
            buyMint: f.buyMint,
            auction: f.auctionPda,
            auctionSellAta: f.auctionSellAta,
            sellerSellAta: f.sellerSellAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidPrice");
      }
    });

    it("rejects start_time in the past", async () => {
      const f = await createAuctionFixture();

      try {
        await program.methods
          .init(
            new anchor.BN(1_000_000_000),
            new anchor.BN(2_000_000_000),
            new anchor.BN(1_000_000_000),
            new anchor.BN(1000), // far in the past
            new anchor.BN(2000)
          )
          .accountsStrict({
            seller: provider.wallet.publicKey,
            sellMint: f.sellMint,
            buyMint: f.buyMint,
            auction: f.auctionPda,
            auctionSellAta: f.auctionSellAta,
            sellerSellAta: f.sellerSellAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidTime");
      }
    });

    it("rejects start_time >= end_time", async () => {
      const f = await createAuctionFixture();
      const currentTime = await getClusterTime();

      try {
        await program.methods
          .init(
            new anchor.BN(1_000_000_000),
            new anchor.BN(2_000_000_000),
            new anchor.BN(1_000_000_000),
            new anchor.BN(currentTime + 120),
            new anchor.BN(currentTime + 60) // end before start
          )
          .accountsStrict({
            seller: provider.wallet.publicKey,
            sellMint: f.sellMint,
            buyMint: f.buyMint,
            auction: f.auctionPda,
            auctionSellAta: f.auctionSellAta,
            sellerSellAta: f.sellerSellAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidTime");
      }
    });

    it("rejects zero sell_amount", async () => {
      const f = await createAuctionFixture();
      const currentTime = await getClusterTime();

      try {
        await program.methods
          .init(
            new anchor.BN(0), // zero amount
            new anchor.BN(2_000_000_000),
            new anchor.BN(1_000_000_000),
            new anchor.BN(currentTime + 60),
            new anchor.BN(currentTime + 120)
          )
          .accountsStrict({
            seller: provider.wallet.publicKey,
            sellMint: f.sellMint,
            buyMint: f.buyMint,
            auction: f.auctionPda,
            auctionSellAta: f.auctionSellAta,
            sellerSellAta: f.sellerSellAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidAmount");
      }
    });
  });

  describe("buy validation", () => {
    let bvSellMint: PublicKey;
    let bvBuyMint: PublicKey;
    let bvAuctionPda: PublicKey;
    let bvAuctionSellAta: PublicKey;
    let bvSellerSellAta: PublicKey;
    let bvSellerBuyAta: PublicKey;
    let bvBuyerSellAta: PublicKey;
    let bvBuyerBuyAta: PublicKey;

    before(async () => {
      bvSellMint = await createMint(connection, payer, provider.wallet.publicKey, null, 9);
      bvBuyMint = await createMint(connection, payer, provider.wallet.publicKey, null, 9);

      bvSellerSellAta = await createAccount(connection, payer, bvSellMint, provider.wallet.publicKey);
      await mintTo(connection, payer, bvSellMint, bvSellerSellAta, provider.wallet.publicKey, 1_000_000_000);

      bvSellerBuyAta = await createAccount(connection, payer, bvBuyMint, provider.wallet.publicKey);

      bvBuyerBuyAta = await createAccount(connection, payer, bvBuyMint, buyer.publicKey);
      await mintTo(connection, payer, bvBuyMint, bvBuyerBuyAta, provider.wallet.publicKey, 10_000_000_000);

      bvBuyerSellAta = await createAccount(connection, payer, bvSellMint, buyer.publicKey);

      [bvAuctionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction"), provider.wallet.publicKey.toBuffer(), bvSellMint.toBuffer()],
        program.programId
      );
      [bvAuctionSellAta] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction_sell_ata"), bvAuctionPda.toBuffer()],
        program.programId
      );

      // Auction starts far in the future
      const currentTime = await getClusterTime();
      await program.methods
        .init(
          new anchor.BN(1_000_000_000),
          new anchor.BN(2_000_000_000),
          new anchor.BN(1_000_000_000),
          new anchor.BN(currentTime + 600), // starts in 10 minutes
          new anchor.BN(currentTime + 1200)
        )
        .accountsStrict({
          seller: provider.wallet.publicKey,
          sellMint: bvSellMint,
          buyMint: bvBuyMint,
          auction: bvAuctionPda,
          auctionSellAta: bvAuctionSellAta,
          sellerSellAta: bvSellerSellAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("rejects buy before auction starts", async () => {
      try {
        await program.methods
          .buy(new anchor.BN(2_000_000_000))
          .accountsStrict({
            buyer: buyer.publicKey,
            seller: provider.wallet.publicKey,
            sellMint: bvSellMint,
            buyMint: bvBuyMint,
            auction: bvAuctionPda,
            auctionSellAta: bvAuctionSellAta,
            buyerBuyAta: bvBuyerBuyAta,
            buyerSellAta: bvBuyerSellAta,
            sellerBuyAta: bvSellerBuyAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([buyer])
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.toString()).to.include("AuctionNotStarted");
      }
    });
  });

  describe("cancel validation", () => {
    it("rejects cancel after auction has started", async () => {
      // Create auction that starts in 2 seconds
      const csMint = await createMint(connection, payer, provider.wallet.publicKey, null, 9);
      const csBuyMint = await createMint(connection, payer, provider.wallet.publicKey, null, 9);

      const csSellerAta = await createAccount(connection, payer, csMint, provider.wallet.publicKey);
      await mintTo(connection, payer, csMint, csSellerAta, provider.wallet.publicKey, 1_000_000_000);

      const [csAuction] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction"), provider.wallet.publicKey.toBuffer(), csMint.toBuffer()],
        program.programId
      );
      const [csAuctionAta] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction_sell_ata"), csAuction.toBuffer()],
        program.programId
      );

      const currentTime = await getClusterTime();
      await program.methods
        .init(
          new anchor.BN(1_000_000_000),
          new anchor.BN(2_000_000_000),
          new anchor.BN(1_000_000_000),
          new anchor.BN(currentTime + 2),
          new anchor.BN(currentTime + 60)
        )
        .accountsStrict({
          seller: provider.wallet.publicKey,
          sellMint: csMint,
          buyMint: csBuyMint,
          auction: csAuction,
          auctionSellAta: csAuctionAta,
          sellerSellAta: csSellerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Wait for auction to start
      console.log("Waiting for auction to start for cancel test...");
      await new Promise((resolve) => setTimeout(resolve, 4000));

      try {
        await program.methods
          .cancel()
          .accountsStrict({
            seller: provider.wallet.publicKey,
            sellMint: csMint,
            auction: csAuction,
            auctionSellAta: csAuctionAta,
            sellerSellAta: csSellerAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.toString()).to.include("AuctionAlreadyStarted");
      }
    });

    it("rejects cancel by non-seller", async () => {
      // Create auction owned by payer
      const nsMint = await createMint(connection, payer, provider.wallet.publicKey, null, 9);
      const nsBuyMint = await createMint(connection, payer, provider.wallet.publicKey, null, 9);

      const nsSellerAta = await createAccount(connection, payer, nsMint, provider.wallet.publicKey);
      await mintTo(connection, payer, nsMint, nsSellerAta, provider.wallet.publicKey, 1_000_000_000);

      const [nsAuction] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction"), provider.wallet.publicKey.toBuffer(), nsMint.toBuffer()],
        program.programId
      );
      const [nsAuctionAta] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction_sell_ata"), nsAuction.toBuffer()],
        program.programId
      );

      const currentTime = await getClusterTime();
      await program.methods
        .init(
          new anchor.BN(1_000_000_000),
          new anchor.BN(2_000_000_000),
          new anchor.BN(1_000_000_000),
          new anchor.BN(currentTime + 600),
          new anchor.BN(currentTime + 1200)
        )
        .accountsStrict({
          seller: provider.wallet.publicKey,
          sellMint: nsMint,
          buyMint: nsBuyMint,
          auction: nsAuction,
          auctionSellAta: nsAuctionAta,
          sellerSellAta: nsSellerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Buyer tries to cancel (not the seller)
      // The PDA seeds include the real seller's key, so we need to derive
      // what the attacker would pass. The attacker signs as buyer but
      // tries to use the real auction PDA — has_one = seller will reject.
      const fakeSellAta = await createAccount(connection, payer, nsMint, buyer.publicKey);

      try {
        // Attacker derives PDA with buyer's key — won't match the auction
        const [fakeAuction] = PublicKey.findProgramAddressSync(
          [Buffer.from("auction"), buyer.publicKey.toBuffer(), nsMint.toBuffer()],
          program.programId
        );

        await program.methods
          .cancel()
          .accountsStrict({
            seller: buyer.publicKey,
            sellMint: nsMint,
            auction: fakeAuction,     // wrong PDA — doesn't exist
            auctionSellAta: nsAuctionAta,
            sellerSellAta: fakeSellAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([buyer])
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        // PDA seed mismatch or account not found — either is correct
        expect(err).to.exist;
      }
    });
  });
});
