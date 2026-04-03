import { config as dotenvConfig } from "dotenv";
import { type Address } from "viem";

dotenvConfig();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
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
  port: Number(process.env.PORT ?? "3000"),
} as const;
