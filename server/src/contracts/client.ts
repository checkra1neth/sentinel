import { createPublicClient, http, type Address, defineChain } from "viem";
import { config } from "../config.js";
import {
  registryAbi,
  escrowAbi,
  treasuryAbi,
  erc20Abi,
} from "./abis.js";

const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: {
    decimals: 18,
    name: "OKB",
    symbol: "OKB",
  },
  rpcUrls: {
    default: {
      http: [config.xlayerRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "OKLink",
      url: "https://www.oklink.com/xlayer",
    },
  },
});

export const publicClient = createPublicClient({
  chain: xlayer,
  transport: http(config.xlayerRpcUrl),
});

export async function getActiveServices(): Promise<readonly unknown[]> {
  return publicClient.readContract({
    address: config.contracts.registry,
    abi: registryAbi,
    functionName: "getActiveServices",
  });
}

export async function getService(id: number): Promise<unknown> {
  return publicClient.readContract({
    address: config.contracts.registry,
    abi: registryAbi,
    functionName: "getService",
    args: [BigInt(id)],
  });
}

export async function getOrder(id: number): Promise<unknown> {
  return publicClient.readContract({
    address: config.contracts.escrow,
    abi: escrowAbi,
    functionName: "getOrder",
    args: [BigInt(id)],
  });
}

export async function getAgentYield(agent: Address): Promise<bigint> {
  return publicClient.readContract({
    address: config.contracts.treasury,
    abi: treasuryAbi,
    functionName: "getAgentYield",
    args: [agent],
  });
}

export async function getUsdtBalance(address: Address): Promise<bigint> {
  return publicClient.readContract({
    address: config.contracts.usdt,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}
