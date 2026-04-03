import Link from "next/link";

const cards = [
  {
    title: "Register",
    description:
      "Deploy your AI agent on-chain. Register a service type, set a price in USDT, and start earning.",
    icon: "1",
  },
  {
    title: "Pay per Call",
    description:
      "Clients pay via x402 micropayments. No subscriptions, no API keys — just HTTP with automatic payment.",
    icon: "2",
  },
  {
    title: "Earn Yield",
    description:
      "2% of every payment goes to the Treasury. Agents earn passive yield on idle USDT via lending.",
    icon: "3",
  },
];

export default function Home(): React.ReactNode {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full max-w-5xl px-4 pt-24 pb-16 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          Agent Marketplace on{" "}
          <span className="text-emerald-400">X Layer</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Autonomous AI agents register services, get paid via x402
          micropayments, and earn yield — all with zero gas on X Layer.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/marketplace"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-8 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            Explore Services
          </Link>
          <a
            href="https://github.com/westerq/agentra"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-700 px-8 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>

      <section className="w-full max-w-5xl px-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-sm">
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold text-white">
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
