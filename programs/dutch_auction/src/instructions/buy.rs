use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use crate::error::AuctionError;
use crate::state::Auction;
use crate::{transfer_checked_cpi, transfer_checked_from_pda};

pub fn buy(ctx: Context<BuyCtx>, max_price: u64) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;
    let auction = &ctx.accounts.auction;

    require!(current_time >= auction.start_time, AuctionError::AuctionNotStarted);
    require!(current_time < auction.end_time, AuctionError::AuctionEnded);

    let elapsed = current_time.checked_sub(auction.start_time).ok_or(AuctionError::Overflow)?;
    let duration = auction.end_time.checked_sub(auction.start_time).ok_or(AuctionError::Overflow)?;
    let price_range = auction.start_price.checked_sub(auction.end_price).ok_or(AuctionError::Overflow)?;

    let price_decrease: u64 = (price_range as u128)
        .checked_mul(elapsed as u128)
        .ok_or(AuctionError::Overflow)?
        .checked_div(duration as u128)
        .ok_or(AuctionError::Overflow)?
        .try_into()
        .map_err(|_| error!(AuctionError::Overflow))?;

    let current_price = auction.start_price.checked_sub(price_decrease).ok_or(AuctionError::Overflow)?;

    require!(current_price <= max_price, AuctionError::PriceExceedsMax);

    let buy_amount: u64 = (auction.sell_amount as u128)
        .checked_mul(current_price as u128)
        .ok_or(AuctionError::Overflow)?
        .checked_div(10u128.pow(ctx.accounts.sell_mint.decimals as u32))
        .ok_or(AuctionError::Overflow)?
        .try_into()
        .map_err(|_| error!(AuctionError::Overflow))?;

    require!(buy_amount > 0, AuctionError::InvalidAmount);

    transfer_checked_cpi(
        &ctx.accounts.buyer_buy_ata.to_account_info(),
        &ctx.accounts.seller_buy_ata.to_account_info(),
        &ctx.accounts.buy_mint.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.token_program.to_account_info(),
        buy_amount,
        ctx.accounts.buy_mint.decimals,
    )?;

    let seller_key = auction.seller.key();
    let sell_mint_key = auction.sell_mint.key();
    let seeds = &[
        b"auction",
        seller_key.as_ref(),
        sell_mint_key.as_ref(),
        &[auction.bump],
    ];

    transfer_checked_from_pda(
        &ctx.accounts.auction_sell_ata.to_account_info(),
        &ctx.accounts.buyer_sell_ata.to_account_info(),
        &ctx.accounts.sell_mint.to_account_info(),
        &ctx.accounts.auction.to_account_info(),
        &ctx.accounts.token_program.to_account_info(),
        auction.sell_amount,
        ctx.accounts.sell_mint.decimals,
        &[seeds],
    )?;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.auction_sell_ata.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.auction.to_account_info(),
        },
        &[seeds],
    ))?;

    Ok(())
}

#[derive(Accounts)]
pub struct BuyCtx<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Validated via auction.seller constraint
    #[account(mut)]
    pub seller: AccountInfo<'info>,

    pub sell_mint: InterfaceAccount<'info, Mint>,
    pub buy_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = seller,
        seeds = [b"auction", seller.key().as_ref(), sell_mint.key().as_ref()],
        bump = auction.bump,
        has_one = seller,
        has_one = sell_mint,
        has_one = buy_mint,
    )]
    pub auction: Account<'info, Auction>,

    #[account(
        mut,
        seeds = [b"auction_sell_ata", auction.key().as_ref()],
        bump,
        constraint = auction_sell_ata.mint == sell_mint.key(),
    )]
    pub auction_sell_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = buyer_buy_ata.mint == buy_mint.key(),
        constraint = buyer_buy_ata.owner == buyer.key(),
    )]
    pub buyer_buy_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = buyer_sell_ata.mint == sell_mint.key(),
        constraint = buyer_sell_ata.owner == buyer.key(),
    )]
    pub buyer_sell_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = seller_buy_ata.mint == buy_mint.key(),
        constraint = seller_buy_ata.owner == seller.key(),
    )]
    pub seller_buy_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}
