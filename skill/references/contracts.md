# Contract Reference

All Sentinel smart contracts are deployed on X Layer (chain ID 196) using the UUPS proxy pattern (EIP-1822). Each contract sits behind an `ERC1967Proxy` with a fixed address that persists across upgrades.

## Deployed Addresses

| Contract | Proxy Address | Status |
|----------|--------------|--------|
| Registry | `0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86` | Live |
| Escrow | `0xa80066f2fd7efdFB944ECcb16f67604D33C34333` | Live |
| Treasury | `0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44` | Live |
| VerdictRegistry | `TBD` | Not yet deployed |
| USDT | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` | ERC-20 |
| Uniswap Router | `0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15` | Live |
| OKB | Native | Gas token |

## Network Configuration

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| Network | X Layer | X Layer Testnet |
| Chain ID | 196 | 1952 |
| RPC URL | `https://rpc.xlayer.tech` | `https://testrpc.xlayer.tech` |
| Block Explorer | `https://www.okx.com/xlayer/explorer` | `https://www.okx.com/xlayer/explorer/testnet` |
| Gas Model | Zero gas for most operations | Zero gas |

## VerdictRegistry (Planned)

The VerdictRegistry is a new contract that stores Sentinel verdicts on-chain. Each verdict is an immutable record tied to a token address.

### Data Structures

```solidity
enum VerdictLevel { SAFE, CAUTION, DANGEROUS }

struct Verdict {
    uint256 id;              // Auto-incrementing verdict ID
    address token;           // ERC-20 token address
    VerdictLevel level;      // SAFE, CAUTION, or DANGEROUS
    uint256 riskScore;       // 0-100 risk score
    bytes32 reportHash;      // IPFS hash of the full report
    address analyst;         // Analyst wallet that produced the verdict
    uint256 timestamp;       // Block timestamp when published
    bool executorInvested;   // Whether the Executor opened an LP position
}
```

### Functions (Planned)

| Function | Access | Description |
|----------|--------|-------------|
| `publishVerdict(address token, VerdictLevel level, uint256 riskScore, bytes32 reportHash) -> uint256` | Analyst only | Publish a new verdict. Returns verdict ID. |
| `getVerdict(uint256 verdictId) -> Verdict` | View | Get verdict by ID. |
| `getVerdictByToken(address token) -> Verdict` | View | Get latest verdict for a token. |
| `getVerdictHistory(address token) -> Verdict[]` | View | Get all verdicts for a token. |
| `markInvested(uint256 verdictId)` | Executor only | Mark that the Executor invested in this token. |
| `verdictCount() -> uint256` | View | Total verdicts published. |

### Events (Planned)

```solidity
event VerdictPublished(uint256 indexed id, address indexed token, VerdictLevel level, uint256 riskScore);
event VerdictInvested(uint256 indexed id, address indexed token);
```

## Registry

The Registry contract manages service registration and discovery. Used by Sentinel to register the scan and report services.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerService(string serviceType, string endpoint, uint256 priceUsdt) -> uint256` | Anyone | Register a new service. Returns service ID. |
| `updateService(uint256 serviceId, string endpoint, uint256 priceUsdt)` | Owner | Update endpoint or price. |
| `deactivateService(uint256 serviceId)` | Owner | Deactivate a service. |
| `getService(uint256 serviceId) -> Service` | View | Get service by ID. |
| `getActiveServices() -> Service[]` | View | Get all active services. |

## Escrow

The Escrow contract holds USDT during x402 payment flows and enforces timeouts.

### Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `feeBps` | 200 | Platform fee (2%) |
| `defaultTimeout` | 3600 | Auto-refund eligibility (1 hour) |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `deposit(uint256 serviceId, uint256 amount) -> uint256` | Anyone | Lock USDT in escrow. Returns order ID. |
| `release(uint256 orderId)` | Client | Release funds to service provider (minus 2% fee). |
| `refund(uint256 orderId)` | Client | Refund after deadline. |
| `dispute(uint256 orderId)` | Either | Freeze funds. |

## Treasury

Collects platform fees and manages reinvestment into Uniswap v3 LP.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `collectFee(uint256 amount)` | Escrow | Receive fee on order completion. |
| `reinvest(uint256 amount)` | Owner | Reinvest into Uniswap LP. |
| `claimYield(address agent)` | Anyone | Claim accumulated yield. |

## Solidity Version & Dependencies

| Component | Version |
|-----------|---------|
| Solidity | `^0.8.24` |
| OpenZeppelin Upgradeable | `5.x` |
| Foundry | Latest |
| Proxy Pattern | UUPS (EIP-1822) |
