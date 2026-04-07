# Sentinel Frontend Redesign — Institutional Analytics Quality

## Context

Current frontend has AI slop patterns: colored accent borders, decorative sparklines with fake data, animated ping dots, cards-with-icons pattern, gradient backgrounds. User wants quality matching Arkham Intel, Nansen, Messari, Glassnode — data-dense, content-first, zero decoration.

## Design Principles

- **Data-first:** every pixel carries information. No decorative elements.
- **Single accent:** cyan `#06b6d4` for interactive elements only. Red/green/yellow only for data meaning (profit/loss/caution).
- **Typography hierarchy:** size and weight differences, never colored borders or backgrounds.
- **Real data only:** no sparklines with generated data, no placeholder metrics.
- **Tables over cards:** data tables for structured information, text lines for summaries.

## Foundation

### Palette
- Background: `#09090b`
- Surface: `#111318`
- Text primary: `#fafafa`
- Text secondary: `#a1a1aa`
- Text tertiary: `#52525b`
- Border: `rgba(255,255,255,0.06)`
- Accent (interactive): `#06b6d4`
- Safe: `#34d399`
- Caution: `#f59e0b`
- Dangerous: `#ef4444`

### Typography
- UI: `Geist Sans` (npm package `geist`)
- Data/mono: `Geist Mono`
- Hierarchy: 400/500/600 weight, size steps: 11px, 13px, 15px, 20px, 32px

### Components
- Borders: `rgba(255,255,255,0.06)` only
- Shadows: black elevation only — `0 4px 12px -4px rgba(0,0,0,0.5)`
- No colored borders, no accent strips, no ping animations
- Hover states: `bg-white/[0.04]` background shift

### Navigation
- Top bar: logo left, nav center (Feed, Portfolio, Agents), wallet right
- No background gradient, border-bottom `rgba(255,255,255,0.06)`

## Pages

### Landing (`/`)

**Hero:** Large heading left — "Sentinel" + one sentence description. Right side — live stat from `/api/stats` (tokens scanned count). One CTA button "Open Dashboard" linking to `/feed`.

**Social proof bar:** Single line of real metrics — `{totalScanned} tokens scanned · 94% accuracy · 3 autonomous agents · X Layer`

**How it works:** Three short text paragraphs (Scanner, Analyst, Executor), 2 sentences each. Adjacent: table of last 5 verdicts from `/api/verdicts?limit=5` with live data.

**Footer:** Minimal single line — GitHub, Docs, X Layer Explorer links.

**Remove entirely:** TiltFrame, PipelineGsap, HeroAgents, AuroraBg, CursorGlow, ScanPulse, terminal fake feed, OnchainOS Skills grid, animated CTA section.

### Feed (`/feed`)

**Scan input:** Simple — input field + Scan button. No sample token buttons.

**Stats line:** Inline text — `Scanned {n} · Safe {n} · Threats {n} · LP ${n}`. No cards, no icons.

**Agent status line:** `Scanner 0x38c7...4db2 · Analyst 0x8743...ce03 · Executor 0x7500...ee00` with green dot if online.

**Threat Feed (main element):** Data table with columns: Verdict, Token, Risk, Price, MCap, Liq, Tax, Time. Click row to expand details (risks array, holder concentration, DeFi pool, tx link, rescan button).

**Agent Activity:** Terminal-style log at bottom. Plain text with timestamps: `22:15:34 SCANNER identified 0xabc1...`. No icons, no colored dots per type.

### Agents (`/agents`)

**Stats line:** Same format as Feed — `Scanned {n} · Safe {n} · Caution {n} · Dangerous {n} · Events {n}`

**Agent sections:** Three horizontal full-width blocks (not cards), one per agent:
```
SCANNER · Token Discovery · 0x38c7...4db2 · 0.00 USDT
────────────────────────────────────────────────────────
Sources: dex-trenches, dex-signal, dex-token
Last scan: 2m ago · Tokens found today: 24 · Queue: 3
Recent: 0xabc1... (PEPE) · 0xdef4... (WETH) · 0x789...
```

No icons in colored circles, no progress bars, no fake sparklines. Only real metrics from API.

**Event Log:** Full-width data table below agents. Columns: Type, Time, Agent, Message. Mono font. Verdict type colored (green/yellow/red) — only place color carries data meaning.

### Portfolio (`/portfolio`)

**Summary line:** `Total Invested ${n} · Positions {n} · Avg APR {n}% · Executor 0x7500...ee00`

**Positions table:** Columns: Token, Pool, Invested, APR, TVL, Range, Age. Empty state: `No positions yet. Executor invests in tokens rated SAFE.`

## Files to Delete

- `src/components/tilt-frame.tsx`
- `src/components/pipeline-gsap.tsx`
- `src/components/hero-agents.tsx`
- `src/components/aurora-bg.tsx`
- `src/components/cursor-glow.tsx`
- `src/components/scan-pulse.tsx`
- `src/components/inline-stats.tsx`

## Files to Rewrite

- `src/app/page.tsx` — new landing
- `src/app/feed/page.tsx` — data table layout
- `src/app/agents/page.tsx` — horizontal sections + event log
- `src/app/portfolio/page.tsx` — positions table
- `src/app/layout.tsx` — Geist font, clean nav
- `src/app/globals.css` — stripped palette, remove unused tokens
- `src/components/scan-input.tsx` — simplified
- `src/components/verdict-row.tsx` — table row, not card
- `src/components/live-feed.tsx` — terminal text log
- `src/components/agent-panel.tsx` — text line, not panel
- `src/components/nav-links.tsx` — clean minimal nav
- `src/components/connect-button.tsx` — minimal style

## Dependencies

**Add:** `geist` (font package)

**Remove from pages (keep if used elsewhere):** `gsap`, `gsap/ScrollTrigger`, `gsap/SplitText`, `lenis` — replace all animations with CSS transitions.

## Data Sources (existing, no new endpoints)

- `/api/stats` — scanned/safe/caution/dangerous counts, LP invested, event stats
- `/api/agents` — agent names, wallet addresses, USDT balances
- `/api/verdicts?limit=N` — verdict list for tables
- `/api/portfolio` — LP positions, total invested, avg APR
- `/api/events/history?limit=N` — event log
- WebSocket `/api/events` — real-time agent activity

## Verification

1. All pages render with real API data (backend running on :3002)
2. No colored accent borders/strips anywhere
3. No fake/generated sparkline data
4. Geist font loads correctly
5. Tables are responsive (horizontal scroll on mobile)
6. Empty states show meaningful text, not decorative icons
7. GSAP/Lenis fully removed from page bundles
8. Lighthouse performance score improved (less JS)
