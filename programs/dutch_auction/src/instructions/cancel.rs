use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use crate::error::AuctionError;
use crate::state::Auction;
use crate::transfer_checked_from_pda;

pub fn cancel(ctx: Context<CancelCtx>) -> Result<()> {
    let auction = &ctx.accounts.auction;

    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;
    require!(
        current_time < auction.start_time,
        AuctionError::AuctionAlreadyStarted
    );

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
        &ctx.accounts.seller_sell_ata.to_account_info(),
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
pub struct CancelCtx<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub sell_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = seller,
        seeds = [b"auction", seller.key().as_ref(), sell_mint.key().as_ref()],
        bump = auction.bump,
        has_one = seller,
        has_one = sell_mint,
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
        constraint = seller_sell_ata.mint == sell_mint.key(),
        constraint = seller_sell_ata.owner == seller.key(),
    )]
    pub seller_sell_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}
