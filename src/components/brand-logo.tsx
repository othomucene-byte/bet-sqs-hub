import { Link } from "@tanstack/react-router";
import brandAsset from "@/assets/betfcom-brand.jpeg.asset.json";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Betfcom SQs — início">
      <img src={brandAsset.url} alt="" className="size-10 shrink-0 rounded-lg object-cover sm:size-11" />
      {!compact && (
        <span className="min-w-0 font-display text-sm font-semibold leading-tight sm:text-base">
          Betfcom <span className="block text-[11px] font-medium text-primary sm:text-xs">SQs</span>
        </span>
      )}
    </Link>
  );
}
