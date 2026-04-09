// ---------------------------------------------------------------------------
// Sentinel Chat — Regex Command Parser
// Pure pattern matching, no LLM dependency.
// ---------------------------------------------------------------------------

export type CommandType =
  | "SWAP"
  | "SECURITY_SCAN"
  | "PORTFOLIO"
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
const AMOUNT_RE = /[\d]+(?:[.,]\d+)?/;
const PROTOCOL_RE = /[a-zA-Z][a-zA-Z0-9_\- ]{0,30}[a-zA-Z0-9]/;

/** Normalise user input: trim, strip leading slash, collapse whitespace, lowercase. */
const normalise = (input: string): string =>
  input.trim().replace(/^\//, "").replace(/\s+/g, " ").toLowerCase();

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

  // -- SWAP: "swap {amount} {token} to/for {token}" ----------------------
  {
    type: "SWAP",
    regex: new RegExp(
      `^swap\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_RE.source})\\s+(?:to|for)\\s+(${TOKEN_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      fromToken: m[2].toUpperCase(),
      toToken: m[3].toUpperCase(),
    }),
  },

  // -- SWAP (buy): "buy {amount} {token}" → from USDT --------------------
  {
    type: "SWAP",
    regex: new RegExp(
      `^buy\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      fromToken: "USDT",
      toToken: m[2].toUpperCase(),
    }),
  },

  // -- SWAP (sell): "sell {amount} {token}" → to USDT ---------------------
  {
    type: "SWAP",
    regex: new RegExp(
      `^sell\\s+(${AMOUNT_RE.source})\\s+(${TOKEN_RE.source})$`,
    ),
    extract: (m) => ({
      amount: m[1].replace(",", "."),
      fromToken: m[2].toUpperCase(),
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

  return { type: "UNKNOWN", params: {}, raw: input };
};

export const getHelpText = (): string => `
Sentinel Commands
─────────────────
  swap <amount> <token> to <token>   Swap tokens (e.g. swap 100 USDT to ETH)
  buy <amount> <token>               Buy token with USDT (e.g. buy 0.5 ETH)
  sell <amount> <token>              Sell token for USDT (e.g. sell 100 LINK)

  check <address>                    Security scan a contract address
  scan <address>                     Alias for check

  portfolio                          View your portfolio & balances
  balances                           Alias for portfolio
  wallet                             Alias for portfolio

  discover                           Find trending & new tokens
  find tokens                        Alias for discover
  trending                           Alias for discover

  deposit <amount> <token> into <protocol>   Deposit into DeFi protocol
  withdraw from <protocol>                   Withdraw from DeFi protocol

  help                               Show this help message
  ?                                  Alias for help
`.trim();
