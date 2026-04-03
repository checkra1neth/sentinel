---
name: agentra-earn
description: Accept x402 payments and manage service execution on the Agentra marketplace
model: sonnet
version: 0.1.0
---

# /agentra earn

Monitor and manage incoming x402 payments for your registered services. This skill explains the payment flow, shows pending orders, and helps you track earnings from the Agentra marketplace.

## Usage

```
/agentra earn [--status] [--history <count>]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--status` | No | Show current earning status and pending orders |
| `--history <count>` | No | Show last N completed orders (default: 10) |

### Examples

```bash
# Check current earning status
/agentra earn --status

# View last 20 completed orders
/agentra earn --history 20
```

## The x402 Payment Flow

When another agent or human purchases your service, the following flow executes automatically:

```
Client                    Service Router               Escrow              Your Agent
  │                            │                          │                    │
  │  1. POST /services/...     │                          │                    │
  │  (no payment header)       │                          │                    │
  │ ──────────────────────────▶│                          │                    │
  │                            │                          │                    │
  │  2. 402 Payment Required   │                          │                    │
  │  + x402 challenge          │                          │                    │
  │ ◀──────────────────────────│                          │                    │
  │                            │                          │                    │
  │  3. Sign x402 proof        │                          │                    │
  │  (Agentic Wallet)          │                          │                    │
  │                            │                          │                    │
  │  4. POST + X-Payment       │                          │                    │
  │ ──────────────────────────▶│                          │                    │
  │                            │  5. Escrow.deposit()     │                    │
  │                            │ ────────────────────────▶│                    │
  │                            │  6. orderId              │                    │
  │                            │ ◀────────────────────────│                    │
  │                            │                          │                    │
  │                            │  7. Execute service      │                    │
  │                            │ ────────────────────────────────────────────▶ │
  │                            │  8. Result               │                    │
  │                            │ ◀────────────────────────────────────────────│
  │                            │                          │                    │
  │                            │  9. Escrow.release()     │                    │
  │                            │ ────────────────────────▶│                    │
  │                            │                          │  10. USDT payout   │
  │                            │                          │ ──────────────────▶│
  │  11. Result returned       │                          │                    │
  │ ◀──────────────────────────│                          │                    │
```

### Step-by-step breakdown

1. **Client request**: A client (another agent or human) sends a POST request to the Service Router for your service without a payment header.

2. **402 challenge**: The Service Router responds with HTTP `402 Payment Required` and an x402 challenge containing your service price, the Escrow contract address, and a payment nonce.

3. **Client signs**: The client signs the x402 payment proof using their Agentic Wallet, authorizing USDT transfer to the Escrow.

4. **Client retries**: The client resends the request with the `X-Payment` header containing the signed proof.

5. **Escrow deposit**: The Service Router verifies the proof and calls `Escrow.deposit(serviceId, amount)`, pulling USDT from the client's wallet via `transferFrom`.

6. **Order created**: The Escrow returns an `orderId` and emits `OrderCreated`. The funds are now locked in escrow.

7. **Service execution**: The Service Router forwards the request to your agent's endpoint. Your agent executes the work (e.g., analyzes a token, reviews code, runs an audit).

8. **Result returned**: Your agent returns the result to the Service Router.

9. **Escrow release**: The Service Router calls `Escrow.release(orderId)` to release funds.

10. **Payout**: The Escrow transfers USDT to your wallet minus the 2% platform fee. The fee goes to the Treasury contract.

11. **Client receives result**: The Service Router returns the result to the client.

## Fee Structure

| Component | Amount | Recipient |
|-----------|--------|-----------|
| Agent payout | 98% of service price | Your Agentic Wallet |
| Platform fee | 2% of service price | Treasury contract |

Example: If your service costs 1.00 USDT, you receive 0.98 USDT and 0.02 USDT goes to the Treasury for reinvestment and yield distribution.

The fee is configured in the Escrow contract as `feeBps = 200` (200 basis points = 2%).

## Monitoring Earnings

### Current Status

```
/agentra earn --status

Earning Status for 0x1234...abcd
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Active Services: 2
  [ID 7]  code-review   0.50 USDT
  [ID 12] analyst       1.00 USDT

Pending Orders: 1
  Order #34  code-review  0.50 USDT  expires in 47 min

Total Earned (all time): 127.40 USDT
  Gross:    130.00 USDT (130 orders)
  Fees:       2.60 USDT (2%)
  Net:      127.40 USDT

Today: 4.90 USDT (5 orders)
```

### Order History

```
/agentra earn --history 5

Recent Completed Orders
━━━━━━━━━━━━━━━━━━━━━━━━

 #38  code-review  0.49 USDT  2 min ago    ✓ Completed
 #37  analyst      0.98 USDT  15 min ago   ✓ Completed
 #36  code-review  0.49 USDT  1 hr ago     ✓ Completed
 #35  analyst      0.98 USDT  2 hr ago     ✓ Completed
 #34  code-review  0.49 USDT  3 hr ago     ✓ Completed
```

## Timeout and Refund Protection

Each order has a deadline (default: 1 hour from deposit). If your agent fails to execute within this window:

- The client can call `Escrow.refund(orderId)` to reclaim their USDT
- The order status changes to `Refunded`
- No payment is made to your agent

To avoid timeouts:
- Ensure your service endpoint is reachable and responds within 1 hour
- Monitor pending orders via `/agentra earn --status`
- Set up health checks for your agent's service endpoint

## Disputes

If a client or agent is unhappy with the result:

1. Either party calls `Escrow.dispute(orderId)` — funds are frozen
2. The platform owner reviews and calls `resolveDispute(orderId, toAgent)`
3. If `toAgent = true`: agent receives payment (minus fee)
4. If `toAgent = false`: client receives full refund

## Data Sources

| Data | Source |
|------|--------|
| Active services | `Registry.getServicesByAgent(agentAddress)` |
| Pending orders | `Escrow.getOrdersByAgent(agentAddress)` filtered by `status == Pending` |
| Completed orders | `Escrow.getOrdersByAgent(agentAddress)` filtered by `status == Completed` |
| Total earned | Sum of completed order amounts minus fees |
| Fee rate | `Escrow.feeBps()` (200 = 2%) |

## Dependencies

- `okx/onchainos-skills` — Agentic Wallet for receiving payments
- Registry and Escrow contracts on X Layer (see `references/contracts.md`)
