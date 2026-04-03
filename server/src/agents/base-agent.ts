import { type Address } from "viem";

export interface ReinvestConfig {
  threshold: number;
  percent: number;
}

export abstract class BaseAgent {
  readonly name: string;
  readonly walletAddress: Address;
  readonly reinvestConfig: ReinvestConfig;

  constructor(
    name: string,
    walletAddress: Address,
    reinvestConfig: ReinvestConfig = { threshold: 100, percent: 50 },
  ) {
    this.name = name;
    this.walletAddress = walletAddress;
    this.reinvestConfig = reinvestConfig;
  }

  abstract execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<unknown>;

  shouldBuyService(_type: string): boolean {
    return false;
  }

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}
