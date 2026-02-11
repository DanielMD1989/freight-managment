'use client';

/**
 * Load Creation Form Component
 *
 * Multi-step form for creating load postings
 * Sprint 11 - Story 11.2: Load Creation Form
 * Enhanced UI - Dashboard Style
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { getCSRFToken } from '@/lib/csrfFetch';

const TRUCK_TYPES = [
  { value: 'FLATBED', label: 'Flatbed', icon: '🚛' },
  { value: 'REFRIGERATED', label: 'Refrigerated', icon: '❄️' },
  { value: 'TANKER', label: 'Tanker', icon: '🛢️' },
  { value: 'CONTAINER', label: 'Container', icon: '📦' },
  { value: 'DRY_VAN', label: 'Dry Van', icon: '🚚' },
  { value: 'LOWBOY', label: 'Lowboy', icon: '🔧' },
  { value: 'DUMP_TRUCK', label: 'Dump Truck', icon: '🏗️' },
  { value: 'BOX_TRUCK', label: 'Box Truck', icon: '📤' },
];

// Ethiopian cities with coordinates for distance calculation
const ETHIOPIAN_CITIES_DATA: Record<string, { lat: number; lon: number }> = {
  'Addis Ababa': { lat: 9.0054, lon: 38.7636 },
  'Dire Dawa': { lat: 9.6009, lon: 41.8501 },
  'Mekelle': { lat: 13.4967, lon: 39.4767 },
  'Gondar': { lat: 12.6000, lon: 37.4667 },
  'Bahir Dar': { lat: 11.5742, lon: 37.3614 },
  'Hawassa': { lat: 7.0500, lon: 38.4833 },
  'Awasa': { lat: 7.0500, lon: 38.4833 },
  'Jimma': { lat: 7.6667, lon: 36.8333 },
  'Jijiga': { lat: 9.3500, lon: 42.8000 },
  'Shashamane': { lat: 7.2000, lon: 38.6000 },
  'Bishoftu': { lat: 8.7500, lon: 38.9833 },
  'Arba Minch': { lat: 6.0333, lon: 37.5500 },
  'Hosaena': { lat: 7.5500, lon: 37.8500 },
  'Harar': { lat: 9.3100, lon: 42.1200 },
  'Dilla': { lat: 6.4167, lon: 38.3000 },
  'Nekemte': { lat: 9.0833, lon: 36.5333 },
  'Debre Birhan': { lat: 9.6833, lon: 39.5333 },
  'Asella': { lat: 7.9500, lon: 39.1333 },
  'Debre Markos': { lat: 10.3333, lon: 37.7333 },
  'Kombolcha': { lat: 11.0833, lon: 39.7333 },
  'Debre Tabor': { lat: 11.8500, lon: 38.0167 },
  'Adigrat': { lat: 14.2833, lon: 39.4667 },
  'Woldiya': { lat: 11.8333, lon: 39.6000 },
  'Sodo': { lat: 6.8500, lon: 37.7500 },
  'Gambela': { lat: 8.2500, lon: 34.5833 },
};

const ETHIOPIAN_CITIES = Object.keys(ETHIOPIAN_CITIES_DATA);

const STEPS = [
  { num: 1, label: 'Route', icon: '📍' },
  { num: 2, label: 'Cargo', icon: '📦' },
  { num: 3, label: 'Options', icon: '⚙️' },
  { num: 4, label: 'Review', icon: '✓' },
];

// Distance calculation removed - backend is single source of truth
// Distance is fetched from /api/distance/road endpoint only

export default function LoadCreationForm() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    pickupCity: '',
    pickupAddress: '',
    pickupDate: '',
    deliveryCity: '',
    deliveryAddress: '',
    deliveryDate: '',
    appointmentRequired: false,
    truckType: 'FLATBED',
    weight: '',
    cargoDescription: '',
    fullPartial: 'FULL',
    isFragile: false,
    requiresRefrigeration: false,
    bookMode: 'REQUEST',
    isAnonymous: false,
    shipperContactName: '',
    shipperContactPhone: '',
    specialInstructions: '',
    status: 'DRAFT',
  });

  // Service fee preview (fetched from corridor pricing)
  const [serviceFee, setServiceFee] = useState<{
    corridorName: string;
    distanceKm: number;
    pricePerKm: number;
    totalFee: number;
    loading: boolean;
    error: string | null;
  } | null>(null);

  // L44 FIX: Properly typed field value
  const updateField = (field: string, value: string | number | boolean | { lat: number; lng: number } | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!formData.pickupCity || !formData.deliveryCity) {
        setError('Pickup and delivery cities are required');
        return false;
      }
      if (!formData.pickupDate || !formData.deliveryDate) {
        setError('Pickup and delivery dates are required');
        return false;
      }
      if (new Date(formData.deliveryDate) <= new Date(formData.pickupDate)) {
        setError('Delivery date must be after pickup date');
        return false;
      }
    } else if (step === 2) {
      if (!formData.truckType) {
        setError('Truck type is required');
        return false;
      }
      if (!formData.weight || parseFloat(formData.weight) <= 0) {
        setError('Valid weight is required');
        return false;
      }
      if (!formData.cargoDescription || formData.cargoDescription.length < 5) {
        setError('Cargo description must be at least 5 characters');
        return false;
      }
    } else if (step === 3) {
      // No rate validation needed - price negotiation happens outside platform
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!isDraft && !validateStep()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setError('Failed to get CSRF token. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Fetch distance from backend API - backend is single source of truth
      let tripKm: number | undefined;
      const pickupCoords = ETHIOPIAN_CITIES_DATA[formData.pickupCity];
      const deliveryCoords = ETHIOPIAN_CITIES_DATA[formData.deliveryCity];
      if (pickupCoords && deliveryCoords) {
        try {
          const distanceRes = await fetch(
            `/api/distance/road?origin=${pickupCoords.lat},${pickupCoords.lon}&destination=${deliveryCoords.lat},${deliveryCoords.lon}`
          );
          if (distanceRes.ok) {
            const distanceData = await distanceRes.json();
            tripKm = distanceData.distanceKm;
          }
          // If API fails, tripKm remains undefined - backend can calculate if needed
        } catch {
          // API error - proceed without tripKm, backend will handle
          console.warn('Distance API unavailable, proceeding without tripKm');
        }
      }

      const submitData = {
        ...formData,
        weight: parseFloat(formData.weight),
        // No rate field - price negotiation happens outside platform
        status: isDraft ? 'DRAFT' : 'POSTED',
        tripKm,
      };

      const response = await fetch('/api/loads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify(submitData),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(isDraft ? 'Load saved as draft' : 'Load posted successfully!');
        router.push(`/shipper/loads/${result.load.id}`);
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to create load';
        setError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error creating load:', error);
      const errorMessage = 'Failed to create load. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Reusable input style
  const inputStyle = {
    background: 'var(--card)',
    borderColor: 'var(--border)',
    color: 'var(--foreground)',
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Progress Header */}
      <div
        className="px-4 py-3"
        style={{ background: 'var(--bg-tinted)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between max-w-md mx-auto">
          {STEPS.map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <button
                onClick={() => step > s.num && setStep(s.num)}
                disabled={step < s.num}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step > s.num ? 'cursor-pointer hover:scale-105' : step === s.num ? '' : 'cursor-not-allowed'
                }`}
                style={{
                  background: step >= s.num ? 'var(--primary-500)' : 'var(--card)',
                  color: step >= s.num ? 'white' : 'var(--foreground-muted)',
                  border: step >= s.num ? 'none' : '1px solid var(--border)',
                }}
              >
                {step > s.num ? '✓' : s.num}
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className="w-12 h-0.5 mx-1"
                  style={{ background: step > s.num ? 'var(--primary-500)' : 'var(--border)' }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between max-w-md mx-auto mt-1">
          {STEPS.map((s) => (
            <span
              key={s.num}
              className="text-[10px] font-medium w-9 text-center"
              style={{ color: step >= s.num ? 'var(--primary-500)' : 'var(--foreground-muted)' }}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg p-3 text-sm flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Step 1: Route */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Route Visual */}
            <div
              className="rounded-lg p-4 flex items-center gap-4"
              style={{ background: 'var(--bg-tinted)' }}
            >
              <div className="flex-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  From
                </label>
                <select
                  value={formData.pickupCity}
                  onChange={(e) => updateField('pickupCity', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={inputStyle}
                >
                  <option value="">Select origin...</option>
                  {ETHIOPIAN_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col items-center pt-4">
                <svg className="w-6 h-6" style={{ color: 'var(--primary-500)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  To
                </label>
                <select
                  value={formData.deliveryCity}
                  onChange={(e) => updateField('deliveryCity', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={inputStyle}
                >
                  <option value="">Select destination...</option>
                  {ETHIOPIAN_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  Pickup Date
                </label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => updateField('pickupDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => updateField('deliveryDate', e.target.value)}
                  min={formData.pickupDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  Pickup Address <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.pickupAddress}
                  onChange={(e) => updateField('pickupAddress', e.target.value)}
                  placeholder="Specific location..."
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  Delivery Address <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress}
                  onChange={(e) => updateField('deliveryAddress', e.target.value)}
                  placeholder="Specific location..."
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Appointment */}
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <input
                type="checkbox"
                checked={formData.appointmentRequired}
                onChange={(e) => updateField('appointmentRequired', e.target.checked)}
                className="w-4 h-4 rounded accent-teal-600"
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                Appointment required
              </span>
            </label>
          </div>
        )}

        {/* Step 2: Cargo */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Truck Type Grid */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--foreground-muted)' }}>
                Truck Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TRUCK_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateField('truckType', type.value)}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      formData.truckType === type.value ? 'ring-2 ring-teal-500' : 'hover:border-teal-300'
                    }`}
                    style={{
                      background: formData.truckType === type.value ? 'var(--bg-tinted)' : 'var(--card)',
                      borderColor: formData.truckType === type.value ? 'var(--primary-500)' : 'var(--border)',
                    }}
                  >
                    <div className="text-lg">{type.icon}</div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--foreground)' }}>
                      {type.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Weight & Load Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => updateField('weight', e.target.value)}
                  min="0"
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  Load Type
                </label>
                <div className="flex gap-2">
                  {[{ value: 'FULL', label: 'Full' }, { value: 'PARTIAL', label: 'Partial' }].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateField('fullPartial', opt.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        formData.fullPartial === opt.value ? 'ring-2 ring-teal-500' : ''
                      }`}
                      style={{
                        background: formData.fullPartial === opt.value ? 'var(--primary-500)' : 'var(--card)',
                        color: formData.fullPartial === opt.value ? 'white' : 'var(--foreground)',
                        borderColor: formData.fullPartial === opt.value ? 'var(--primary-500)' : 'var(--border)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cargo Description */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                Cargo Description
              </label>
              <textarea
                value={formData.cargoDescription}
                onChange={(e) => updateField('cargoDescription', e.target.value)}
                rows={2}
                placeholder="Describe your cargo..."
                className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                style={inputStyle}
              />
            </div>

            {/* Special Requirements */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isFragile}
                  onChange={(e) => updateField('isFragile', e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-600"
                />
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>Fragile</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.requiresRefrigeration}
                  onChange={(e) => updateField('requiresRefrigeration', e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-600"
                />
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>Refrigerated</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Options */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Service Fee Preview */}
            {formData.pickupCity && formData.deliveryCity && (
              <div
                className="rounded-lg p-4"
                style={{ background: 'var(--bg-tinted)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5" style={{ color: 'var(--primary-500)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Platform Service Fee</span>
                </div>
                <div className="text-xs mb-2" style={{ color: 'var(--foreground-muted)' }}>
                  Fee is calculated based on route distance and corridor pricing set by the platform.
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                      {formData.pickupCity} → {formData.deliveryCity}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      Fee will be shown after posting
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] p-2 rounded" style={{ background: 'var(--card)', color: 'var(--foreground-muted)' }}>
                  <strong>Note:</strong> You negotiate the freight rate directly with carriers (outside the platform).
                  The platform only charges a service fee based on: Distance × Corridor Rate (ETB/km).
                </div>
              </div>
            )}

            {/* Booking Mode */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--foreground-muted)' }}>
                Booking Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'REQUEST', label: 'Request', desc: 'Review bids first' },
                  { value: 'INSTANT', label: 'Instant', desc: 'First come, first served' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('bookMode', opt.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      formData.bookMode === opt.value ? 'ring-2 ring-teal-500' : ''
                    }`}
                    style={{
                      background: formData.bookMode === opt.value ? 'var(--bg-tinted)' : 'var(--card)',
                      borderColor: formData.bookMode === opt.value ? 'var(--primary-500)' : 'var(--border)',
                    }}
                  >
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{opt.label}</div>
                    <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <input
                type="checkbox"
                checked={formData.isAnonymous}
                onChange={(e) => updateField('isAnonymous', e.target.checked)}
                className="w-4 h-4 rounded accent-teal-600"
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>Post anonymously</span>
            </label>

            {/* Contact */}
            {!formData.isAnonymous && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.shipperContactName}
                    onChange={(e) => updateField('shipperContactName', e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.shipperContactPhone}
                    onChange={(e) => updateField('shipperContactPhone', e.target.value)}
                    placeholder="+251..."
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500"
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {/* Instructions */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--foreground-muted)' }}>
                Special Instructions <span className="font-normal">(optional)</span>
              </label>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => updateField('specialInstructions', e.target.value)}
                rows={2}
                placeholder="Any special notes..."
                className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-3">
            {/* Summary Card */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border)' }}
            >
              {/* Route Header */}
              <div
                className="p-3 flex items-center justify-between"
                style={{ background: 'var(--primary-500)' }}
              >
                <div className="text-white">
                  <div className="text-lg font-bold">{formData.pickupCity}</div>
                  <div className="text-xs opacity-80">{formData.pickupDate}</div>
                </div>
                <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="text-white text-right">
                  <div className="text-lg font-bold">{formData.deliveryCity}</div>
                  <div className="text-xs opacity-80">{formData.deliveryDate}</div>
                </div>
              </div>

              {/* Details */}
              <div className="p-3 grid grid-cols-3 gap-3" style={{ background: 'var(--bg-tinted)' }}>
                <div>
                  <div className="text-[10px] font-medium uppercase" style={{ color: 'var(--foreground-muted)' }}>Truck</div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {TRUCK_TYPES.find((t) => t.value === formData.truckType)?.icon} {TRUCK_TYPES.find((t) => t.value === formData.truckType)?.label}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase" style={{ color: 'var(--foreground-muted)' }}>Weight</div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {formData.weight ? `${parseFloat(formData.weight).toLocaleString()} kg` : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase" style={{ color: 'var(--foreground-muted)' }}>Type</div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {formData.fullPartial === 'FULL' ? 'Full Load' : 'Partial'}
                  </div>
                </div>
              </div>

              {/* Service Fee Notice */}
              <div className="p-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <div>
                  <div className="text-[10px] font-medium uppercase" style={{ color: 'var(--foreground-muted)' }}>Platform Fee</div>
                  <div className="text-sm" style={{ color: 'var(--foreground)' }}>
                    Based on corridor rate
                  </div>
                </div>
                <div
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ background: 'var(--bg-tinted)', color: 'var(--foreground-muted)' }}
                >
                  {formData.bookMode === 'INSTANT' ? 'Instant Book' : 'Request Mode'}
                </div>
              </div>
            </div>

            {/* Price Negotiation Note */}
            <div
              className="rounded-lg p-3 flex items-start gap-2"
              style={{ background: 'var(--bg-tinted)', border: '1px solid var(--border)' }}
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--primary-500)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                <strong>Price Negotiation:</strong> You will negotiate the freight rate directly with carriers after they show interest in your load. The platform only charges a service fee based on distance.
              </div>
            </div>

            {/* Cargo Description */}
            {formData.cargoDescription && (
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                <span className="font-medium">Cargo:</span> {formData.cargoDescription}
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {formData.isFragile && (
                <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Fragile
                </span>
              )}
              {formData.requiresRefrigeration && (
                <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Refrigerated
                </span>
              )}
              {formData.isAnonymous && (
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  Anonymous
                </span>
              )}
              {formData.appointmentRequired && (
                <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  Appointment Required
                </span>
              )}
            </div>

            {/* Terms */}
            <p className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
              By posting, you agree to the platform's terms and authorize carriers to respond.
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div
        className="px-4 py-3 flex justify-between"
        style={{ background: 'var(--bg-tinted)', borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={prevStep}
          disabled={step === 1 || isSubmitting}
          className="px-4 py-2 text-sm font-medium rounded-lg border transition-all disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
        >
          Back
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium rounded-lg border transition-all disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
          >
            {isSubmitting ? 'Saving...' : 'Save Draft'}
          </button>
          {step < 4 ? (
            <button
              onClick={nextStep}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'var(--primary-500)', color: 'white' }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'var(--primary-500)', color: 'white' }}
            >
              {isSubmitting ? 'Posting...' : 'Post Load'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
