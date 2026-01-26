'use client';

/**
 * Realistic 3D Icons Component
 *
 * Provides realistic icons for trucks and cargo loads
 * using locally stored PNG images from Icons8
 */

import Image from 'next/image';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Realistic 3D Truck Icon
 */
export function TruckIcon({ size = 48, className = '' }: IconProps) {
  return (
    <Image
      src="/truck-icon.png"
      alt="Truck"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

/**
 * Realistic 3D Cargo/Package Icon
 */
export function CargoIcon({ size = 48, className = '' }: IconProps) {
  return (
    <Image
      src="/cargo-icon.png"
      alt="Cargo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

/**
 * Icon with gradient background wrapper
 */
export function IconWithBackground({
  icon: Icon,
  size = 48,
  bgSize = 64,
  className = ''
}: {
  icon: typeof TruckIcon | typeof CargoIcon;
  size?: number;
  bgSize?: number;
  className?: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/25 ${className}`}
      style={{ width: bgSize, height: bgSize, padding: bgSize * 0.15 }}
    >
      <Icon size={size} />
    </div>
  );
}
