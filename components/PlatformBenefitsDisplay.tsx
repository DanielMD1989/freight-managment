/**
 * Platform Benefits Display Component
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Displays platform benefits to incentivize platform use
 */

"use client";

interface PlatformBenefitsDisplayProps {
  variant?: "full" | "compact";
  className?: string;
}

export default function PlatformBenefitsDisplay({
  variant = "full",
  className = "",
}: PlatformBenefitsDisplayProps) {
  const benefits = [
    {
      title: "GPS Tracking Access",
      description:
        "Real-time tracking of your shipments with live updates and ETAs",
      icon: "📍",
    },
    {
      title: "Dispute Support & Resolution",
      description:
        "Professional mediation and support for any shipment disputes",
      icon: "🛡️",
    },
    {
      title: "POD Verification",
      description:
        "Proof of delivery system ensures accountability and transparency",
      icon: "📄",
    },
    {
      title: "Completion Rate & Verified Badges",
      description:
        "Build trust with verified status and high completion rate badges",
      icon: "✓",
    },
    {
      title: "Payment Protection",
      description: "Secure payment processing with corridor-based service fees",
      icon: "💳",
    },
    {
      title: "Priority Listing",
      description:
        "Verified companies get priority placement in search results",
      icon: "⭐",
    },
    {
      title: "Transparent Pricing",
      description: "Clear, predictable corridor-based service fees",
      icon: "💰",
    },
    {
      title: "Trust Score Bonus",
      description: "Higher trust scores lead to more business opportunities",
      icon: "📊",
    },
  ];

  if (variant === "compact") {
    return (
      <div
        className={`rounded-lg border border-[#1e9c99]/30 bg-[#1e9c99]/10 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-6 w-6 flex-shrink-0 text-[#1e9c99]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-semibold text-[#064d51]">
              Why Use Our Platform?
            </h3>
            <p className="text-sm text-[#064d51]/80">
              Get GPS tracking, dispute support, payment protection, and
              transparent corridor-based pricing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[#1e9c99]/30 bg-gradient-to-br from-[#f0fdfa] to-[#1e9c99]/10 shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="border-b border-[#1e9c99]/20 bg-white/50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1e9c99]">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#064d51]">
              Platform Benefits
            </h2>
            <p className="text-sm text-[#064d51]/70">
              Why completing loads through our platform benefits you
            </p>
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="rounded-lg border border-[#064d51]/15 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-3xl">{benefit.icon}</div>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-[#064d51]">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-[#064d51]/70">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-6 rounded-lg bg-gradient-to-r from-[#1e9c99] to-[#064d51] p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="mb-1 font-semibold">
                Build your reputation on our platform!
              </h3>
              <p className="text-sm text-white/80">
                Companies with high completion rates get priority listing and
                more business
              </p>
            </div>
            <svg
              className="h-8 w-8 text-white/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Benefits Banner Component
 *
 * Compact banner for displaying at top of load detail pages
 */
export function PlatformBenefitsBanner() {
  return (
    <div className="rounded-lg bg-gradient-to-r from-[#1e9c99] to-[#064d51] px-6 py-3 text-white shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <div>
            <p className="font-semibold">
              Complete through platform to get GPS tracking, dispute support &
              transparent pricing
            </p>
          </div>
        </div>
        <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#1e9c99] transition-colors hover:bg-[#f0fdfa]">
          Learn More
        </button>
      </div>
    </div>
  );
}
