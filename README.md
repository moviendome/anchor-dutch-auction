# Dutch Auction - Solana Anchor Program

<p align="center">
  <img src="./assets/dutch-auction-banner.png" alt="Dutch Auction - Decreasing Price Token Auction" width="400">
</p>

A Dutch auction program built with Anchor framework for Solana. In a Dutch auction, the seller sets a starting price that decreases linearly over time until a buyer purchases at the current price.

## Overview

The Dutch Auction program implements an SPL token auction mechanism:

1. **Init**: Seller creates an auction, depositing sell tokens into escrow
2. **Buy**: Buyer purchases at the current (decreasing) price, exchanging buy tokens for sell tokens
3. **Cancel**: Seller cancels the auction and reclaims sell tokens

This is part of the [Cyfrin Solana Course](https://updraft.cyfrin.io/) - Section 6.

## Project Structure

```
dutch_auction/
├── programs/dutch_auction/src/
│   ├── lib.rs                 # Program entry point + transfer helpers
│   ├── error.rs               # Custom error codes
│   ├── state.rs               # Auction account structure
│   └── instructions/
│       ├── mod.rs             # Module exports
│       ├── init.rs            # Init instruction
│       ├── buy.rs             # Buy instruction
│       └── cancel.rs          # Cancel instruction
├── tests/
│   └── dutch_auction.ts       # TypeScript tests
└── README.md
```

## Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- [Node.js](https://nodejs.org/) and Yarn

## Setup

```bash
# Sync program keys
anchor keys sync

# Build the program
anchor build

# Run tests
anchor test
```

## Program Instructions

### 1. Init

Creates a new auction and transfers sell tokens into escrow.

**Parameters:**
- `sell_amount: u64` - Amount of sell tokens to auction (must be > 0)
- `start_price: u64` - Starting price (must be >= end_price)
- `end_price: u64` - Minimum price at auction end
- `start_time: u64` - Unix timestamp when auction starts (must be >= current time)
- `end_time: u64` - Unix timestamp when auction ends (must be > start_time)

**Accounts:**
- `seller` (signer, mutable) - The account creating the auction
- `sell_mint` - Mint of the token being sold
- `buy_mint` - Mint of the token accepted as payment
- `auction` (PDA, mutable) - The auction state account
- `auction_sell_ata` (PDA, mutable) - Escrow token account for sell tokens
- `seller_sell_ata` (mutable) - Seller's sell token account
- `token_program` - SPL Token program
- `system_program` - System program

**Validations:**
- Sell token and buy token must be different (`SameToken`)
- Start price must be >= end price (`InvalidPrice`)
- Current time <= start time < end time (`InvalidTime`)
- Sell amount must be > 0 (`InvalidAmount`)

### 2. Buy

Purchases the auctioned tokens at the current price.

**Parameters:**
- `max_price: u64` - Maximum price the buyer is willing to pay

**Accounts:**
- `buyer` (signer, mutable) - The buyer
- `seller` (mutable) - The auction creator
- `sell_mint` - Mint of the token being sold
- `buy_mint` - Mint of the payment token
- `auction` (PDA, mutable) - The auction state account
- `auction_sell_ata` (PDA, mutable) - Escrow token account
- `buyer_buy_ata` (mutable) - Buyer's payment token account
- `buyer_sell_ata` (mutable) - Buyer's account for received tokens
- `seller_buy_ata` (mutable) - Seller's account for received payment
- `token_program` - SPL Token program

**Validations:**
- Auction must have started (`AuctionNotStarted`)
- Auction must not have ended (`AuctionEnded`)
- Current price must be <= max_price (`PriceExceedsMax`)
- Buy amount must be > 0 after calculation (`InvalidAmount`)

**Price Calculation:**
```
elapsed = current_time - start_time
duration = end_time - start_time
price_decrease = (start_price - end_price) * elapsed / duration
current_price = start_price - price_decrease
```

### 3. Cancel

Cancels the auction and returns sell tokens to the seller.

**Accounts:**
- `seller` (signer, mutable) - Must be the auction creator
- `sell_mint` - Mint of the sell token
- `auction` (PDA, mutable) - The auction state account
- `auction_sell_ata` (PDA, mutable) - Escrow token account
- `seller_sell_ata` (mutable) - Seller's token account to receive tokens back
- `token_program` - SPL Token program

## Code Walkthrough

### State: Auction Account

```rust
#[account]
#[derive(InitSpace)]
pub struct Auction {
    pub seller: Pubkey,
    pub sell_mint: Pubkey,
    pub buy_mint: Pubkey,
    pub sell_amount: u64,
    pub start_price: u64,
    pub end_price: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub bump: u8,
}
```

The Auction account stores:
- **seller**: Public key of the auction creator
- **sell_mint / buy_mint**: The two token mints involved
- **sell_amount**: Total tokens being sold
- **start_price / end_price**: Price range for linear decrease
- **start_time / end_time**: Auction time window
- **bump**: PDA bump seed for signing

### Custom Errors

```rust
#[error_code]
pub enum AuctionError {
    #[msg("Sell token and buy token must be different")]
    SameToken,
    #[msg("Start price must be greater than or equal to end price")]
    InvalidPrice,
    #[msg("Invalid time range")]
    InvalidTime,
    #[msg("Sell amount must be greater than 0")]
    InvalidAmount,
    #[msg("Auction has not started yet")]
    AuctionNotStarted,
    #[msg("Auction has ended")]
    AuctionEnded,
    #[msg("Price exceeds max price")]
    PriceExceedsMax,
    #[msg("Arithmetic overflow")]
    Overflow,
}
```

### Transfer Helpers (lib.rs)

```rust
pub fn transfer<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new(token_program.clone(), Transfer { from, to, authority }),
        amount,
    )
}

pub fn transfer_from_pda<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    amount: u64,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(token_program.clone(), Transfer { from, to, authority }, seeds),
        amount,
    )
}
```

Key difference:
- **transfer**: User signs (for buyer/seller transfers)
- **transfer_from_pda**: PDA signs with seeds (for escrow transfers)

### Init Instruction

```rust
pub fn init(ctx: Context<InitCtx>, sell_amount: u64, ...) -> Result<()> {
    // Validations
    require_keys_neq!(sell_mint, buy_mint, AuctionError::SameToken);
    require!(start_price >= end_price, AuctionError::InvalidPrice);
    require!(current_time <= start_time && start_time < end_time, AuctionError::InvalidTime);
    require!(sell_amount > 0, AuctionError::InvalidAmount);

    // Transfer sell tokens to escrow
    transfer(&seller_sell_ata, &auction_sell_ata, &seller, &token_program, sell_amount)?;

    // Store state
    auction.seller = seller.key();
    // ...
}
```

### Buy Instruction

```rust
pub fn buy(ctx: Context<BuyCtx>, max_price: u64) -> Result<()> {
    // Check timing
    require!(current_time >= auction.start_time, AuctionError::AuctionNotStarted);
    require!(current_time < auction.end_time, AuctionError::AuctionEnded);

    // Linear price decrease
    let current_price = start_price - (price_range * elapsed / duration);
    require!(current_price <= max_price, AuctionError::PriceExceedsMax);

    // Calculate buy amount (with zero-check to prevent free-token exploit)
    let buy_amount = sell_amount * current_price / 10^decimals;
    require!(buy_amount > 0, AuctionError::InvalidAmount);

    // Execute swaps
    transfer(&buyer_buy_ata, &seller_buy_ata, &buyer, ...);        // buyer pays
    transfer_from_pda(&auction_sell_ata, &buyer_sell_ata, ...);     // buyer receives

    // Close escrow account
    close_account(CpiContext::new_with_signer(...))?;
}
```

### Cancel Instruction

```rust
pub fn cancel(ctx: Context<CancelCtx>) -> Result<()> {
    // Return sell tokens to seller
    transfer_from_pda(&auction_sell_ata, &seller_sell_ata, ...);

    // Close escrow account
    close_account(CpiContext::new_with_signer(...))?;
}
```

## Testing

The test suite covers:

1. **Initialize auction**: Creates auction, verifies state, verifies token escrow
2. **Buy from auction**: Waits for start, buys at current price, verifies token swaps and account closure
3. **Cancel auction**: Creates separate auction, cancels it, verifies token return and account closure

### Running Tests

```bash
anchor test
```

### Expected Output

```
  dutch_auction
    ✔ initializes an auction
    ✔ buys from the auction
    cancel
      ✔ cancels an auction and returns tokens

  3 passing
```

## Key Learnings

### 1. PDA-Based Escrow

The auction uses two PDAs:

```rust
// Auction state PDA
seeds = [b"auction", seller.key().as_ref(), sell_mint.key().as_ref()]

// Escrow token account PDA
seeds = [b"auction_sell_ata", auction.key().as_ref()]
```

The auction PDA acts as the authority for the escrow token account, allowing the program to sign transfers via `CpiContext::new_with_signer`.

### 2. SPL Token Operations

Three key CPI operations used:

```rust
// Regular transfer (user signs)
token::transfer(CpiContext::new(...), amount)?;

// PDA transfer (program signs with seeds)
token::transfer(CpiContext::new_with_signer(..., seeds), amount)?;

// Close token account (return rent to seller)
close_account(CpiContext::new_with_signer(..., seeds))?;
```

### 3. Linear Price Decrease

The Dutch auction price formula using integer arithmetic with u128 intermediates to prevent overflow:

```rust
let price_decrease: u64 = (price_range as u128)
    .checked_mul(elapsed as u128)?
    .checked_div(duration as u128)?
    .try_into()?;  // Safe u128→u64 conversion
let current_price = start_price - price_decrease;
```

### 4. Account Constraints with has_one

Anchor's `has_one` constraint validates that an account field matches a provided account:

```rust
#[account(
    mut,
    close = seller,
    has_one = seller,      // auction.seller == seller.key()
    has_one = sell_mint,   // auction.sell_mint == sell_mint.key()
    has_one = buy_mint,    // auction.buy_mint == buy_mint.key()
)]
pub auction: Account<'info, Auction>,
```

### 5. Closing Accounts

Two account closure mechanisms:
- `close = seller` on the auction account returns rent to the seller
- `close_account` CPI closes the escrow token account

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Cyfrin Updraft - Solana Course](https://updraft.cyfrin.io/)
- [SPL Token Documentation](https://spl.solana.com/token)

## License

MIT
