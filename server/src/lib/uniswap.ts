import { type Address, type PublicClient, encodeFunctionData } from "viem";
import type { PoolInfo } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const UNISWAP_ROUTER: Address = "0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15";
export const POSITION_MANAGER: Address = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
export const FACTORY: Address = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

// ---------------------------------------------------------------------------
// ABIs (minimal)
// ---------------------------------------------------------------------------

export const routerAbi = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const poolAbi = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  {
    name: "liquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    name: "token0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "token1",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "fee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint24" }],
  },
] as const;

export const factoryAbi = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Look up the Uniswap v3 pool address for a token pair + fee tier. */
export async function getPool(
  client: PublicClient,
  tokenA: Address,
  tokenB: Address,
  fee: number,
): Promise<Address> {
  const poolAddress = await client.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [tokenA, tokenB, fee],
  });
  return poolAddress as Address;
}

/** Read on-chain state of a Uniswap v3 pool. */
export async function getPoolInfo(
  client: PublicClient,
  poolAddress: Address,
): Promise<PoolInfo> {
  const [slot0Result, liquidityResult, token0Result, token1Result, feeResult] =
    await Promise.all([
      client.readContract({ address: poolAddress, abi: poolAbi, functionName: "slot0" }),
      client.readContract({ address: poolAddress, abi: poolAbi, functionName: "liquidity" }),
      client.readContract({ address: poolAddress, abi: poolAbi, functionName: "token0" }),
      client.readContract({ address: poolAddress, abi: poolAbi, functionName: "token1" }),
      client.readContract({ address: poolAddress, abi: poolAbi, functionName: "fee" }),
    ]);

  const slot0 = slot0Result as unknown as [bigint, number];
  const [sqrtPriceX96, tick] = slot0;

  return {
    address: poolAddress,
    token0: token0Result as Address,
    token1: token1Result as Address,
    fee: Number(feeResult),
    sqrtPriceX96,
    tick,
    liquidity: liquidityResult as bigint,
  };
}

/** Encode calldata for an exactInputSingle swap. */
export function encodeSwapCalldata(params: {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96?: bigint;
}): `0x${string}` {
  return encodeFunctionData({
    abi: routerAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        fee: params.fee,
        recipient: params.recipient,
        deadline: params.deadline,
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMinimum,
        sqrtPriceLimitX96: params.sqrtPriceLimitX96 ?? 0n,
      },
    ],
  });
}
