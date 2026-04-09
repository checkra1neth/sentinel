// ---------------------------------------------------------------------------
// Moltbook Poster — posts quality content to m/buildx community
// Rate-limited, non-critical module: errors are logged, never crash the server.
// ---------------------------------------------------------------------------

const BASE_URL = "https://www.moltbook.com/api/v1";

// ---------------------------------------------------------------------------
// Number-word map
// ---------------------------------------------------------------------------

const WORD_TO_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerificationPayload {
  verification_code: string;
  challenge_text: string;
}

interface PostResponse {
  post?: {
    id?: number;
    verification?: VerificationPayload & { instructions?: string };
  };
  error?: string;
}

interface ActivityStats {
  scansCompleted: number;
  threatsBlocked: number;
  tradesExecuted: number;
  guardianAccuracy: number;
}

interface SecurityFinding {
  tokenSymbol: string;
  tokenAddress: string;
  verdict: string;
  riskScore: number;
  risks: string[];
}

// ---------------------------------------------------------------------------
// MoltbookPoster
// ---------------------------------------------------------------------------

export class MoltbookPoster {
  private lastPostTime = 0;
  private readonly MIN_INTERVAL = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly apiKey: string) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Post to m/buildx. Returns true if the post was created successfully. */
  async post(title: string, content: string): Promise<boolean> {
    try {
      if (!this.canPost()) {
        console.log("[moltbook] Rate-limited — skipping post");
        return false;
      }

      const res = await fetch(`${BASE_URL}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          submolt_name: "buildx",
          title: title.slice(0, 300),
          content: content.slice(0, 40_000),
        }),
      });

      if (!res.ok) {
        console.error(`[moltbook] POST /posts failed: ${res.status} ${res.statusText}`);
        return false;
      }

      const data = (await res.json()) as PostResponse;

      // Handle verification challenge
      if (data.post?.verification) {
        const verified = await this.solveVerification(data.post.verification);
        if (!verified) {
          console.warn("[moltbook] Verification challenge failed");
          return false;
        }
      }

      this.lastPostTime = Date.now();
      console.log(`[moltbook] Posted to m/buildx: "${title}"`);
      return true;
    } catch (err) {
      console.error("[moltbook] post() error:", err);
      return false;
    }
  }

  /** True if enough time has elapsed since the last post. */
  canPost(): boolean {
    return Date.now() - this.lastPostTime >= this.MIN_INTERVAL;
  }

  // -----------------------------------------------------------------------
  // Verification
  // -----------------------------------------------------------------------

  /** Solve the verification math challenge and submit the answer. */
  private async solveVerification(verification: VerificationPayload): Promise<boolean> {
    try {
      const answer = this.parseChallenge(verification.challenge_text);
      if (answer === null) {
        console.warn("[moltbook] Could not parse verification challenge");
        return false;
      }

      const res = await fetch(`${BASE_URL}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          verification_code: verification.verification_code,
          answer: answer.toFixed(2),
        }),
      });

      if (!res.ok) {
        console.error(`[moltbook] POST /verify failed: ${res.status} ${res.statusText}`);
        return false;
      }

      console.log(`[moltbook] Verification solved: ${answer.toFixed(2)}`);
      return true;
    } catch (err) {
      console.error("[moltbook] solveVerification() error:", err);
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Challenge parser
  // -----------------------------------------------------------------------

  /**
   * Parse an obfuscated math challenge string.
   *
   * Example input:
   *   "A] lO^bSt-Er S[wImS aT/ tW]eNn-Tyy mE^tE[rS aNd] SlO/wS bY^ fI[vE"
   *
   * Steps:
   *  1. Strip special chars: ] ^ - [ / \
   *  2. Lowercase
   *  3. Deduplicate consecutive identical letters (e.g. "tyy" -> "ty")
   *  4. Extract number words and operation keyword
   *  5. Compute
   */
  parseChallenge(text: string): number | null {
    try {
      // 1. Remove special decoration characters
      const stripped = text.replace(/[\]\[^/\\-]/g, " ");

      // 2. Lowercase and normalise whitespace
      const lower = stripped.toLowerCase().replace(/\s+/g, " ").trim();

      // 3. Deduplicate consecutive identical letters within each word
      const deduped = lower
        .split(" ")
        .map((w) => w.replace(/(.)\1+/g, "$1"))
        .join(" ");

      // 4. Tokenise
      const words = deduped.split(" ");

      // 5. Extract numbers
      const numbers: number[] = [];
      let compound = 0;
      let hasCompound = false;

      for (const w of words) {
        if (w in WORD_TO_NUM) {
          const val = WORD_TO_NUM[w];
          if (val === 100) {
            // e.g. "two hundred" = 2 * 100
            compound = (compound || 1) * 100;
          } else if (val >= 20 && hasCompound && compound % 10 === 0 && compound < 100) {
            // shouldn't happen but guard
            compound += val;
          } else if (hasCompound && compound >= 20 && val < 10) {
            // e.g. "twenty five" = 25
            compound += val;
          } else if (hasCompound) {
            // New number starts — flush previous
            numbers.push(compound);
            compound = val;
          } else {
            compound = val;
          }
          hasCompound = true;
        } else if (hasCompound) {
          // Non-number word encountered — flush compound
          numbers.push(compound);
          compound = 0;
          hasCompound = false;
        }
      }
      if (hasCompound) numbers.push(compound);

      if (numbers.length < 2) return null;

      // 6. Detect operation
      type Op = "+" | "-" | "*" | "/";
      let op: Op | null = null;

      const addWords = ["adds", "plus", "gains", "increases", "more"];
      const subWords = ["slows", "minus", "loses", "drops", "decreases", "less", "subtracts"];
      const mulWords = ["times", "multiplied", "multiplies"];
      const divWords = ["divided", "divides", "splits"];

      for (const w of words) {
        if (addWords.includes(w)) { op = "+"; break; }
        if (subWords.includes(w)) { op = "-"; break; }
        if (mulWords.includes(w)) { op = "*"; break; }
        if (divWords.includes(w)) { op = "/"; break; }
      }

      if (!op) return null;

      const a = numbers[0];
      const b = numbers[1];

      switch (op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? null : a / b;
      }
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Content formatters (static)
  // -----------------------------------------------------------------------

  /** Format an activity summary post for m/buildx. */
  static formatActivitySummary(stats: ActivityStats): { title: string; content: string } {
    const title = `Sentinel Daily Report: ${stats.scansCompleted} scans, ${stats.threatsBlocked} threats blocked`;
    const content = [
      "## Sentinel Agent Activity Summary\n",
      `- **Scans completed:** ${stats.scansCompleted}`,
      `- **Threats blocked:** ${stats.threatsBlocked}`,
      `- **Trades executed:** ${stats.tradesExecuted}`,
      `- **Guardian accuracy:** ${(stats.guardianAccuracy * 100).toFixed(1)}%\n`,
      "_Automated report from the Sentinel Security Oracle._",
    ].join("\n");

    return { title: title.slice(0, 300), content };
  }

  /** Format a security finding post for m/buildx. */
  static formatSecurityFinding(finding: SecurityFinding): { title: string; content: string } {
    const addr = `${finding.tokenAddress.slice(0, 6)}...${finding.tokenAddress.slice(-4)}`;
    const title = `Security Alert: ${finding.tokenSymbol} (${addr}) — ${finding.verdict}`;

    const risksFormatted = finding.risks.length > 0
      ? finding.risks.map((r) => `- ${r}`).join("\n")
      : "- None identified";

    const content = [
      `## Token Security Finding: ${finding.tokenSymbol}\n`,
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Address** | \`${finding.tokenAddress}\` |`,
      `| **Verdict** | ${finding.verdict} |`,
      `| **Risk Score** | ${finding.riskScore}/100 |\n`,
      `### Identified Risks\n`,
      risksFormatted,
      "",
      "_Automated finding from the Sentinel Security Oracle._",
    ].join("\n");

    return { title: title.slice(0, 300), content };
  }
}
