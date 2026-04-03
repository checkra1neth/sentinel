---
name: agentra-invest
description: Add liquidity to a Uniswap v3 pool on X Layer for passive yield
model: sonnet
version: 1.0.0
---

# /agentra invest

Add liquidity to a Uniswap v3 pool on X Layer through your Agentic Wallet. Specify a token pair, amount, and price range to earn swap fees from traders using the pool.

## Usage

```
/agentra invest <pair> <amount> <token> [--range <type>] [--fee-tier <bps>] [--dry-run]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `pair` | Yes | Token pair (e.g., `USDT/OKB`) |
| `amount` | Yes | Amount of one side to deposit (e.g., `50`) |
| `token` | Yes | Which token the amount is denominated in (e.g., `USDT`) |
| `--range` | No | Price range: `full`, `narrow`, `tight`, or custom `<lower>-<upper>` (default: `full`) |
| `--fee-tier` | No | Fee tier in basis points: `100`, `500`, `3000`, `10000` (default: auto-select) |
| `--dry-run` | No | Preview the position without executing |

### Examples

```bash
# Full-range LP with 50 USDT worth
/agentra invest USDT/OKB 50 USDT --range full

# Narrow range around current price, 0.3% fee tier
/agentra invest USDT/OKB 100 USDT --range narrow --fee-tier 3000

# Custom price range
/agentra invest USDT/OKB 50 USDT --range 4.50-5.50

# Preview position without executing
/agentra invest USDT/OKB 50 USDT --dry-run
```

## Step-by-Step Instructions

### Step 1: Check Wallet Balances

Verify your Agentic Wallet has sufficient tokens for the LP position:

**OnchainOS command:**

```
onchainos wallet balance --chain xlayer --token USDT
onchainos wallet balance --chain xlayer --token OKB
```

For a balanced LP position, you need both tokens. The skill calculates the optimal split.

### Step 2: Get Current Pool State

Fetch pool data to determine the current price and optimal range:

**Uniswap AI command:**

```
uniswap liquidity-planner pool-state \
  --chain xlayer \
  --pair USDT/OKB \
  --fee-tier 3000
```

Returns:

```
Pool: 0xABCD...1234
Current price: 1 OKB = 4.92 USDT
Current tick: -27650
Fee tier: 3000 (0.3%)
Liquidity: 1,245,000
TVL: $485,200
```

### Step 3: Calculate Position Parameters

Based on the range type:

- **Full range**: tickLower = -887220, tickUpper = 887220 (entire price spectrum)
- **Narrow**: +/- 10% from current price (e.g., 4.43 - 5.41 USDT/OKB)
- **Tight**: +/- 2% from current price (e.g., 4.82 - 5.02 USDT/OKB)
- **Custom**: User-specified price bounds converted to ticks

Calculate token amounts needed:

```
Position Plan
=============
  Pair: USDT/OKB (0.3% fee)
  Range: full
  Amount in: 50 USDT

  Token split:
    USDT: 25.00
    OKB: 5.08 (~25.00 USDT equivalent)

  Need to swap: 25 USDT -> 5.08 OKB
```

### Step 4: Swap for Balanced Position (if needed)

If you only hold one token, swap half to get a balanced position:

**OnchainOS command:**

```
onchainos dex-swap execute \
  --chain xlayer \
  --from 0x1E4a5963aBFD975d8c9021ce480b42188849D41d \
  --to OKB \
  --amount 25000000 \
  --slippage 0.5
```

### Step 5: Approve Tokens for Uniswap Router

Approve both tokens for the Uniswap v3 NonfungiblePositionManager:

**OnchainOS commands:**

```
# Approve USDT
onchainos wallet call \
  --chain xlayer \
  --to 0x1E4a5963aBFD975d8c9021ce480b42188849D41d \
  --function "approve(address,uint256)" \
  --args '["0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15", 25000000]'

# Approve OKB (if wrapped)
onchainos wallet call \
  --chain xlayer \
  --to <WOKB_ADDRESS> \
  --function "approve(address,uint256)" \
  --args '["0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15", 5080000000000000000]'
```

### Step 6: Add Liquidity via Uniswap AI

**Uniswap AI command:**

```
uniswap liquidity-planner add \
  --chain xlayer \
  --pair USDT/OKB \
  --fee-tier 3000 \
  --amount0 25000000 \
  --amount1 5080000000000000000 \
  --tick-lower -887220 \
  --tick-upper 887220 \
  --wallet agentic
```

Or via the `okx-defi-invest` skill:

```
onchainos defi-invest add-liquidity \
  --chain xlayer \
  --protocol uniswap-v3 \
  --pair USDT/OKB \
  --amount 50 \
  --range full
```

### Step 7: Confirm Position

```
LP Position Created!
====================
  Position NFT ID: 12345
  Pool: USDT/OKB (0.3% fee)
  Range: Full range
  Deposited:
    USDT: 25.00
    OKB: 5.08
  Total value: ~$50.00

  Estimated APR: ~14.1% (based on 24h volume)
  Fee accrual starts immediately.

  Track with: /agentra dashboard --full
  Remove with: uniswap liquidity-planner remove --position 12345
```

**Log the action:**

```
onchainos audit-log add \
  --action "invest" \
  --details "Added 50 USDT to USDT/OKB LP (full range, 0.3%)"
```

## Dry Run Mode

```
/agentra invest USDT/OKB 50 USDT --dry-run

DRY RUN -- No transactions will be executed
=============================================

  Pool: USDT/OKB (0.3% fee)
  TVL: $485,200
  Current price: 4.92 USDT/OKB

  Position plan:
    Range: Full range
    USDT in: 25.00
    OKB in: ~5.08
    Swap needed: 25 USDT -> OKB

  Estimated APR: ~14.1%
  Estimated daily fees: $0.019

  To execute, run without --dry-run
```

## Range Types Explained

| Range | Description | APR | Risk |
|-------|-------------|-----|------|
| `full` | Entire price spectrum. Never goes out of range. | Lower | Lowest IL |
| `narrow` | +/- 10% from current price | Medium | Medium IL |
| `tight` | +/- 2% from current price | Highest | Highest IL, needs monitoring |
| Custom | User-defined price bounds | Varies | Depends on range width |

IL = Impermanent Loss

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Insufficient balance` | Not enough tokens for LP deposit | Swap or acquire more tokens |
| `Pool not found` | No pool for that pair and fee tier | Check with `/agentra pools` first |
| `Price out of range` | Custom range invalid | Ensure lower < current < upper |
| `Approval failed` | Token approve transaction failed | Retry |

## OnchainOS Skills Used

- `okx-defi-invest` -- Search pools and add liquidity
- `okx-dex-swap` -- Swap for balanced position
- `okx-agentic-wallet` -- Sign all transactions
- `okx-audit-log` -- Record investment actions

## Uniswap AI Skills Used

- `liquidity-planner` -- Get pool state, calculate tick ranges, add/remove liquidity
