use anchor_lang::prelude::*;

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
