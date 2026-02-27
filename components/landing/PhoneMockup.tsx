// Professional FreightET Mobile App Mockup - Ethiopian Freight Platform
// Inspired by DAT One's clean, dark UI design

export default function PhoneMockup() {
  return (
    <div className="relative">
      {/* Floating notifications */}
      <div className="absolute top-8 -right-4 z-20">
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500 px-4 py-3 text-sm text-white shadow-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <div className="font-semibold">Load Booked!</div>
            <div className="text-xs text-emerald-100">Addis → Djibouti</div>
          </div>
        </div>
      </div>

      <div className="absolute top-32 -left-6 z-20">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white shadow-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20">
            <svg
              className="h-5 w-5 text-teal-400"
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
            </svg>
          </div>
          <div>
            <div className="font-semibold">GPS Active</div>
            <div className="text-xs text-slate-400">Dire Dawa</div>
          </div>
        </div>
      </div>

      <div className="absolute -right-8 bottom-36 z-20">
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500 px-4 py-3 text-sm text-white shadow-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <span className="text-lg">💰</span>
          </div>
          <div>
            <div className="font-semibold">ETB 125,000</div>
            <div className="text-xs text-amber-100">This week</div>
          </div>
        </div>
      </div>

      {/* Phone Frame */}
      <div className="relative mx-auto w-[300px]">
        {/* Phone outer shell - iPhone style */}
        <div className="relative rounded-[3rem] bg-slate-900 p-3 shadow-2xl ring-1 ring-slate-700">
          {/* Reflection effect */}
          <div className="pointer-events-none absolute inset-0 rounded-[3rem] bg-gradient-to-br from-white/10 via-transparent to-transparent" />

          {/* Side buttons */}
          <div className="absolute top-28 -left-1 h-8 w-1 rounded-l bg-slate-700" />
          <div className="absolute top-40 -left-1 h-14 w-1 rounded-l bg-slate-700" />
          <div className="absolute top-56 -left-1 h-14 w-1 rounded-l bg-slate-700" />
          <div className="absolute top-36 -right-1 h-20 w-1 rounded-r bg-slate-700" />

          {/* Screen */}
          <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950">
            {/* Dynamic Island */}
            <div className="absolute top-2 left-1/2 z-20 flex h-8 w-28 -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-black">
              <div className="h-3 w-3 rounded-full bg-slate-800" />
              <div className="h-2 w-2 rounded-full bg-slate-700" />
            </div>

            {/* Screen content - Load Board Screen (DAT-inspired) */}
            <div className="bg-slate-900">
              {/* Status bar */}
              <div className="flex h-14 items-end justify-between px-8 pb-1 text-xs font-medium text-white">
                <span>9:41</span>
                <div className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 3C7.46 3 3.34 4.78.29 7.67c-.18.18-.29.43-.29.71 0 .28.11.53.29.71l2.48 2.48c.18.18.43.29.71.29.27 0 .52-.11.7-.28.79-.74 1.69-1.36 2.66-1.85.33-.16.56-.5.56-.9v-3.1c1.45-.48 3-.73 4.6-.73s3.15.25 4.6.72v3.1c0 .39.23.74.56.9.98.49 1.87 1.12 2.67 1.85.18.18.43.28.7.28.28 0 .53-.11.71-.29l2.48-2.48c.18-.18.29-.43.29-.71 0-.28-.11-.53-.29-.71C20.66 4.78 16.54 3 12 3z" />
                  </svg>
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
                  </svg>
                </div>
              </div>

              {/* App Header */}
              <div className="px-5 pt-2 pb-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">FreightET</h2>
                    <p className="text-xs text-slate-400">
                      Find your next load
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500">
                    <span className="text-sm font-bold text-white">AT</span>
                  </div>
                </div>

                {/* Search bar */}
                <div className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3">
                  <svg
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span className="text-sm text-slate-400">
                    Search routes...
                  </span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="px-5 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                    <div className="text-lg font-bold text-teal-400">156</div>
                    <div className="text-[10px] text-slate-500">Available</div>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                    <div className="text-lg font-bold text-amber-400">12</div>
                    <div className="text-[10px] text-slate-500">Matched</div>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                    <div className="text-lg font-bold text-emerald-400">3</div>
                    <div className="text-[10px] text-slate-500">Active</div>
                  </div>
                </div>
              </div>

              {/* Load Cards */}
              <div className="space-y-3 px-5 pb-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>AVAILABLE LOADS</span>
                  <span className="text-teal-400">See all →</span>
                </div>

                {/* Load Card 1 - Featured */}
                <div className="rounded-xl border border-teal-700/30 bg-gradient-to-r from-teal-900/50 to-slate-800 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20">
                        <svg
                          className="h-4 w-4 text-teal-400"
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
                            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Addis Ababa → Djibouti
                        </div>
                        <div className="text-xs text-slate-400">
                          Dry Van • 24 tons
                        </div>
                      </div>
                    </div>
                    <div className="rounded bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-400">
                      HOT
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-emerald-400">
                        ETB 85,000
                      </div>
                      <div className="text-xs text-slate-500">
                        ETB 113/km • 750km
                      </div>
                    </div>
                    <button className="rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-white">
                      Book Now
                    </button>
                  </div>
                </div>

                {/* Load Card 2 */}
                <div className="rounded-xl bg-slate-800 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700">
                        <svg
                          className="h-4 w-4 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Dire Dawa → Mekelle
                        </div>
                        <div className="text-xs text-slate-400">
                          Flatbed • 18 tons
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">ETB 52,000</div>
                      <div className="text-xs text-slate-500">
                        ETB 98/km • 530km
                      </div>
                    </div>
                    <button className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white">
                      View
                    </button>
                  </div>
                </div>

                {/* Load Card 3 */}
                <div className="rounded-xl bg-slate-800 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700">
                        <svg
                          className="h-4 w-4 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Hawassa → Addis
                        </div>
                        <div className="text-xs text-slate-400">
                          Reefer • 15 tons
                        </div>
                      </div>
                    </div>
                    <div className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-400">
                      NEW
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">ETB 28,000</div>
                      <div className="text-xs text-slate-500">
                        ETB 105/km • 267km
                      </div>
                    </div>
                    <button className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white">
                      View
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="border-t border-slate-800 bg-slate-900 px-6 py-3">
                <div className="flex items-center justify-around">
                  <div className="flex flex-col items-center gap-1">
                    <svg
                      className="h-6 w-6 text-slate-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    <span className="text-[10px] text-slate-500">Home</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <svg
                        className="h-6 w-6 text-teal-400"
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
                      <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500">
                        <span className="text-[8px] font-bold text-white">
                          12
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-teal-400">
                      Loads
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg
                      className="h-6 w-6 text-slate-500"
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
                    <span className="text-[10px] text-slate-500">Track</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg
                      className="h-6 w-6 text-slate-500"
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
                    <span className="text-[10px] text-slate-500">Wallet</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg
                      className="h-6 w-6 text-slate-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="text-[10px] text-slate-500">Profile</span>
                  </div>
                </div>
              </div>

              {/* Home indicator */}
              <div className="flex h-6 items-center justify-center bg-slate-900">
                <div className="h-1 w-32 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* App name badge */}
      <div className="mt-6 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500">
            <svg
              className="h-4 w-4 text-white"
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
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10"
              />
            </svg>
          </div>
          FreightET Mobile
        </div>
      </div>
    </div>
  );
}
