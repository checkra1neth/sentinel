// ---------------------------------------------------------------------------
// Sentinel Chat — Regex Command Parser
// Pure pattern matching, no LLM dependency.
// ---------------------------------------------------------------------------

export type CommandType =
  | "SWAP"
  | "SECURITY_SCAN"
  | "PORTFOLIO"
  | "WALLET_LOOKUP"
  | "DISCOVERY"
  | "DEFI_DEPOSIT"
  | "DEFI_WITHDRAW"
  | "HELP"
  | "UNKNOWN";

export interface ParsedCommand {
  type: CommandType;
  params: Record<string, string>;
  raw: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ETH_ADDRESS_RE = /0x[a-fA-F0-9]{40}/;
const TOKEN_RE = /[a-zA-Z][a-zA-Z0-9]{0,10}/;
const TOKEN_OR_ADDR_RE = /(?:0x[a-fA-F0-9]{40}|[a-zA-Z][a-zA-Z0-9]{0,10})/;
const AMOUNT_RE = /[\d]+(?:[.,]\d+)?/;
const PROTOCOL_RE = /[a-zA-Z][a-zA-Z0-9_\- ]{0,30}[a-zA-Z0-9]/;

function normalizeToken(raw: string): string {
  return raw.startsWith("0x") ? raw.toLowerCase() : raw.toUpperCase();
}

/** Normalise user input: trim, strip leading slash, collapse whitespace, lowercase. */
const normalise = (input: string): string =>
  input.trim().replace(/^\//, "").replace(/\s+/g, " ").toLowerCase();

const CHAIN_NAMES: Record<string, string> = {
  eth: "1", ethereum: "1", mainnet: "1",
  bsc: "56", bnb: "56",
  polygon: "137", matic: "137",
  arbitrum: "42161", arb: "42161",
  optimism: "10", op: "10",
  base: "8453",
  avalanche: "43114", avax: "43114",
  fantom: "250", ftm: "250",
  zksync: "324", era: "324",
  xlayer: "196", "x layer": "196", okb: "196",
};

const CHAIN_SUFFIX_RE = /\s+on\s+(?:chain\s+)?(\S+)$/;

function extractChain(normalised: string): { cleaned: string; chainId?: string } {
  const m = normalised.match(CHAIN_SUFFIX_RE);
  if (!m) return { cleaned: normalised };
  const raw = m[1];
  const chainId = CHAIN_NAMES[raw] ?? (/^\d+$/.test(raw) ? raw : undefined);
  return { cleaned: normalised.replace(CHAIN_SUFFIX_RE, "").trim(), chainId };
}

// ---------------------------------------------------------------------------
// Pattern definitions  (order matters — first match wins)
// ---------------------------------------------------------------------------

interface PatternDef {
  type: CommandType;
  regex: RegExp;
  extract: (match: RegExpMatchArray) => Record<string, string>;
}

const patterns: PatternDef[] = [
  // -- HELP ---------------------------------------------------------------
  {
    type: "HELP",
    regex: /^(?:help|commands|\?)$/,
    extract: () => ({}),
  },

  // -- SWAP: "swap {amount} {token|addr} to/for {token|addr}" -----------
  {
    type: "SWAP",
    regex: new RegExp(
      `^swap\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_OR_ADDR_RE.source})\\s+(?:to|for)\\s+(${TOKEN_OR_ADDR_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      fromToken: normalizeToken(m[2]),
      toToken: normalizeToken(m[3]),
    }),
  },

  // -- SWAP (buy): "buy {amount} {token|addr}" → from USDT --------------
  {
    type: "SWAP",
    regex: new RegExp(
      `^buy\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_OR_ADDR_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      fromToken: "USDT",
      toToken: normalizeToken(m[2]),
    }),
  },

  // -- SWAP (sell): "sell {amount} {token|addr}" → to USDT ---------------
  {
    type: "SWAP",
    regex: new RegExp(
      `^sell\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_OR_ADDR_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      fromToken: normalizeToken(m[2]),
      toToken: "USDT",
    }),
  },

  // -- SECURITY_SCAN: "check/scan {address}" -----------------------------
  {
    type: "SECURITY_SCAN",
    regex: new RegExp(
      `^(?:check|scan|audit|verify)\\s+(${ETH_ADDRESS_RE.source})$`,
    ),
    extract: (m) => ({ address: m[1] }),
  },

  // -- SECURITY_SCAN: bare address ---------------------------------------
  {
    type: "SECURITY_SCAN",
    regex: new RegExp(`^(${ETH_ADDRESS_RE.source})$`),
    extract: (m) => ({ address: m[1] }),
  },

  // -- WALLET_LOOKUP: "lookup 0x..." or "check wallet 0x..." ------------
  {
    type: "WALLET_LOOKUP",
    regex: new RegExp(
      `^(?:lookup|check\\s+wallet|wallet\\s+info|info)\\s+(${ETH_ADDRESS_RE.source})$`,
    ),
    extract: (m) => ({ address: m[1] }),
  },

  // -- SECURITY_SCAN with chain: "scan {address} on {chain}" -----------
  {
    type: "SECURITY_SCAN",
    regex: new RegExp(
      `^(?:check|scan|audit|verify)\\s+(${ETH_ADDRESS_RE.source})\\s+on\\s+(?:chain\\s+)?(\\S+)$`,
    ),
    extract: (m) => {
      const chainRaw = m[2];
      const chainId = CHAIN_NAMES[chainRaw] ?? (/^\d+$/.test(chainRaw) ? chainRaw : undefined);
      return { address: m[1], ...(chainId ? { chainId } : {}) };
    },
  },

  // -- PORTFOLIO ----------------------------------------------------------
  {
    type: "PORTFOLIO",
    regex: /^(?:portfolio|balances|wallet|balance|my\s+wallet|my\s+portfolio|my\s+balances)$/,
    extract: () => ({}),
  },

  // -- DISCOVERY ----------------------------------------------------------
  {
    type: "DISCOVERY",
    regex: /^(?:discover|find\s+tokens|trending|hot\s+tokens|new\s+tokens|trending\s+tokens)$/,
    extract: () => ({}),
  },

  // -- DEFI_DEPOSIT: "deposit {amount} {token} into/on {protocol}" -------
  {
    type: "DEFI_DEPOSIT",
    regex: new RegExp(
      `^deposit\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_RE.source})\\s+(?:into|on|to|in)\\s+(${PROTOCOL_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      token: m[2].toUpperCase(),
      protocol: m[3].trim(),
    }),
  },

