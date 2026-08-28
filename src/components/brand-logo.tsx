import { Link } from "@tanstack/react-router";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="BETFCOM SQs — início">
      <span className="bg-brand-gradient flex size-9 items-center justify-center rounded-xl font-display text-sm font-bold text-primary-foreground shadow-glow">
        SQ
      </span>
      {!compact && (
        <span className="font-display text-base font-semibold tracking-tight">
          BETFCOM <span className="text-brand-gradient">SQs</span>
        </span>
      )}
    </Link>
  );
}
