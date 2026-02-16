use anchor_lang::prelude::*;

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
