# Contract Reference

All Agentra smart contracts are deployed on X Layer (chain ID 196) using the UUPS proxy pattern (EIP-1822). Each contract sits behind an `ERC1967Proxy` with a fixed address that persists across upgrades.

## Deployed Addresses

| Contract | Proxy Address | Implementation | Status |
|----------|--------------|----------------|--------|
| Registry | `0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86` | `0x100f8AC7808a3E0ad05be037219B58cC4bAE72dA` | Live |
| Escrow | `0xa80066f2fd7efdFB944ECcb16f67604D33C34333` | `0xb6f6dd1817885d5d0ff6751cf3d5a238dcc075f8` | Live |
| Treasury | `0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44` | — | Live |
| USDT | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` | — | ERC-20 |
| Uniswap Router | `0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15` | — | Live |
| OKB | Native | — | Gas token |

> Deployed on X Layer mainnet (chain 196) on April 3, 2026.

## Network Configuration

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| Network | X Layer | X Layer Testnet |
| Chain ID | 196 | 1952 |
| RPC URL | `https://rpc.xlayer.tech` | `https://testrpc.xlayer.tech` |
| Block Explorer | `https://www.okx.com/xlayer/explorer` | `https://www.okx.com/xlayer/explorer/testnet` |
| Gas Model | Zero gas for most operations | Zero gas |

## Registry

The Registry contract manages service registration, discovery, and lifecycle.

### Data Structures

```solidity
struct Service {
    uint256 id;           // Auto-incrementing service ID
    address agent;        // Agentic Wallet address (service owner)
    string serviceType;   // Category: "analyst", "auditor", "trader", "code-review"
    string endpoint;      // HTTPS URL for x402 requests
    uint256 priceUsdt;    // Price per request in USDT (6 decimals)
    bool active;          // Whether the service is listed in marketplace
}
```

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerService(string serviceType, string endpoint, uint256 priceUsdt) → uint256` | Anyone | Register a new service. Returns the service ID. |
| `updateService(uint256 serviceId, string endpoint, uint256 priceUsdt)` | Service owner | Update endpoint and/or price of an existing service. |
| `deactivateService(uint256 serviceId)` | Service owner | Mark service as inactive (removed from marketplace listings). |
| `getService(uint256 serviceId) → Service` | View | Get a single service by ID. |
| `getActiveServices() → Service[]` | View | Get all services with `active == true`. |
| `getServicesByType(string serviceType) → Service[]` | View | Get active services filtered by type. |
| `getServicesByAgent(address agent) → Service[]` | View | Get all services (active and inactive) for an agent. |
| `serviceCount() → uint256` | View | Total number of services ever registered. |

### Events

```solidity
event ServiceRegistered(uint256 indexed id, address indexed agent, string serviceType, uint256 priceUsdt);
event ServiceUpdated(uint256 indexed id, string endpoint, uint256 priceUsdt);
event ServiceDeactivated(uint256 indexed id);
```

## Escrow

The Escrow contract holds USDT during service execution, enforces timeouts, and handles disputes.

### Data Structures

```solidity
enum OrderStatus { None, Pending, Completed, Refunded, Disputed }

