'use client';

import { useState, useEffect } from 'react';

interface Screenshot {
  id: number;
  title: string;
  subtitle: string;
  gradient: string;
  icon: string;
  features: string[];
}

const screenshots: Screenshot[] = [
  {
    id: 1,
    title: 'Live GPS Tracking',
    subtitle: 'Real-time location',
    gradient: 'from-teal-600 to-cyan-500',
    icon: '📍',
    features: ['Live Map View', 'ETA Updates', 'Route History'],
  },
  {
    id: 2,
    title: 'Load Board',
    subtitle: 'Find & book loads',
    gradient: 'from-amber-500 to-orange-500',
    icon: '📦',
    features: ['Search Loads', 'Filter Routes', 'Quick Booking'],
  },
  {
    id: 3,
    title: 'Dashboard',
    subtitle: 'Complete overview',
    gradient: 'from-purple-600 to-indigo-500',
    icon: '📊',
    features: ['Active Shipments', 'Revenue Stats', 'Performance'],
  },
  {
    id: 4,
    title: 'Notifications',
    subtitle: 'Stay updated',
    gradient: 'from-emerald-500 to-teal-500',
    icon: '🔔',
    features: ['Load Matches', 'Status Updates', 'Messages'],
  },
];

const floatingNotifications = [
  { text: 'New load matched!', icon: '✅', delay: '0s', position: 'top-16 -right-4' },
  { text: 'GPS Active', icon: '📍', delay: '2s', position: 'top-32 -left-8' },
  { text: 'ETB 45,000 earned', icon: '💰', delay: '4s', position: 'bottom-32 -right-6' },
];

export default function PhoneMockup() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % screenshots.length);
        setIsTransitioning(false);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const currentScreen = screenshots[currentIndex];

  return (
    <div className="relative">
      {/* Floating notifications */}
      {floatingNotifications.map((notif, idx) => (
        <div
          key={idx}
          className={`absolute ${notif.position} animate-float z-10`}
          style={{ animationDelay: notif.delay }}
        >
          <div className="bg-white dark:bg-slate-800 shadow-xl rounded-full px-4 py-2 flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700">
            <span>{notif.icon}</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
              {notif.text}
            </span>
          </div>
        </div>
      ))}

      {/* Phone Frame */}
      <div className="relative mx-auto w-[280px]">
        {/* Phone outer shell */}
        <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
          {/* Reflection effect */}
          <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

          {/* Side buttons */}
          <div className="absolute -left-1 top-24 w-1 h-8 bg-slate-700 rounded-l" />
          <div className="absolute -left-1 top-36 w-1 h-12 bg-slate-700 rounded-l" />
          <div className="absolute -left-1 top-52 w-1 h-12 bg-slate-700 rounded-l" />
          <div className="absolute -right-1 top-32 w-1 h-16 bg-slate-700 rounded-r" />

          {/* Screen */}
          <div className="relative bg-slate-950 rounded-[2.5rem] overflow-hidden">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-900 rounded-b-2xl z-20">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-700" />
                <div className="w-12 h-3 rounded-full bg-slate-800" />
              </div>
            </div>

            {/* Screen content */}
            <div
              className={`transition-all duration-300 ${
                isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}
            >
              {/* Status bar */}
              <div className="h-12 bg-slate-900 flex items-end justify-between px-6 pb-1 text-white text-xs">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <span>📶</span>
                  <span>🔋</span>
                </div>
              </div>

              {/* App header */}
              <div className={`bg-gradient-to-r ${currentScreen.gradient} px-4 py-6`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                    {currentScreen.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{currentScreen.title}</h3>
                    <p className="text-white/80 text-sm">{currentScreen.subtitle}</p>
                  </div>
                </div>
              </div>

              {/* App content */}
              <div className="bg-slate-100 dark:bg-slate-900 px-4 py-4 h-[380px]">
                {/* Feature cards */}
                <div className="space-y-3">
                  {currentScreen.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3"
                      style={{
                        animationDelay: `${idx * 100}ms`,
                      }}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-r ${currentScreen.gradient} flex items-center justify-center text-white font-bold`}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {feature}
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded mt-2 overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${currentScreen.gradient} rounded`}
                            style={{ width: `${70 + idx * 10}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom stats */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-teal-600">24/7</div>
                    <div className="text-xs text-slate-500">Tracking</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-amber-500">100+</div>
                    <div className="text-xs text-slate-500">Routes</div>
                  </div>
                </div>
              </div>

              {/* Bottom nav */}
              <div className="bg-white dark:bg-slate-800 px-6 py-3 flex justify-around border-t border-slate-200 dark:border-slate-700">
                {['🏠', '📦', '📍', '👤'].map((icon, idx) => (
                  <div
                    key={idx}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      idx === currentIndex % 4
                        ? 'bg-teal-100 dark:bg-teal-900/50'
                        : ''
                    }`}
                  >
                    <span className="text-xl">{icon}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Home indicator */}
            <div className="h-8 bg-slate-900 flex items-center justify-center">
              <div className="w-32 h-1 bg-white/30 rounded-full" />
            </div>
          </div>
        </div>

        {/* Glow effect under phone */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-8 bg-teal-500/30 rounded-full blur-xl" />
      </div>

      {/* Screen indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {screenshots.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'w-6 bg-teal-600'
                : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
