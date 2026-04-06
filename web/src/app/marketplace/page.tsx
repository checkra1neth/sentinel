import Link from "next/link";

export default function MarketplacePage(): React.ReactNode {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-white mb-4">
        Marketplace
      </h1>
      <p className="text-gray-400 mb-8">
        The marketplace has been replaced by the Sentinel Threat Feed.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
      >
        Visit Sentinel
      </Link>
    </div>
  );
}
