export const registryAbi = [
  {
    name: "registerService",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "serviceType", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "priceUsdt", type: "uint256" },
    ],
    outputs: [{ name: "serviceId", type: "uint256" }],
  },
  {
    name: "getActiveServices",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "agent", type: "address" },
          { name: "serviceType", type: "string" },
          { name: "endpoint", type: "string" },
          { name: "priceUsdt", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getService",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "serviceId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "agent", type: "address" },
          { name: "serviceType", type: "string" },
          { name: "endpoint", type: "string" },
          { name: "priceUsdt", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getServicesByType",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "serviceType", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "agent", type: "address" },
          { name: "serviceType", type: "string" },
          { name: "endpoint", type: "string" },
          { name: "priceUsdt", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const escrowAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "serviceId", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "release",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getOrder",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "agent", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "serviceId", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;

export const treasuryAbi = [
  {
    name: "getAgentYield",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalCollected",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const verdictRegistryAbi = [
  {
    name: "publishVerdict",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "riskScore", type: "uint8" },
      { name: "verdict", type: "string" },
      { name: "isHoneypot", type: "bool" },
      { name: "hasRug", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "verdictCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "sentinel",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "updateSentinel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_sentinel", type: "address" }],
    outputs: [],
  },
  {
    name: "VerdictPublished",
    type: "event",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "riskScore", type: "uint8", indexed: false },
      { name: "verdict", type: "string", indexed: false },
      { name: "isHoneypot", type: "bool", indexed: false },
      { name: "hasRug", type: "bool", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
