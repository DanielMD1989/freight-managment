"use client";

/**
 * StarRating — Reusable 1-5 star display/selector
 * §12 Ratings & Reviews
 *
 * Interactive when onChange is provided, readonly otherwise.
 */

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };

export default function StarRating({
  value,
  onChange,
  size = "md",
}: StarRatingProps) {
  const sizeClass = SIZES[size];
  const interactive = !!onChange;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={`${interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"} focus:outline-none`}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          <svg
            className={`${sizeClass} ${star <= value ? "fill-amber-400 text-amber-400" : "fill-none text-slate-300 dark:text-slate-600"}`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
