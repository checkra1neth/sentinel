---
name: agentra-pools
description: Discover and analyze Uniswap v3 pools on X Layer -- TVL, volume, fee tiers, and APR estimates
model: sonnet
version: 1.0.0
---

# /agentra pools

Discover and analyze Uniswap v3 liquidity pools on X Layer. View TVL, 24h volume, fee tier, and estimated APR to find the best opportunities for LP investment.

## Usage

```
/agentra pools [pair] [--sort <field>] [--min-tvl <amount>] [--fee-tier <bps>]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `pair` | No | Token pair to search (e.g., `USDT/OKB`). Omit to list all pools. |
| `--sort` | No | Sort by: `tvl`, `volume`, `apr`, `fees` (default: `tvl`) |
| `--min-tvl` | No | Minimum TVL in USD to filter results (default: 0) |
| `--fee-tier` | No | Filter by fee tier in basis points: `100`, `500`, `3000`, `10000` |

### Examples

```bash
# List all pools sorted by TVL
/agentra pools

# Search for USDT/OKB pools
/agentra pools USDT/OKB

# Find high-APR pools with >$10k TVL
/agentra pools --sort apr --min-tvl 10000

# Show only 0.3% fee tier pools
/agentra pools --fee-tier 3000
```

## Step-by-Step Instructions

### Step 1: Search for Pools

Use the `okx-defi-invest` skill to search for available DeFi pools on X Layer:

**OnchainOS command:**

```
onchainos defi-invest search \
  --chain xlayer \
  --protocol uniswap-v3 \
  --pair USDT/OKB
```

Alternatively, use the Uniswap AI skill for more detailed pool data:

**Uniswap AI command:**

```
uniswap liquidity-planner pools \
  --chain xlayer \
  --pair USDT/OKB
```

### Step 2: Enrich with Market Data

For each pool found, fetch current market data:

**OnchainOS commands:**

```
# Current token prices
onchainos dex-market price --chain xlayer --token USDT
onchainos dex-market price --chain xlayer --token OKB

# Pool trading volume
onchainos dex-market volume --chain xlayer --pool 0xPOOL_ADDRESS
```

### Step 3: Calculate APR Estimates

APR is estimated from fee revenue relative to TVL:

```
APR = (dailyFeeRevenue * 365 / TVL) * 100
```

For concentrated liquidity (Uniswap v3), the effective APR depends on the price range:
- Full range: lower APR but no impermanent loss risk from range exit
- Tight range: higher APR but requires active management

### Step 4: Display Pool Analysis

```
UNISWAP V3 POOLS -- X LAYER
============================

  USDT/OKB (0.3% fee)
  Pool: 0xABCD...1234
  TVL: $485,200
  24h Volume: $62,300
  24h Fees: $186.90
  APR (full range): ~14.1%
  Tick spacing: 60
  Current price: 1 OKB = 4.92 USDT

  USDT/OKB (0.05% fee)
  Pool: 0xEFGH...5678
  TVL: $1,230,000
  24h Volume: $380,000
  24h Fees: $190.00
  APR (full range): ~5.6%
  Tick spacing: 10
  Current price: 1 OKB = 4.93 USDT

  USDT/WETH (0.3% fee)
  Pool: 0xIJKL...9012
  TVL: $210,500
  24h Volume: $31,200
  24h Fees: $93.60
  APR (full range): ~16.2%

  Sorted by: TVL (descending)
  Showing: 3 pools with TVL > $0
```

### Step 5: Recommend Best Pool

Based on the user's criteria, highlight the recommended pool:

```
RECOMMENDATION
==============
  For passive yield: USDT/OKB 0.3% fee tier
    - Good TVL ($485k) indicates deep liquidity
    - APR ~14.1% (full range)
    - High volume relative to TVL

  For active management: USDT/OKB 0.05% fee tier
    - Highest TVL ($1.23M) -- most liquid
    - Lower APR but tighter spreads
    - Better for large positions

  To add liquidity: /agentra invest USDT/OKB 50 USDT --fee-tier 3000
```

## Pool Data Fields

| Field | Description | Source |
|-------|-------------|--------|
| Pool address | Uniswap v3 pool contract | `okx-defi-invest` or `uniswap liquidity-planner` |
| TVL | Total Value Locked in USD | Pool contract + price feeds |
| 24h Volume | Trading volume in last 24 hours | DEX indexer |
| 24h Fees | Fee revenue collected in last 24 hours | Volume * fee tier |
| APR | Annualized fee return as % of TVL | (dailyFees * 365 / TVL) * 100 |
| Fee tier | Pool fee in basis points | Pool contract `fee()` |
| Tick spacing | Minimum tick increment for positions | Determined by fee tier |
| Current price | Spot price of token0/token1 | Pool contract `slot0()` |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `No pools found` | No Uniswap v3 pools for that pair on X Layer | Try a different token pair |
| `Token not found` | Invalid token symbol or address | Check token exists on X Layer |
| `RPC timeout` | X Layer RPC not responding | Retry; check RPC status |

## OnchainOS Skills Used

- `okx-defi-invest` -- Search for DeFi pools and investment opportunities
- `okx-dex-market` -- Get token prices and volume data for APR calculations
- `okx-dex-token` -- Resolve token symbols to addresses

## Uniswap AI Skills Used

- `liquidity-planner` -- Query Uniswap v3 pool data, tick ranges, and fee tiers
