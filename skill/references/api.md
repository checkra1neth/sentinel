# Sentinel API Reference

The Sentinel server exposes a REST API and WebSocket endpoint for interacting with the security oracle. Paid endpoints use x402 micropayments over USDT on X Layer.

## Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.sentinel.xyz` |
| Local | `http://localhost:3000` |

## Authentication

No API keys needed. Paid endpoints use x402 payment proofs -- payment is the authentication.

## Endpoints

### GET /api/verdicts

Public verdict feed. Returns the last 20 verdicts published by the Sentinel oracle.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Number of verdicts to return (default: 20, max: 100) |
| `verdict` | string | No | Filter by verdict level: `SAFE`, `CAUTION`, `DANGEROUS` |

**Response: 200 OK**

```json
{
  "verdicts": [
    {
      "token": "0xABC...123",
      "name": "ExampleToken",
      "symbol": "EXT",
      "riskScore": 72,
      "verdict": "CAUTION",
      "scannedAt": "2026-04-06T10:30:00Z",
      "txHash": "0xVERDICT_TX"
    }
  ],
  "total": 20
}
```

**Example:**

```bash
curl https://api.sentinel.xyz/api/verdicts
curl "https://api.sentinel.xyz/api/verdicts?verdict=DANGEROUS&limit=50"
```

---

### GET /api/verdicts/:token

Detailed security report for a specific token. Requires x402 payment.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | ERC-20 token address on X Layer (0x...) |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `X-Payment` | Yes | Base64-encoded x402 payment proof (0.50 USDT) |

**Response: 402 Payment Required** (first request without `X-Payment`)

```json
{
  "x402": {
    "version": "1.0",
    "network": "xlayer",
    "chainId": 196,
    "price": "500000",
    "currency": "USDT",
    "decimals": 6,
    "escrow": "0xa80066f2fd7efdFB944ECcb16f67604D33C34333",
    "description": "Detailed security report for token"
  }
}
```

**Response: 200 OK** (with valid `X-Payment`)

```json
{
  "token": "0xABC...123",
  "name": "ExampleToken",
  "symbol": "EXT",
  "riskScore": 72,
  "verdict": "CAUTION",
  "security": {
    "honeypot": false,
    "mintable": true,
    "pausable": false,
    "proxy": false,
    "transferTax": 3.0,
    "issues": [
      {"severity": "high", "issue": "Owner can mint unlimited tokens"},
      {"severity": "medium", "issue": "Transfer tax detected (3%)"}
    ]
  },
  "liquidity": {
    "uniswapV3Pool": "0xPOOL...789",
    "tvl": "245000.00",
    "volume24h": "18700.00",
    "feeTier": 3000,
    "priceUsd": "0.0234"
  },
  "holders": {
    "total": 1247,
    "top10Percent": 68.4,
    "top1": {"address": "0xTOP...001", "percent": 22.1}
  },
  "devInfo": {
    "deployer": "0xDEV...456",
    "deployedAt": "2026-03-15T08:00:00Z",
    "verified": true,
    "previousContracts": 3
  },
  "onChainVerdict": {
    "txHash": "0xVERDICT_TX_HASH",
    "blockNumber": 12345678,
    "timestamp": "2026-04-06T10:30:00Z"
  }
}
```

**Example:**

```bash
# Step 1: Get x402 challenge
curl https://api.sentinel.xyz/api/verdicts/0xABC123

# Step 2: Retry with payment proof
curl https://api.sentinel.xyz/api/verdicts/0xABC123 \
  -H "X-Payment: BASE64_SIGNED_PROOF"
```

---

### POST /api/scan/:token

Trigger a manual security scan for a token. Requires x402 payment.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | ERC-20 token address on X Layer (0x...) |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `X-Payment` | Yes | Base64-encoded x402 payment proof (0.10 USDT) |

**Response: 200 OK**

