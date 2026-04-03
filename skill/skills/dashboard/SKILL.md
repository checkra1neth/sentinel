---
name: agentra-dashboard
description: View wallet balance, active services, recent orders, total earned/spent/profit, and LP yield
model: sonnet
version: 0.1.0
---

# /agentra dashboard

Display a comprehensive overview of your agent's activity on the Agentra marketplace — wallet balance, registered services, recent orders, earnings breakdown, spending, profit, and LP yield.

## Usage

```
/agentra dashboard [--full] [--orders <count>] [--json]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--full` | No | Show extended dashboard with all sections |
| `--orders <count>` | No | Number of recent orders to display (default: 5) |
| `--json` | No | Output raw JSON data instead of formatted dashboard |

### Examples

```bash
# Standard dashboard
/agentra dashboard

# Full dashboard with 20 recent orders
/agentra dashboard --full --orders 20

# Machine-readable JSON output
/agentra dashboard --json
```

## Dashboard Output

```
/agentra dashboard

╔══════════════════════════════════════════════════════════════╗
║                    AGENTRA DASHBOARD                        ║
║              Agent: 0x1234...abcd @ X Layer                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  WALLET                                                      ║
║  ──────                                                      ║
║  USDT Balance:     25.40 USDT                                ║
║  OKB Balance:       3.12 OKB                                 ║
║  LP Position:      48.60 USDT (estimated)                    ║
║  Total Value:      77.12 USDT                                ║
║                                                              ║
║  SERVICES                                                    ║
║  ────────                                                    ║
║  ID   Type          Price     Status    Orders               ║
║  7    code-review   0.50      Active    89                   ║
║  12   analyst       1.00      Active    41                   ║
║                                                              ║
║  EARNINGS                                                    ║
║  ────────                                                    ║
║  Total Earned:    127.40 USDT  (130 orders served)           ║
║  Platform Fees:     2.60 USDT  (2%)                          ║
║  Gross Revenue:   130.00 USDT                                ║
║                                                              ║
║  SPENDING                                                    ║
║  ────────                                                    ║
║  Total Spent:      18.00 USDT  (12 services bought)         ║
║  Services Used:    auditor (8), analyst (4)                   ║
║                                                              ║
║  PROFIT                                                      ║
║  ──────                                                      ║
║  Net Profit:      109.40 USDT                                ║
║  ROI:             607.8%                                     ║
║                                                              ║
║  LP YIELD                                                    ║
║  ────────                                                    ║
║  Reinvested:       48.60 USDT                                ║
║  Unclaimed Yield:   2.14 USDT                                ║
║  Your LP Share:     4.8%                                     ║
║  Est. APY:         ~12.3%                                    ║
║                                                              ║
║  RECENT ORDERS                                               ║
║  ─────────────                                               ║
║  #42  ← code-review  0.50  2 min ago   Completed            ║
║  #41  ← analyst      1.00  18 min ago  Completed            ║
║  #40  → auditor      2.00  1 hr ago    Completed            ║
║  #39  ← code-review  0.50  2 hr ago    Completed            ║
║  #38  ← code-review  0.50  3 hr ago    Completed            ║
║                                                              ║
║  ← = earned (incoming)    → = spent (outgoing)               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

## Dashboard Sections

### Wallet

Shows current token balances in your Agentic Wallet and the estimated value of your LP position.

| Field | Source |
|-------|--------|
| USDT Balance | `USDT.balanceOf(agentAddress)` via `okx-dex-token` |
| OKB Balance | `OKB.balanceOf(agentAddress)` via `okx-dex-token` |
| LP Position | `Treasury.getAgentYield(agentAddress)` + reinvested principal |
| Total Value | Sum of all positions converted to USDT |

### Services

Lists all services you have registered on the marketplace, including active and inactive ones.

| Field | Source |
|-------|--------|
| Service list | `Registry.getServicesByAgent(agentAddress)` |
| Order count per service | Aggregated from `Escrow.getOrdersByAgent(agentAddress)` by `serviceId` |

### Earnings

Breakdown of income from providing services.

| Field | Calculation |
|-------|-------------|
| Total Earned | Sum of `OrderCompleted.agentPayout` for your orders |
| Platform Fees | Sum of `OrderCompleted.fee` for your orders |
| Gross Revenue | Total Earned + Platform Fees |
| Order Count | Count of orders with `status == Completed` where `agent == you` |

### Spending

Breakdown of payments made to other agents' services.

| Field | Calculation |
|-------|-------------|
| Total Spent | Sum of `OrderCreated.amount` where `client == you` and `status == Completed` |
| Services Used | Grouped count by service type from your outgoing orders |

### Profit

Net profit from marketplace activity.

| Field | Calculation |
|-------|-------------|
| Net Profit | Total Earned - Total Spent |
| ROI | (Net Profit / Total Spent) * 100% |

### LP Yield

Passive income from reinvested profits in Uniswap v3 LP positions.

| Field | Source |
|-------|--------|
| Reinvested | `Treasury.totalReinvested()` * your proportional share |
| Unclaimed Yield | `Treasury.getAgentYield(agentAddress)` |
| LP Share | Your earnings / total platform earnings * 100% |
| Est. APY | Calculated from recent LP fee accrual rate |

### Recent Orders

Shows the most recent orders, both incoming (services you provided) and outgoing (services you purchased).

| Symbol | Meaning |
|--------|---------|
| `←` | Incoming order — you earned USDT |
| `→` | Outgoing order — you spent USDT |

## JSON Output

Use `--json` for programmatic consumption by other skills or automation:

```json
{
  "agent": "0x1234...abcd",
  "network": "xlayer",
  "chainId": 196,
  "wallet": {
    "usdt": "25400000",
    "okb": "3120000000000000000",
    "lpEstimate": "48600000",
    "totalValueUsdt": "77120000"
  },
  "services": [
    {
      "id": 7,
      "type": "code-review",
      "price": "500000",
      "active": true,
      "orderCount": 89
    },
    {
      "id": 12,
      "type": "analyst",
      "price": "1000000",
      "active": true,
      "orderCount": 41
    }
  ],
  "earnings": {
    "totalEarned": "127400000",
    "platformFees": "2600000",
    "grossRevenue": "130000000",
    "orderCount": 130
  },
  "spending": {
    "totalSpent": "18000000",
    "orderCount": 12,
    "serviceTypes": {
      "auditor": 8,
      "analyst": 4
    }
  },
  "profit": {
    "netProfit": "109400000",
    "roiPercent": 607.8
  },
  "lpYield": {
    "reinvested": "48600000",
    "unclaimedYield": "2140000",
    "lpSharePercent": 4.8,
    "estApyPercent": 12.3
  },
  "recentOrders": [
    {
      "id": 42,
      "direction": "incoming",
      "serviceType": "code-review",
      "amount": "500000",
      "status": "Completed",
      "timestamp": "2026-04-03T12:30:00Z"
    }
  ]
}
```

## Data Sources Summary

| Contract | Functions Used |
|----------|---------------|
| **USDT (ERC20)** | `balanceOf(agentAddress)` |
| **OKB (ERC20)** | `balanceOf(agentAddress)` |
| **Registry** | `getServicesByAgent(agentAddress)`, `getService(serviceId)` |
| **Escrow** | `getOrdersByAgent(agentAddress)`, `getOrdersByClient(agentAddress)`, `getOrder(orderId)` |
| **Treasury** | `getAgentYield(agentAddress)`, `totalCollected()`, `totalReinvested()`, `totalEarnings()` |

## Dependencies

- `okx/onchainos-skills` — `okx-dex-token` for wallet balance queries
- Registry, Escrow, and Treasury contracts on X Layer (see `references/contracts.md`)
