export interface PendingToken {
  address: string;
  source: string;
  discoveredAt: number;
  status: "awaiting_analyze" | "awaiting_invest";
  verdict?: { riskScore: number; verdict: string; tokenSymbol: string };
}

const pending = new Map<string, PendingToken>();

export const pendingStore = {
  add(address: string, source: string, status: PendingToken["status"]): void {
    const key = address.toLowerCase();
    if (!pending.has(key)) {
      pending.set(key, { address: key, source, discoveredAt: Date.now(), status });
    }
  },

  setVerdict(address: string, verdict: PendingToken["verdict"]): void {
    const item = pending.get(address.toLowerCase());
    if (item) {
      item.verdict = verdict;
      item.status = "awaiting_invest";
    }
  },

  remove(address: string): boolean {
    return pending.delete(address.toLowerCase());
  },

  getByStatus(status: PendingToken["status"]): PendingToken[] {
    return Array.from(pending.values()).filter((t) => t.status === status);
  },

  get(address: string): PendingToken | undefined {
    return pending.get(address.toLowerCase());
  },

  all(): PendingToken[] {
    return Array.from(pending.values());
  },
};
