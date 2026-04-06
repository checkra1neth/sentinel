---
name: portfolio
description: View Executor LP positions on Uniswap v3. Shows tokens invested, amounts, and PnL.
---

# /sentinel portfolio

Shows the Executor agent's current Uniswap v3 LP positions. The Executor only invests in tokens that the Analyst has rated SAFE. Each position shows the token pair, invested amount, current value, fee tier, and unrealized PnL.

## Usage

```
/sentinel portfolio
```

## Parameters

None. This is a free public endpoint.

## OnchainOS Commands Used

```
onchainos defi-portfolio positions --address <executor_wallet> --chain xlayer
onchainos wallet-portfolio balances --address <executor_wallet> --chain xlayer
onchainos dex market-data --chain xlayer
```

## API Endpoint

```
GET /api/portfolio
```

**Response: 200 OK**

```json
{
  "executor": "0x7500350249e155fdacb27dc0a12f5198b158ee00",
  "totalInvested": "1250.00",
  "totalCurrentValue": "1387.50",
  "totalPnl": "+137.50",
  "totalPnlPercent": "+11.0%",
  "positions": [
    {
      "tokenId": 1234,
      "pair": "OKB/USDT",
      "feeTier": 3000,
      "invested": "500.00",
      "currentValue": "562.30",
      "feesEarned": "12.40",
      "pnl": "+62.30",
      "pnlPercent": "+12.5%",
      "verdict": "SAFE",
      "riskScore": 8,
      "openedAt": "2026-04-02T14:00:00Z"
    },
    {
      "tokenId": 1235,
      "pair": "SFT/USDT",
      "feeTier": 3000,
      "invested": "250.00",
      "currentValue": "278.20",
      "feesEarned": "5.80",
      "pnl": "+28.20",
      "pnlPercent": "+11.3%",
      "verdict": "SAFE",
      "riskScore": 15,
      "openedAt": "2026-04-03T09:00:00Z"
    }
  ],
  "walletBalance": {
    "usdt": "340.00",
    "okb": "2.50"
  }
}
```

## Example

```
/sentinel portfolio
```

Output:
```
Sentinel Executor Portfolio

Wallet: 0x7500...ee00
Total Invested: $1,250.00
Current Value:  $1,387.50
Total PnL:      +$137.50 (+11.0%)

Positions:
  OKB/USDT (0.3%)   $500.00 -> $562.30   +$62.30 (+12.5%)   Fees: $12.40
  SFT/USDT (0.3%)   $250.00 -> $278.20   +$28.20 (+11.3%)   Fees: $5.80
  EXT/USDT (0.3%)   $500.00 -> $547.00   +$47.00 (+9.4%)    Fees: $8.20

Wallet Balance: 340.00 USDT | 2.50 OKB

All positions backed by SAFE verdicts (risk score < 30).
```