  // -- DEFI_WITHDRAW: "withdraw from {protocol}" -------------------------
  {
    type: "DEFI_WITHDRAW",
    regex: new RegExp(
      `^withdraw\\s+(?:from\\s+)?(${PROTOCOL_RE.source})$`,
    ),
    extract: (m) => ({ protocol: m[1].trim() }),
  },

  // -- DEFI_WITHDRAW: "withdraw {amount} {token} from {protocol}" --------
  {
    type: "DEFI_WITHDRAW",
    regex: new RegExp(
      `^withdraw\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_RE.source})\\s+from\\s+(${PROTOCOL_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      token: m[2].toUpperCase(),
      protocol: m[3].trim(),
    }),
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const parseCommand = (input: string): ParsedCommand => {
  const normalised = normalise(input);

  // Try exact match first
  for (const pattern of patterns) {
    const match = normalised.match(pattern.regex);
    if (match) {
      return {
        type: pattern.type,
        params: pattern.extract(match),
        raw: input,
      };
    }
  }

  // Try with chain suffix stripped (supports "swap 10 USDT to ETH on base")
  const { cleaned, chainId } = extractChain(normalised);
  if (chainId && cleaned !== normalised) {
    for (const pattern of patterns) {
      const match = cleaned.match(pattern.regex);
      if (match) {
        return {
          type: pattern.type,
          params: { ...pattern.extract(match), chainId },
          raw: input,
        };
      }
    }
  }

  return { type: "UNKNOWN", params: {}, raw: input };
};

export const getHelpText = (): string => `
Sentinel Commands
─────────────────
  swap <amount> <token> to <token>   Swap tokens (e.g. swap 100 USDT to ETH)
  buy <amount> <token>               Buy token with USDT (e.g. buy 0.5 ETH)
  sell <amount> <token>              Sell token for USDT (e.g. sell 100 LINK)

  Any swap/buy/sell supports "on <chain>":
    swap 10 USDT to ETH on base
    buy 0.5 ETH on arbitrum

  check <address>                    Security scan a contract address
  scan <address>                     Alias for check
  scan <address> on <chain>          Scan on specific chain

  lookup <address>                   View any wallet's balances & DeFi positions
  check wallet <address>             Alias for lookup

  portfolio                          View your portfolio & balances
  balances                           Alias for portfolio

  discover                           Find trending & new tokens
  trending                           Alias for discover

  deposit <amount> <token> into <protocol>   Deposit into DeFi protocol
  deposit ... on <chain>                     Deposit on specific chain
  withdraw from <protocol>                   Withdraw from DeFi protocol

  Supported chains: eth, bsc, polygon, arbitrum, base, optimism,
    avalanche, fantom, zksync, xlayer (or chain ID: 1, 56, 196...)

  help                               Show this help message
`.trim();
