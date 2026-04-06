import Link from "next/link";

export default function MarketplacePage(): React.ReactNode {
  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-[#e8eaed] mb-4">
        Marketplace
      </h1>
      <p className="text-[#7a7f8a] mb-8">
        The marketplace has been replaced by the Sentinel Threat Feed.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-[#6366f1] px-6 text-sm font-semibold text-[#e8eaed] hover:bg-[#818cf8] transition-colors"
      >
        Visit Sentinel
      </Link>
    </div>
  );
}