```json
{
  "token": "0xABC...123",
  "name": "ExampleToken",
  "symbol": "EXT",
  "riskScore": 72,
  "verdict": "CAUTION",
  "risks": [
    {"severity": "high", "issue": "Owner can mint unlimited tokens"},
    {"severity": "medium", "issue": "Transfer tax detected (3%)"}
  ],
  "honeypot": false,
  "devInfo": {
    "deployer": "0xDEV...456",
    "deployedAt": "2026-03-15T08:00:00Z",
    "verified": true
  },
  "txHash": "0xVERDICT_TX_HASH"
}
```

**Example:**

```bash
curl -X POST https://api.sentinel.xyz/api/scan/0xABC123 \
  -H "X-Payment: BASE64_SIGNED_PROOF"
```

---

### GET /api/agents

Agent overview with wallet addresses, roles, and current status.

**Response: 200 OK**

```json
{
  "agents": [
    {
      "name": "scanner",
      "role": "Token discovery and monitoring",
      "wallet": "0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2",
      "status": "active",
      "lastAction": "2026-04-06T10:30:00Z"
    },
    {
      "name": "analyst",
      "role": "Deep security analysis and verdict publishing",
      "wallet": "0x874370bc9352bfa4b39c22fa82b89f4ca952ce03",
      "status": "active",
      "lastAction": "2026-04-06T10:30:00Z"
    },
    {
      "name": "executor",
      "role": "LP investment in safe tokens",
      "wallet": "0x7500350249e155fdacb27dc0a12f5198b158ee00",
      "status": "active",
      "lastAction": "2026-04-06T09:00:00Z"
    }
  ]
}
```

---

### GET /api/portfolio

Executor LP positions on Uniswap v3. Shows all active positions with PnL.

**Response: 200 OK**

```json
{
  "executor": "0x7500350249e155fdacb27dc0a12f5198b158ee00",
  "totalInvested": "1250.00",
  "totalCurrentValue": "1387.50",
  "totalPnl": "+137.50",
  "positions": [
    {
      "tokenId": 1234,
      "pair": "OKB/USDT",
      "feeTier": 3000,
      "invested": "500.00",
      "currentValue": "562.30",
      "feesEarned": "12.40",
      "pnl": "+62.30",
      "verdict": "SAFE",
      "riskScore": 8
    }
  ]
}
```

---

### GET /api/stats

Aggregate oracle statistics.

**Response: 200 OK**

```json
{
  "tokensScanned": 847,
  "verdicts": {"safe": 312, "caution": 389, "dangerous": 146},
  "threatsDetected": 535,
  "honeypotsCaught": 89,
  "lpInvested": "4250.00",
  "lpCurrentValue": "4782.50",
  "revenueEarned": "892.30",
  "accuracy": {"overall": 94.2, "safeCorrect": 96.1, "dangerousCorrect": 98.6},
  "uptime": "99.7%"
}
```

---

### WS /api/events

WebSocket endpoint for real-time event streaming.

**Events:**

| Event | Description |
|-------|-------------|
| `verdict.published` | New verdict published to VerdictRegistry |
| `scan.started` | Manual scan initiated |
| `scan.completed` | Scan finished with results |
| `position.opened` | Executor opened new LP position |
| `position.closed` | Executor closed LP position |
| `threat.detected` | Dangerous token identified |

**Example:**

```javascript
const ws = new WebSocket("wss://api.sentinel.xyz/api/events");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.payload);
};
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `GET /api/verdicts` | 100 requests/minute |
| `GET /api/verdicts/:token` | 30 requests/minute |
| `POST /api/scan/:token` | 10 requests/minute |
| `GET /api/agents` | 60 requests/minute |
| `GET /api/portfolio` | 60 requests/minute |
| `GET /api/stats` | 60 requests/minute |

Rate limits are per IP address. Exceeding returns `429 Too Many Requests`.

## Error Format

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

| Code | Description |
|------|-------------|
| `PAYMENT_REQUIRED` | x402 challenge -- client must sign and retry |
| `PAYMENT_INVALID` | x402 proof verification failed |
| `TOKEN_NOT_FOUND` | Token address not recognized or not on X Layer |
| `SCAN_IN_PROGRESS` | Token is currently being scanned |
| `RATE_LIMITED` | Too many requests |
