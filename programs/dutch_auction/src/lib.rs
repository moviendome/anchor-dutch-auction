use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("BgU4SppsedWxpVqyAGyRkebCpYAZZoFsyWvNL3kgxT5u");

#[program]
pub mod dutch_auction {
    use super::*;

    pub fn init(
        ctx: Context<InitCtx>,
        sell_amount: u64,
        start_price: u64,
        end_price: u64,
        start_time: u64,
        end_time: u64,
    ) -> Result<()> {
        instructions::init::init(ctx, sell_amount, start_price, end_price, start_time, end_time)
    }

    pub fn buy(ctx: Context<BuyCtx>, max_price: u64) -> Result<()> {
        instructions::buy::buy(ctx, max_price)
    }

    pub fn cancel(ctx: Context<CancelCtx>) -> Result<()> {
        instructions::cancel::cancel(ctx)
    }
}

pub fn transfer<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new(
            token_program.clone(),
            Transfer {
                from: from.clone(),
                to: to.clone(),
                authority: authority.clone(),
            },
        ),
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
        CpiContext::new_with_signer(
            token_program.clone(),
            Transfer {
                from: from.clone(),
                to: to.clone(),
                authority: authority.clone(),
            },
            seeds,
        ),
        amount,
    )
}
