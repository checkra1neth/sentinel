import { config as dotenvConfig } from "dotenv";
import { type Address } from "viem";

dotenvConfig();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const config = {
  xlayerRpcUrl: required("XLAYER_RPC_URL"),
  chainId: Number(process.env.CHAIN_ID ?? "196"),

  contracts: {
    registry: required("REGISTRY_ADDRESS") as Address,
    escrow: required("ESCROW_ADDRESS") as Address,
    treasury: required("TREASURY_ADDRESS") as Address,
    usdt: required("USDT_ADDRESS") as Address,
  },

  okx: {
    apiKey: required("OKX_API_KEY"),
    secretKey: required("OKX_SECRET_KEY"),
    passphrase: required("OKX_PASSPHRASE"),
  },

  wallets: {
    analyst: {
      accountId: optional("ANALYST_ACCOUNT_ID"),
      address: optional("ANALYST_WALLET_ADDRESS") as Address,
    },
    auditor: {
      accountId: optional("AUDITOR_ACCOUNT_ID"),
      address: optional("AUDITOR_WALLET_ADDRESS") as Address,
    },
    trader: {
      accountId: optional("TRADER_ACCOUNT_ID"),
      address: optional("TRADER_WALLET_ADDRESS") as Address,
    },
  },

  cron: {
    analystInterval: optional("ANALYST_CRON", "*/30 * * * *"),
    reinvestInterval: optional("REINVEST_CRON", "0 */6 * * *"),
  },

  uniswap: {
    apiKey: optional("UNISWAP_API_KEY"),
    tradingApiUrl: "https://trade-api.gateway.uniswap.org/v1",
  },

  port: Number(process.env.PORT ?? "3000"),
} as const;
