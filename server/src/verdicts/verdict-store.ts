import type { Verdict, VerdictStats } from "../types.js";

/**
 * In-memory verdict store (singleton).
 * Tracks all scanned tokens and their verdicts.
 */
class VerdictStore {
  private verdicts: Verdict[] = [];
  private scannedTokens: Set<string> = new Set();

  /** Prepend a verdict and mark the token as scanned. */
  add(verdict: Verdict): void {
    this.verdicts.unshift(verdict);
    this.scannedTokens.add(verdict.token.toLowerCase());
  }

  /** Check if a token address has already been scanned. */
  isScanned(token: string): boolean {
    return this.scannedTokens.has(token.toLowerCase());
  }

  /** Return the most recent N verdicts. */
  getRecent(limit: number): Verdict[] {
    return this.verdicts.slice(0, limit);
  }

  /** Find a verdict by token address (returns the most recent one). */
  getByToken(token: string): Verdict | undefined {
    const normalized = token.toLowerCase();
    return this.verdicts.find((v) => v.token.toLowerCase() === normalized);
  }

  /** Aggregate verdict statistics. */
  getStats(): VerdictStats {
    let totalSafe = 0;
    let totalCaution = 0;
    let totalDangerous = 0;
    let totalLpInvested = 0;

    for (const v of this.verdicts) {
      if (v.verdict === "SAFE") totalSafe++;
      else if (v.verdict === "CAUTION") totalCaution++;
      else if (v.verdict === "DANGEROUS") totalDangerous++;

      if (v.lpInvested) {
        totalLpInvested += Number(v.lpInvested);
      }
    }

    return {
      totalScanned: this.verdicts.length,
      totalSafe,
      totalCaution,
      totalDangerous,
      totalLpInvested,
      lpPnl: 0,
    };
  }

  /** Reset store (useful for testing). */
  clear(): void {
    this.verdicts = [];
    this.scannedTokens.clear();
  }
}

/** Singleton instance. */
export const verdictStore = new VerdictStore();
