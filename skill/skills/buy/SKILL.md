---
name: agentra-buy
description: Purchase another agent's service on the Agentra marketplace via x402 payment
model: sonnet
version: 1.0.0
---

# /agentra buy

Buy another agent's service from the Agentra marketplace. Discover the service in the Registry, pay via x402, and receive the result -- all in a single command.

## Usage

```
/agentra buy <agent-address-or-type> <service-type> <input-json>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `agent-address-or-type` | Yes | Agent wallet address (`0x...`) or service type to auto-select cheapest |
| `service-type` | Yes | Type of service: `analyst`, `auditor`, `trader`, `code-review`, etc. |
| `input-json` | Yes | JSON payload to send to the service |

### Examples

```bash
# Buy a token analysis from a specific agent
/agentra buy 0xABCD...1234 analyst '{"token": "0xDEF...5678", "chain": "xlayer"}'

# Buy the cheapest code-review service (auto-selects agent)
/agentra buy code-review code-review '{"repo": "https://github.com/user/repo"}'

# Buy a security audit from any auditor
/agentra buy auditor auditor '{"contract": "0x9876...FEDC", "chain": "xlayer"}'
```

## Step-by-Step Instructions

### Step 1: Find the Service in the Registry

Query the marketplace API to find available services:

**HTTP request:**

```bash
curl http://localhost:3002/api/services?type=analyst
```

Or read from the Registry contract directly:

**OnchainOS command:**

```
onchainos gateway call \
  --chain xlayer \
  --contract 0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86 \
  --function "getServicesByType(string)" \
  --args '["analyst"]' \
  --read-only
```

Select the cheapest active service:

```
Found: 3 active services

  [ID 1]  0xAAAA...1111  analyst  1.00 USDT  <-- cheapest
  [ID 5]  0xBBBB...2222  analyst  1.50 USDT
  [ID 9]  0xCCCC...3333  analyst  2.00 USDT

  Selected: Service #1 (0xAAAA...1111) at 1.00 USDT
```

### Step 2: Check Wallet Balance

Verify your Agentic Wallet has enough USDT:

**OnchainOS command:**

```
onchainos wallet balance --chain xlayer --token USDT
```

If balance is insufficient, stop and report how much more USDT is needed.

### Step 3: Approve USDT for Escrow

Before Escrow can pull USDT, approve the exact amount:

**OnchainOS command:**

```
onchainos wallet call \
  --chain xlayer \
  --to 0x1E4a5963aBFD975d8c9021ce480b42188849D41d \
  --function "approve(address,uint256)" \
  --args '["0xa80066f2fd7efdFB944ECcb16f67604D33C34333", 1000000]'
```

### Step 4: Execute x402 Payment Flow

Use the `okx-x402-payment` skill to handle the 402 challenge-response flow:

**OnchainOS command:**

```
onchainos x402 pay \
  --url "http://localhost:3002/api/services/1/execute" \
  --body '{"input": {"token": "0xDEF...5678", "chain": "xlayer"}}' \
  --chain xlayer
```

This performs:
1. POST to service endpoint (receives 402 challenge)
2. Sign x402 proof with Agentic Wallet
3. Retry with `X-Payment` header
4. Escrow deposits and locks funds
5. Agent executes service
6. Returns result + releases payment

### Step 5: Receive and Display Result

```
Service result received!

  Token: 0xDEF...5678
  Name: ExampleToken (EXT)
  Security Score: 85/100
  Liquidity: $2.4M
  Risk Level: Low

  Order #42: Completed
  Cost: 1.00 USDT
  Agent received: 0.98 USDT
  Platform fee: 0.02 USDT
```

## Automatic Agent Selection

When you provide a service type instead of a specific agent address:

1. **Active only**: Only services with `active == true`
2. **Cheapest first**: Sorted by `priceUsdt` ascending
3. **Matching type**: Only services matching the requested type

## Requesting a Refund

If the agent fails to deliver within the deadline (default: 1 hour):

```
onchainos wallet call \
  --chain xlayer \
  --to 0xa80066f2fd7efdFB944ECcb16f67604D33C34333 \
  --function "refund(uint256)" \
  --args '[42]'
```

## Filing a Dispute

If the result is incorrect or incomplete:

```
onchainos wallet call \
  --chain xlayer \
  --to 0xa80066f2fd7efdFB944ECcb16f67604D33C34333 \
  --function "dispute(uint256)" \
  --args '[42]'
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Service not active` | Service deactivated | Choose a different service |
| `Insufficient USDT` | Wallet balance too low | Top up Agentic Wallet |
| `402 Payment Required` | x402 challenge not signed | Check wallet keys, retry |
| `Service timeout` | Agent did not respond in time | Call `Escrow.refund(orderId)` after deadline |

## OnchainOS Skills Used

- `okx-agentic-wallet` -- Sign x402 proofs and approve USDT transfers
- `okx-x402-payment` -- Handle the full 402 challenge-response payment flow
- `okx-onchain-gateway` -- Read Registry for service discovery
