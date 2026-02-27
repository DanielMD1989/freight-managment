import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PhoneMockup from "@/components/landing/PhoneMockup";

export default async function Home() {
  const session = await getSession();

  if (session) {
    // Redirect to role-appropriate portal
    if (session.role === "CARRIER") {
      redirect("/carrier");
    } else if (session.role === "DISPATCHER") {
      redirect("/dispatcher/dashboard");
    } else if (session.role === "SHIPPER") {
      redirect("/shipper");
    } else if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
      redirect("/admin");
    } else {
      redirect("/login");
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 right-0 left-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="from-primary-500 to-primary-600 shadow-primary-500/25 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900">
                FreightET
              </span>
            </div>

            {/* Nav Links */}
            <div className="hidden items-center gap-8 md:flex">
              <a
                href="#features"
                className="hover:text-primary-600 text-sm font-medium text-slate-600 transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hover:text-primary-600 text-sm font-medium text-slate-600 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#coverage"
                className="hover:text-primary-600 text-sm font-medium text-slate-600 transition-colors"
              >
                Coverage
              </a>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hover:text-primary-600 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 shadow-primary-500/25 rounded-lg bg-gradient-to-r px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
        {/* Background with realistic Ethiopian imagery */}
        <div className="absolute inset-0">
          <img
            src="/images/hero/ethiopia-caravan.jpg"
            alt="Ethiopian salt caravan in Danakil Depression"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          {/* Multi-layer overlay for optimal text readability while showing image */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/50 to-slate-900/80"></div>
          <div className="from-primary-900/60 to-primary-900/60 absolute inset-0 bg-gradient-to-r via-transparent"></div>
        </div>

        <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-900/60 px-5 py-2 shadow-lg backdrop-blur-md">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400"></span>
              <span className="text-sm font-semibold text-white">
                Ethiopia&apos;s #1 Freight Platform
              </span>
            </div>

            <h1 className="mb-6 text-4xl leading-tight font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] sm:text-5xl lg:text-6xl">
              <span className="text-white">Move Freight Across Ethiopia</span>
              <br />
              <span className="text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                Faster & Smarter
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] sm:text-xl">
              Connect with verified carriers, track shipments in real-time, and
              streamline your logistics operations with Ethiopia&apos;s most
              trusted freight platform.
            </p>

            {/* CTA Buttons */}
            <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="from-accent-600 to-accent-500 hover:from-accent-700 hover:to-accent-600 shadow-accent-500/30 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-8 py-4 text-base font-semibold text-white shadow-lg transition-all sm:w-auto"
              >
                Start Shipping Today
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
              <Link
                href="/register?role=carrier"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:w-auto"
              >
                Join as Carrier
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
              {[
                { value: "5,000+", label: "Active Trucks" },
                { value: "2,500+", label: "Verified Carriers" },
                { value: "50K+", label: "Loads Delivered" },
                { value: "98%", label: "On-Time Delivery" },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-center backdrop-blur-sm"
                >
                  <div className="mb-1 text-2xl font-bold text-white drop-shadow-lg sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium text-white/80">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Problem */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400">
                The Challenge
              </div>
              <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
                Traditional freight in Ethiopia is{" "}
                <span className="text-red-400">broken</span>
              </h2>
              <div className="space-y-4">
                {[
                  "Hours wasted calling brokers and middlemen",
                  "No visibility once your cargo leaves the warehouse",
                  "Unreliable carriers with no verification",
                  "Payment disputes and delayed settlements",
                ].map((problem, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
                      <svg
                        className="h-4 w-4 text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <span className="text-slate-300">{problem}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-medium text-emerald-400">
                Our Solution
              </div>
              <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
                FreightET makes it{" "}
                <span className="text-emerald-400">simple</span>
              </h2>
              <div className="space-y-4">
                {[
                  "Post a load and get matched with carriers in minutes",
                  "Track every shipment with real-time GPS",
                  "All carriers are verified and rated by shippers",
                  "Secure digital payments with instant settlement",
                ].map((solution, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                      <svg
                        className="h-4 w-4 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-slate-300">{solution}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="from-primary-900 to-primary-900 relative overflow-hidden bg-gradient-to-br via-slate-900 py-20"
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              Everything you need to move freight
            </h2>
            <p className="text-lg text-slate-300">
              Powerful features designed for Ethiopian logistics companies of
              all sizes
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ),
                title: "Real-Time GPS Tracking",
                description:
                  "Track every truck in your fleet with live GPS updates. Know exactly where your cargo is at all times.",
                color: "primary",
              },
              {
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                ),
                title: "Smart Load Matching",
                description:
                  "Our AI matches your loads with the best available trucks based on route, capacity, and carrier ratings.",
                color: "accent",
              },
              {
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                ),
                title: "Verified Carriers",
                description:
                  "Every carrier goes through our verification process. View ratings, reviews, and safety records.",
                color: "emerald",
              },
              {
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
                title: "Digital Payments",
                description:
                  "Secure payments, instant settlements, and complete transaction history. No more cash disputes.",
                color: "primary",
              },
              {
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                ),
                title: "Document Management",
                description:
                  "Upload and manage all shipping documents digitally. PODs, invoices, and customs papers in one place.",
                color: "accent",
              },
              {
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                ),
                title: "Mobile App",
                description:
                  "Manage your shipments on the go. Available for iOS and Android for both shippers and carriers.",
                color: "emerald",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group hover:border-primary-500/30 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/10"
              >
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${
                    feature.color === "primary"
                      ? "bg-primary-500/20 text-primary-400"
                      : feature.color === "accent"
                        ? "bg-accent-500/20 text-accent-400"
                        : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App Section */}
      <section className="via-primary-950 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Phone Mockup */}
            <div className="order-2 lg:order-1">
              <PhoneMockup />
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-sm font-medium text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                Coming Soon
              </div>

              <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
                FreightET in your pocket
              </h2>
              <p className="mb-8 text-lg text-slate-300">
                Manage your entire logistics operation from anywhere. Our mobile
                app gives you full control over loads, tracking, and payments -
                all from your smartphone.
              </p>

              <div className="mb-8 space-y-4">
                {[
                  {
                    icon: (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    ),
                    title: "Live GPS Tracking",
                    description:
                      "Track every shipment in real-time with instant notifications",
                  },
                  {
                    icon: (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                    ),
                    title: "Instant Notifications",
                    description:
                      "Get alerts for new loads, status updates, and payments",
                  },
                  {
                    icon: (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    ),
                    title: "Digital Documents",
                    description:
                      "Upload PODs, invoices, and documents on the go",
                  },
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="bg-primary-500/20 text-primary-400 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-white">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* App Store Buttons */}
              <div className="flex flex-wrap gap-4">
                <button className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-slate-300">
                      Download on the
                    </div>
                    <div className="font-semibold">App Store</div>
                  </div>
                </button>
                <button className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3 20.5v-17c0-.83.67-1.5 1.5-1.5.31 0 .61.1.86.28l12.5 8.5c.54.37.54 1.08 0 1.45l-12.5 8.5c-.25.18-.55.28-.86.28-.83 0-1.5-.67-1.5-1.5z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-slate-300">Get it on</div>
                    <div className="font-semibold">Google Play</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              Get started in 3 simple steps
            </h2>
            <p className="text-lg text-slate-300">
              Whether you&apos;re a shipper or carrier, getting started takes
              just minutes
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Create Your Account",
                description:
                  "Sign up in under 2 minutes. We'll verify your business and you're ready to go.",
                forShipper:
                  "Post your company details and shipping requirements",
                forCarrier: "Add your trucks and coverage areas",
              },
              {
                step: "02",
                title: "Post or Find Loads",
                description:
                  "Shippers post loads, carriers browse and bid. Our matching algorithm does the rest.",
                forShipper: "Describe your cargo, route, and timeline",
                forCarrier: "Search loads matching your trucks and routes",
              },
              {
                step: "03",
                title: "Ship & Track",
                description:
                  "Accept a match, track in real-time, and complete delivery with digital POD.",
                forShipper: "Track your cargo from pickup to delivery",
                forCarrier: "Navigate, update status, and get paid",
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-primary-500/30 mb-4 text-6xl font-bold">
                  {item.step}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mb-4 text-slate-400">{item.description}</p>
                <div className="space-y-2 text-sm">
                  <div className="text-primary-400 flex items-center gap-2">
                    <span className="font-medium">Shipper:</span>
                    <span className="text-slate-400">{item.forShipper}</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-400">
                    <span className="font-medium">Carrier:</span>
                    <span className="text-slate-400">{item.forCarrier}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ethiopia Coverage Section */}
      <section
        id="coverage"
        className="from-primary-900 to-primary-900 relative overflow-hidden bg-gradient-to-br via-slate-900 py-20"
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
                Covering all major routes across Ethiopia
              </h2>
              <p className="mb-8 text-lg text-slate-300">
                From Addis Ababa to Djibouti, Mekelle to Moyale, our network of
                carriers covers every major trade corridor in Ethiopia.
              </p>

              <div className="grid grid-cols-2 gap-6">
                {[
                  { route: "Addis - Djibouti", trucks: "500+ trucks" },
                  { route: "Addis - Mekelle", trucks: "300+ trucks" },
                  { route: "Addis - Dire Dawa", trucks: "400+ trucks" },
                  { route: "Addis - Moyale", trucks: "200+ trucks" },
                  { route: "Addis - Gondar", trucks: "250+ trucks" },
                  { route: "Addis - Jimma", trucks: "180+ trucks" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                  >
                    <div className="font-semibold text-white">{item.route}</div>
                    <div className="text-primary-300 text-sm">
                      {item.trucks}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ethiopia Map - Realistic Route Map */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
                <img
                  src="/images/hero/ethiopia-routes-map.jpg"
                  alt="Ethiopian National Transportation Route Map showing Addis Ababa to Djibouti corridor"
                  className="h-auto w-full"
                />
              </div>

              {/* Djibouti highlight badge */}
              <div className="absolute top-4 right-4 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                Addis ↔ Djibouti Corridor
              </div>

              {/* Stats overlay */}
              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold text-white">11</div>
                  <div className="text-xs text-slate-400">Regions</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold text-white">50+</div>
                  <div className="text-xs text-slate-400">Cities</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold text-white">100+</div>
                  <div className="text-xs text-slate-400">Routes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="from-primary-900 to-primary-900 relative overflow-hidden bg-gradient-to-br via-slate-900 py-20">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              Trusted by leading companies
            </h2>
            <p className="text-lg text-slate-300">
              Join hundreds of businesses who rely on FreightET for their
              logistics needs
            </p>
          </div>

          {/* Testimonials */}
          <div className="mb-16 grid gap-8 md:grid-cols-3">
            {[
              {
                quote:
                  "FreightET cut our logistics costs by 30% and gave us complete visibility into our shipments. Game changer for our business.",
                author: "Abebe Tadesse",
                role: "Logistics Manager",
                company: "Ethiopian Imports PLC",
              },
              {
                quote:
                  "As a carrier, I've doubled my loads since joining FreightET. The platform makes it easy to find profitable routes.",
                author: "Mulugeta Gebre",
                role: "Fleet Owner",
                company: "MG Transport",
              },
              {
                quote:
                  "The GPS tracking feature gives our clients peace of mind. They can see exactly where their goods are at any time.",
                author: "Sara Mohammed",
                role: "Operations Director",
                company: "Ethio Cargo Solutions",
              },
            ].map((testimonial, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, j) => (
                    <svg
                      key={j}
                      className="h-5 w-5 text-amber-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="mb-4 text-slate-300">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div>
                  <div className="font-semibold text-white">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-slate-400">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 border-t border-white/10 pt-8">
            <div className="flex items-center gap-2 text-slate-300">
              <svg
                className="h-5 w-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span className="text-sm font-medium">Verified Carriers</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <svg
                className="text-primary-400 h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span className="text-sm font-medium">Secure Payments</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <svg
                className="h-5 w-5 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span className="text-sm font-medium">24/7 Support</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <svg
                className="h-5 w-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm font-medium">Real-Time GPS</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="from-primary-700 to-primary-600 bg-gradient-to-r py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
            Ready to transform your logistics?
          </h2>
          <p className="text-primary-100 mx-auto mb-8 max-w-2xl text-lg">
            Join thousands of businesses already using FreightET. Start shipping
            smarter today.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="text-primary-700 hover:bg-primary-50 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold shadow-lg transition-all sm:w-auto"
            >
              Get Started Free
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10 sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 pt-16 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4 flex items-center gap-3">
                <div className="from-primary-500 to-primary-600 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                    />
                  </svg>
                </div>
                <span className="text-lg font-bold text-white">FreightET</span>
              </div>
              <p className="text-sm text-slate-400">
                Ethiopia&apos;s premier freight management platform connecting
                shippers with carriers.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-white">Platform</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a
                    href="#features"
                    className="transition-colors hover:text-white"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    className="transition-colors hover:text-white"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="#coverage"
                    className="transition-colors hover:text-white"
                  >
                    Coverage
                  </a>
                </li>
                <li>
                  <Link
                    href="/register"
                    className="transition-colors hover:text-white"
                  >
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-white">For Business</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link
                    href="/register?role=shipper"
                    className="transition-colors hover:text-white"
                  >
                    For Shippers
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register?role=carrier"
                    className="transition-colors hover:text-white"
                  >
                    For Carriers
                  </Link>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-white">
                    Enterprise
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-white">
                    API Access
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-white">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Addis Ababa, Ethiopia</li>
                <li>support@freightet.com</li>
                <li>+251 11 XXX XXXX</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 md:flex-row">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} FreightET. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#" className="transition-colors hover:text-white">
                Privacy Policy
              </a>
              <a href="#" className="transition-colors hover:text-white">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
