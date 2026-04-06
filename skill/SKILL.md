---
name: sentinel
description: Autonomous security oracle on X Layer — monitors tokens, publishes on-chain verdicts, invests in safe tokens via Uniswap LP. Skin in the game.
model: opus
version: 1.0.0
---

# Sentinel

Sentinel is a self-funding security oracle on X Layer (chain ID 196). Three autonomous agents work in sequence: the Scanner discovers new tokens, the Analyst performs deep security analysis and publishes on-chain verdicts, and the Executor invests in tokens deemed safe via Uniswap v3 LP positions.

The difference from every other security tool: Sentinel puts its own money where its verdicts are. If a token is rated SAFE, the Executor stakes real capital into its liquidity pool. If the verdict is wrong, Sentinel loses money. Skin in the game.

## How It Works

```
                    ┌──────────────────────────────────────────────┐
                    │              Sentinel Pipeline                │
                    │                                              │
  New tokens        │   ┌──────────┐   ┌──────────┐   ┌────────┐  │
  on X Layer  ────► │   │ Scanner  │──►│ Analyst  │──►│Executor│  │
                    │   │ discover │   │ verdict  │   │ invest │  │
                    │   └──────────┘   └────┬─────┘   └───┬────┘  │
                    │                       │             │        │
                    │                       ▼             ▼        │
                    │               VerdictRegistry   Uniswap v3  │
                    │                (on-chain)       LP Positions │
                    └──────────────────────────────────────────────┘
                            │                    │
                            ▼                    ▼
                      x402 Paywall          LP Fee Yield
                     (earn revenue)       (earn from safety)
```

## The Earn-Pay-Earn Cycle

1. **Earn (verdicts)** -- External clients pay 0.50 USDT via x402 for detailed token reports. Manual scan requests cost 0.10 USDT.
2. **Pay (infrastructure)** -- Revenue covers OnchainOS operations and gas for on-chain verdict publishing.
3. **Earn (LP yield)** -- The Executor invests in tokens rated SAFE, earning Uniswap v3 LP fees. Good verdicts = profitable positions. Bad verdicts = losses. Aligned incentives.

## Available Commands

| Command | Description | x402 Cost |
|---------|-------------|-----------|
| `/sentinel scan <token>` | Trigger deep security scan for a token | 0.10 USDT |
| `/sentinel feed` | View last 20 published verdicts | Free |
| `/sentinel report <token>` | Get detailed security report for a token | 0.50 USDT |
| `/sentinel portfolio` | View Executor LP positions and PnL | Free |
| `/sentinel status` | Aggregate stats: scans, threats, accuracy | Free |

## Prerequisites

### 1. OnchainOS Skills (required)

```
okx-agentic-wallet    -- agent identity and wallet management
okx-x402-payment      -- sign and verify x402 payment proofs
okx-dex-swap          -- execute token swaps on X Layer DEX
okx-dex-token         -- token metadata, prices, liquidity
okx-dex-market        -- real-time pricing and market data
okx-dex-signal        -- on-chain trade signals and momentum
okx-security          -- token and contract security scanning
okx-onchain-gateway   -- raw contract read/write via RPC
okx-defi-invest       -- DeFi pool search and investment
okx-defi-portfolio    -- track LP positions and DeFi holdings
okx-wallet-portfolio  -- aggregate wallet balances
okx-dex-trenches      -- trending tokens and narratives
okx-audit-log         -- log and review agent actions
```

### 2. Uniswap AI Skills (required for Executor)

```
swap-integration      -- execute swaps through Uniswap v3
liquidity-planner     -- plan, add, and remove LP positions
```

### 3. OKX API Keys (required)

```
OKX_API_KEY=your_api_key
OKX_SECRET_KEY=your_secret_key
OKX_PASSPHRASE=your_passphrase
OKX_PROJECT_ID=your_project_id
```

## Smart Contracts

| Contract | Address |
|----------|---------|
| Registry | `0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86` |
| Escrow | `0xa80066f2fd7efdFB944ECcb16f67604D33C34333` |
| Treasury | `0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44` |
| VerdictRegistry | `TBD` |
| USDT | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` |
| Uniswap Router | `0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15` |

## Server API

| Endpoint | Method | Description | x402 |
|----------|--------|-------------|------|
| `/api/verdicts` | GET | Public verdict feed (last 20) | Free |
| `/api/verdicts/:token` | GET | Detailed report for a token | 0.50 USDT |
| `/api/scan/:token` | POST | Manual scan request | 0.10 USDT |
| `/api/agents` | GET | Agent overview | Free |
| `/api/portfolio` | GET | Executor LP positions | Free |
| `/api/stats` | GET | Aggregate statistics | Free |
| `/api/events` | WS | Real-time event feed | Free |

See `references/api.md` for full endpoint documentation.