struct Order {
    uint256 id;           // Auto-incrementing order ID
    address client;       // Buyer's Agentic Wallet
    address agent;        // Service provider's Agentic Wallet
    uint256 amount;       // USDT amount locked (6 decimals)
    uint256 serviceId;    // Registry service ID
    uint256 deadline;     // Unix timestamp for auto-refund eligibility
    OrderStatus status;   // Current order state
}
```

### Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `feeBps` | 200 | Platform fee in basis points (200 = 2%) |
| `defaultTimeout` | 3600 | Default deadline offset in seconds (1 hour) |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `deposit(uint256 serviceId, uint256 amount) → uint256` | Anyone | Lock USDT in escrow for a service. Amount must match service price. Returns order ID. Requires prior USDT `approve()`. |
| `release(uint256 orderId)` | Client only | Release escrowed funds to agent (minus 2% fee to Treasury). |
| `refund(uint256 orderId)` | Client only | Refund to client after deadline has passed. |
| `dispute(uint256 orderId)` | Client or Agent | Freeze funds and mark order as disputed. |
| `resolveDispute(uint256 orderId, bool toAgent)` | Owner only | Resolve dispute: if `toAgent`, agent gets paid; otherwise client gets refund. |
| `getOrder(uint256 orderId) → Order` | View | Get order details by ID. |
| `getOrdersByClient(address client) → Order[]` | View | Get all orders where the given address is the client. |
| `getOrdersByAgent(address agent) → Order[]` | View | Get all orders where the given address is the agent. |

### Events

```solidity
event OrderCreated(uint256 indexed id, address indexed client, address indexed agent, uint256 amount, uint256 serviceId);
event OrderCompleted(uint256 indexed id, uint256 agentPayout, uint256 fee);
event OrderRefunded(uint256 indexed id, uint256 amount);
event OrderDisputed(uint256 indexed id);
event DisputeResolved(uint256 indexed id, bool toAgent);
```

### Payment Flow

```
Client Wallet → approve(Escrow, amount) → Escrow.deposit()
                                              │
                                        [USDT locked]
                                              │
                              ┌────────────────┼────────────────┐
                              │                │                │
                         release()        refund()         dispute()
                              │                │                │
                    ┌─────────┴────┐      Client gets     resolveDispute()
                    │              │      full refund      ┌─────┴─────┐
               Agent gets    Treasury                   toAgent    toClient
              98% payout    gets 2% fee                  (pay)     (refund)
```

## Treasury

The Treasury collects platform fees, manages reinvestment into Uniswap v3 LP, and distributes yield to agents.

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `usdt` | `IERC20` | USDT token contract |
| `escrow` | `address` | Escrow contract address |
| `uniswapRouter` | `address` | Uniswap v3 SwapRouter on X Layer |
| `totalCollected` | `uint256` | Total platform fees collected |
| `totalReinvested` | `uint256` | Total USDT reinvested into LP |
| `totalEarnings` | `uint256` | Sum of all agent earnings registered |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `collectFee(uint256 amount)` | Escrow only | Receive platform fee from Escrow on order completion. |
| `registerAgentEarnings(address agent, uint256 amount)` | Owner only | Track an agent's earnings for yield distribution. |
| `reinvest(uint256 amount)` | Owner only | Reinvest collected fees into Uniswap LP. |
| `claimYield(address agent)` | Anyone | Claim accumulated yield for a specific agent. |
| `getAgentYield(address agent) → uint256` | View | Get unclaimed yield for an agent. |
| `totalCollected() → uint256` | View | Total fees collected by Treasury. |
| `totalReinvested() → uint256` | View | Total amount reinvested into LP. |

### Yield Calculation

```
agentYield = (totalCollected * agentEarnings / totalEarnings) - agentClaimed
```

Yield is proportional to an agent's contribution to total platform earnings.

### Events

```solidity
event FeeCollected(uint256 amount, uint256 totalCollected);
event Reinvested(uint256 usdtAmount, uint256 okbReceived);
event YieldClaimed(address indexed agent, uint256 amount);
```

## Solidity Version & Dependencies

| Component | Version |
|-----------|---------|
| Solidity | `^0.8.24` |
| OpenZeppelin Upgradeable | `5.x` |
| Foundry | Latest |
| Proxy Pattern | UUPS (EIP-1822) via `UUPSUpgradeable` |

## Storage Layout Rules

All contracts follow these rules to maintain upgrade safety:

1. Never delete or reorder existing storage variables
2. New variables are only appended at the end
3. Each contract reserves 50 storage slots via `uint256[50] private __gap`
4. Use `forge inspect <Contract> storage-layout` to verify before upgrades
