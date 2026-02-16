use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::AuctionError;
use crate::state::Auction;
use crate::transfer;

pub fn init(
    ctx: Context<InitCtx>,
    sell_amount: u64,
    start_price: u64,
    end_price: u64,
    start_time: u64,
    end_time: u64,
) -> Result<()> {
    require_keys_neq!(
        ctx.accounts.sell_mint.key(),
        ctx.accounts.buy_mint.key(),
        AuctionError::SameToken
    );

    require!(start_price >= end_price, AuctionError::InvalidPrice);

    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;
    require!(
        current_time <= start_time && start_time < end_time,
        AuctionError::InvalidTime
    );

    require!(sell_amount > 0, AuctionError::InvalidAmount);

    transfer(
        &ctx.accounts.seller_sell_ata.to_account_info(),
        &ctx.accounts.auction_sell_ata.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        &ctx.accounts.token_program.to_account_info(),
        sell_amount,
    )?;

    let auction = &mut ctx.accounts.auction;
    auction.seller = ctx.accounts.seller.key();
    auction.sell_mint = ctx.accounts.sell_mint.key();
    auction.buy_mint = ctx.accounts.buy_mint.key();
    auction.sell_amount = sell_amount;
    auction.start_price = start_price;
    auction.end_price = end_price;
    auction.start_time = start_time;
    auction.end_time = end_time;
    auction.bump = ctx.bumps.auction;

    Ok(())
}

#[derive(Accounts)]
pub struct InitCtx<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub sell_mint: Account<'info, Mint>,
    pub buy_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = seller,
        space = 8 + Auction::INIT_SPACE,
        seeds = [b"auction", seller.key().as_ref(), sell_mint.key().as_ref()],
        bump,
    )]
    pub auction: Account<'info, Auction>,

    #[account(
        init,
        payer = seller,
        token::mint = sell_mint,
        token::authority = auction,
        seeds = [b"auction_sell_ata", auction.key().as_ref()],
        bump,
    )]
    pub auction_sell_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = seller_sell_ata.mint == sell_mint.key(),
        constraint = seller_sell_ata.owner == seller.key(),
    )]
    pub seller_sell_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
