'use client';

import { useState } from 'react';

interface City {
  name: string;
  x: number;
  y: number;
  isMainRoute?: boolean;
  info?: string;
}

const cities: City[] = [
  { name: 'Addis Ababa', x: 180, y: 230, isMainRoute: true, info: 'Capital - Major Hub' },
  { name: 'Dire Dawa', x: 280, y: 200, isMainRoute: true, info: 'Industrial Center' },
  { name: 'Djibouti', x: 360, y: 165, isMainRoute: true, info: 'Main Port Access' },
  { name: 'Mekelle', x: 195, y: 100, info: 'Northern Hub' },
  { name: 'Bahir Dar', x: 130, y: 140, info: 'Lake Tana Region' },
  { name: 'Gondar', x: 130, y: 100, info: 'Historic City' },
  { name: 'Hawassa', x: 165, y: 300, info: 'Southern Industrial Zone' },
  { name: 'Jimma', x: 100, y: 260, info: 'Coffee Region' },
  { name: 'Harar', x: 300, y: 220, isMainRoute: true, info: 'Eastern Gateway' },
];

// Main route path from Addis to Djibouti (simplified waypoints)
const mainRoutePath = 'M180,230 Q230,215 280,200 L300,220 Q330,190 360,165';

export default function EthiopiaMap() {
  const [hoveredCity, setHoveredCity] = useState<City | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleCityHover = (city: City, e: React.MouseEvent) => {
    setHoveredCity(city);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
  };

  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* Map Container with glow effect */}
      <div className="relative">
        <svg
          viewBox="0 0 450 400"
          className="w-full h-auto drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 0 20px rgba(15, 118, 110, 0.3))' }}
        >
          {/* Background gradient */}
          <defs>
            <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f766e" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Animated dash pattern */}
            <pattern id="movingDash" width="20" height="1" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="10" y2="0" stroke="#fbbf24" strokeWidth="3">
                <animate
                  attributeName="x1"
                  from="0"
                  to="20"
                  dur="1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="x2"
                  from="10"
                  to="30"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </line>
            </pattern>
          </defs>

          {/* Ethiopia outline (simplified) */}
          <path
            d="M50,180 L80,120 L100,80 L150,60 L200,50 L250,60 L300,80
               L350,100 L380,140 L400,180 L390,220 L360,165
               L340,200 L300,250 L250,300 L200,340 L150,350
               L100,320 L70,280 L50,240 Z"
            fill="url(#mapGradient)"
            stroke="#0f766e"
            strokeWidth="2"
            className="transition-all duration-300"
          />

          {/* Country fill with subtle pattern */}
          <path
            d="M50,180 L80,120 L100,80 L150,60 L200,50 L250,60 L300,80
               L350,100 L380,140 L400,180 L390,220 L360,165
               L340,200 L300,250 L250,300 L200,340 L150,350
               L100,320 L70,280 L50,240 Z"
            fill="#0f766e"
            fillOpacity="0.15"
          />

          {/* Secondary routes (faded) */}
          <g stroke="#0f766e" strokeWidth="1.5" strokeOpacity="0.3" fill="none">
            <path d="M180,230 L165,300" strokeDasharray="4,4" />
            <path d="M180,230 L130,140" strokeDasharray="4,4" />
            <path d="M180,230 L195,100" strokeDasharray="4,4" />
            <path d="M130,140 L130,100" strokeDasharray="4,4" />
            <path d="M180,230 L100,260" strokeDasharray="4,4" />
          </g>

          {/* Main route glow */}
          <path
            d={mainRoutePath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="8"
            strokeOpacity="0.3"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Main route - animated dashed line */}
          <path
            d={mainRoutePath}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="12,6"
            className="animate-route-dash"
          />

          {/* Moving truck on main route */}
          <g className="animate-truck-move">
            <circle cx="0" cy="0" r="12" fill="#f59e0b" fillOpacity="0.3" />
            <circle cx="0" cy="0" r="8" fill="#f59e0b" />
            <text x="0" y="4" textAnchor="middle" fontSize="10" fill="white">
              🚚
            </text>
            {/* Animate along path */}
            <animateMotion
              dur="6s"
              repeatCount="indefinite"
              path={mainRoutePath}
            />
          </g>

          {/* City markers */}
          {cities.map((city) => (
            <g
              key={city.name}
              onMouseEnter={(e) => handleCityHover(city, e)}
              onMouseLeave={() => setHoveredCity(null)}
              className="cursor-pointer"
            >
              {/* Pulse effect for main route cities */}
              {city.isMainRoute && (
                <>
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r="15"
                    fill="#f59e0b"
                    fillOpacity="0.2"
                    className="animate-ping"
                  />
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r="10"
                    fill="#f59e0b"
                    fillOpacity="0.3"
                  />
                </>
              )}

              {/* City dot */}
              <circle
                cx={city.x}
                cy={city.y}
                r={city.isMainRoute ? 6 : 4}
                fill={city.isMainRoute ? '#f59e0b' : '#0f766e'}
                stroke="white"
                strokeWidth="2"
                className="transition-all duration-200 hover:scale-150"
              />

              {/* City label */}
              <text
                x={city.x}
                y={city.y - 12}
                textAnchor="middle"
                fontSize={city.isMainRoute ? '11' : '9'}
                fontWeight={city.isMainRoute ? 'bold' : 'normal'}
                fill={city.isMainRoute ? '#f59e0b' : '#0f766e'}
                className="pointer-events-none"
              >
                {city.name}
              </text>
            </g>
          ))}

          {/* Route label */}
          <g transform="translate(270, 155)">
            <rect
              x="-45"
              y="-12"
              width="90"
              height="24"
              rx="12"
              fill="#f59e0b"
              fillOpacity="0.9"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="white"
            >
              Main Corridor
            </text>
          </g>

          {/* Distance indicator */}
          <g transform="translate(320, 240)">
            <rect
              x="-35"
              y="-10"
              width="70"
              height="20"
              rx="4"
              fill="#0f172a"
              fillOpacity="0.8"
            />
            <text
              x="0"
              y="4"
              textAnchor="middle"
              fontSize="9"
              fill="white"
            >
              ~750 km
            </text>
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredCity && (
          <div
            className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg text-sm shadow-xl pointer-events-none z-10 transform -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(hoveredCity.x / 450) * 100}%`,
              top: `${(hoveredCity.y / 400) * 100 - 5}%`,
            }}
          >
            <div className="font-semibold">{hoveredCity.name}</div>
            {hoveredCity.info && (
              <div className="text-xs text-gray-300">{hoveredCity.info}</div>
            )}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
              style={{
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #0f172a',
              }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-slate-600 dark:text-slate-300">Main Corridor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-teal-600"></div>
          <span className="text-slate-600 dark:text-slate-300">Secondary Routes</span>
        </div>
      </div>
    </div>
  );
}
