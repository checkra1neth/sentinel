import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface DiscoverSettings {
  mode: "auto" | "manual";
  interval: string;
  sources: string[];
  trackWhales: boolean;
  trackSmartMoney: boolean;
  trackKol: boolean;
}

export interface AnalyzeSettings {
  mode: "auto" | "manual";
  useKline: boolean;
  useWhaleContext: boolean;
  riskThreshold: number;
}

export interface InvestSettings {
  mode: "auto" | "manual";
  maxPerPosition: number;
  strategy: "lp" | "swap" | "auto";
  stopLossPercent: number;
}

export interface ManageSettings {
  mode: "auto" | "manual";
  collectFeesInterval: string;
  rebalanceEnabled: boolean;
  stopLossEnabled: boolean;
}

export interface Settings {
  discover: DiscoverSettings;
  analyze: AnalyzeSettings;
  invest: InvestSettings;
  manage: ManageSettings;
}

const SETTINGS_PATH = join(process.cwd(), "settings.json");

const DEFAULTS: Settings = {
  discover: {
    mode: "auto",
    interval: "*/5 * * * *",
    sources: ["NEW", "MIGRATING", "MIGRATED"],
    trackWhales: true,
    trackSmartMoney: true,
    trackKol: false,
  },
  analyze: {
    mode: "auto",
    useKline: true,
    useWhaleContext: true,
    riskThreshold: 40,
  },
  invest: {
    mode: "auto",
    maxPerPosition: 10,
    strategy: "auto",
    stopLossPercent: 20,
  },
  manage: {
    mode: "auto",
    collectFeesInterval: "0 */6 * * *",
    rebalanceEnabled: true,
    stopLossEnabled: true,
  },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object") {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

let current: Settings = { ...DEFAULTS };

export const settings = {
  load(): void {
    if (existsSync(SETTINGS_PATH)) {
      try {
        const raw = readFileSync(SETTINGS_PATH, "utf-8");
        const saved = JSON.parse(raw) as Partial<Settings>;
        current = deepMerge(DEFAULTS as unknown as Record<string, unknown>, saved as unknown as Record<string, unknown>) as unknown as Settings;
      } catch {
        current = { ...DEFAULTS };
      }
    }
  },

  get(): Settings {
    return current;
  },

  update(patch: Partial<Settings>): Settings {
    current = deepMerge(current as unknown as Record<string, unknown>, patch as unknown as Record<string, unknown>) as unknown as Settings;
    try {
      writeFileSync(SETTINGS_PATH, JSON.stringify(current, null, 2));
    } catch { /* write failure is non-fatal */ }
    return current;
  },
};
