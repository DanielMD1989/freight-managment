'use client';

/**
 * Load Creation Form Component
 *
 * Multi-step form for creating load postings
 * Sprint 11 - Story 11.2: Load Creation Form
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { getCSRFToken } from '@/lib/csrfFetch';

const TRUCK_TYPES = [
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'REFRIGERATED', label: 'Refrigerated' },
  { value: 'TANKER', label: 'Tanker' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'DRY_VAN', label: 'Dry Van' },
  { value: 'LOWBOY', label: 'Lowboy' },
  { value: 'DUMP_TRUCK', label: 'Dump Truck' },
  { value: 'BOX_TRUCK', label: 'Box Truck' },
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

/**
 * Calculate Haversine distance between two coordinates
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal
}

export default function LoadCreationForm() {
  const router = useRouter();
  const toast = useToast();

  // Form state
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    // Location & Schedule
    pickupCity: '',
    pickupAddress: '',
    pickupDate: '',
    deliveryCity: '',
    deliveryAddress: '',
    deliveryDate: '',
    appointmentRequired: false,

    // Load Details
    truckType: 'FLATBED',
    weight: '',
    cargoDescription: '',
    fullPartial: 'FULL',
    isFragile: false,
    requiresRefrigeration: false,

    // Pricing
    rate: '',
    bookMode: 'REQUEST',

    // Privacy & Contact
    isAnonymous: false,
    shipperContactName: '',
    shipperContactPhone: '',
    specialInstructions: '',

    // Status
    status: 'DRAFT',
  });

  /**
   * Update form field
   */
  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  /**
   * Validate current step
   */
  const validateStep = (): boolean => {
    if (step === 1) {
      // Location & Schedule validation
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
      // Load Details validation
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
      // Pricing validation
      if (!formData.rate || parseFloat(formData.rate) <= 0) {
        setError('Valid rate is required');
        return false;
      }
    }

    return true;
  };

  /**
   * Next step
   */
  const nextStep = () => {
    if (validateStep()) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  /**
   * Previous step
   */
  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    setError('');
  };

  /**
   * Submit form
   */
  const handleSubmit = async (isDraft: boolean) => {
    if (!isDraft && !validateStep()) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setError('Failed to get CSRF token. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Calculate trip distance using API (Google Maps if available, Haversine fallback)
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
        } catch {
          // Fallback to local Haversine calculation if API fails
          tripKm = calculateHaversineDistance(
            pickupCoords.lat,
            pickupCoords.lon,
            deliveryCoords.lat,
            deliveryCoords.lon
          );
        }
      }

      // Prepare submission data
      const submitData = {
        ...formData,
        weight: parseFloat(formData.weight),
        rate: parseFloat(formData.rate),
        status: isDraft ? 'DRAFT' : 'POSTED',
        tripKm,
      };

      const response = await fetch('/api/loads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(submitData),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          isDraft ? 'Load saved as draft' : 'Load posted successfully!'
        );
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6 md:p-8">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex items-center ${s < 4 ? 'flex-1' : ''}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s
                    ? 'bg-[#064d51] text-white'
                    : 'bg-[#064d51]/10 text-[#064d51]/60'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step > s ? 'bg-[#064d51]' : 'bg-[#064d51]/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-[#064d51]/70">
          <span>Location</span>
          <span>Load Details</span>
          <span>Pricing</span>
          <span>Review</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-rose-800">{error}</p>
        </div>
      )}

      {/* Step 1: Location & Schedule */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#064d51]">
            Location & Schedule
          </h2>

          {/* Pickup Information */}
          <div className="border-t border-[#064d51]/10 pt-6">
            <h3 className="text-lg font-semibold text-[#064d51] mb-4">
              Pickup Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Pickup City *
                </label>
                <select
                  value={formData.pickupCity}
                  onChange={(e) => updateField('pickupCity', e.target.value)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                >
                  <option value="">Select city...</option>
                  {ETHIOPIAN_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Pickup Date *
                </label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => updateField('pickupDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Pickup Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.pickupAddress}
                  onChange={(e) => updateField('pickupAddress', e.target.value)}
                  placeholder="Enter specific pickup location..."
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                />
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          <div className="border-t border-[#064d51]/10 pt-6">
            <h3 className="text-lg font-semibold text-[#064d51] mb-4">
              Delivery Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Delivery City *
                </label>
                <select
                  value={formData.deliveryCity}
                  onChange={(e) => updateField('deliveryCity', e.target.value)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                >
                  <option value="">Select city...</option>
                  {ETHIOPIAN_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Delivery Date *
                </label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => updateField('deliveryDate', e.target.value)}
                  min={formData.pickupDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Delivery Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress}
                  onChange={(e) =>
                    updateField('deliveryAddress', e.target.value)
                  }
                  placeholder="Enter specific delivery location..."
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                />
              </div>
            </div>
          </div>

          {/* Appointment Required */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="appointmentRequired"
              checked={formData.appointmentRequired}
              onChange={(e) =>
                updateField('appointmentRequired', e.target.checked)
              }
              className="h-4 w-4 text-[#1e9c99] focus:ring-[#1e9c99] border-[#064d51]/30 rounded"
            />
            <label
              htmlFor="appointmentRequired"
              className="ml-2 block text-sm text-[#064d51]/80"
            >
              Appointment required for pickup/delivery
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Load Details */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#064d51]">Load Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Truck Type *
              </label>
              <select
                value={formData.truckType}
                onChange={(e) => updateField('truckType', e.target.value)}
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              >
                {TRUCK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Weight (kg) *
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => updateField('weight', e.target.value)}
                min="0"
                step="0.01"
                placeholder="Enter weight..."
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Load Type *
              </label>
              <select
                value={formData.fullPartial}
                onChange={(e) => updateField('fullPartial', e.target.value)}
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              >
                <option value="FULL">Full Truckload</option>
                <option value="PARTIAL">Partial Load</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Cargo Description *
              </label>
              <textarea
                value={formData.cargoDescription}
                onChange={(e) =>
                  updateField('cargoDescription', e.target.value)
                }
                rows={3}
                placeholder="Describe the cargo..."
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
              <p className="text-xs text-[#064d51]/60 mt-1">
                Minimum 5 characters
              </p>
            </div>
          </div>

          {/* Special Requirements */}
          <div className="border-t border-[#064d51]/10 pt-6">
            <h3 className="text-lg font-semibold text-[#064d51] mb-4">
              Special Requirements
            </h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isFragile"
                  checked={formData.isFragile}
                  onChange={(e) => updateField('isFragile', e.target.checked)}
                  className="h-4 w-4 text-[#1e9c99] focus:ring-[#1e9c99] border-[#064d51]/30 rounded"
                />
                <label
                  htmlFor="isFragile"
                  className="ml-2 block text-sm text-[#064d51]/80"
                >
                  Fragile cargo (requires special handling)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requiresRefrigeration"
                  checked={formData.requiresRefrigeration}
                  onChange={(e) =>
                    updateField('requiresRefrigeration', e.target.checked)
                  }
                  className="h-4 w-4 text-[#1e9c99] focus:ring-[#1e9c99] border-[#064d51]/30 rounded"
                />
                <label
                  htmlFor="requiresRefrigeration"
                  className="ml-2 block text-sm text-[#064d51]/80"
                >
                  Requires refrigeration
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Pricing */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#064d51]">
            Pricing & Booking
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Rate (ETB) *
              </label>
              <input
                type="number"
                value={formData.rate}
                onChange={(e) => updateField('rate', e.target.value)}
                min="0"
                step="0.01"
                placeholder="Enter rate..."
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
              <p className="text-xs text-[#064d51]/60 mt-1">
                Total amount you're willing to pay
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Booking Mode *
              </label>
              <select
                value={formData.bookMode}
                onChange={(e) => updateField('bookMode', e.target.value)}
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              >
                <option value="REQUEST">Request (carrier must apply)</option>
                <option value="INSTANT">Instant (first come, first served)</option>
              </select>
            </div>
          </div>

          {/* Privacy & Contact */}
          <div className="border-t border-[#064d51]/10 pt-6">
            <h3 className="text-lg font-semibold text-[#064d51] mb-4">
              Privacy & Contact
            </h3>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isAnonymous"
                  checked={formData.isAnonymous}
                  onChange={(e) => updateField('isAnonymous', e.target.checked)}
                  className="h-4 w-4 text-[#1e9c99] focus:ring-[#1e9c99] border-[#064d51]/30 rounded"
                />
                <label
                  htmlFor="isAnonymous"
                  className="ml-2 block text-sm text-[#064d51]/80"
                >
                  Post anonymously (hide company name from carriers)
                </label>
              </div>

              {!formData.isAnonymous && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#064d51] mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.shipperContactName}
                      onChange={(e) =>
                        updateField('shipperContactName', e.target.value)
                      }
                      placeholder="Contact person name..."
                      className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#064d51] mb-2">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.shipperContactPhone}
                      onChange={(e) =>
                        updateField('shipperContactPhone', e.target.value)
                      }
                      placeholder="+251..."
                      className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Special Instructions (Optional)
                </label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) =>
                    updateField('specialInstructions', e.target.value)
                  }
                  rows={3}
                  placeholder="Any special instructions for the carrier..."
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#064d51]">Review & Submit</h2>

          <div className="bg-[#f0fdfa] rounded-xl p-6 space-y-4 border border-[#064d51]/10">
            <div>
              <h3 className="font-semibold text-[#064d51] mb-2">Route</h3>
              <p className="text-[#064d51]">
                {formData.pickupCity} → {formData.deliveryCity}
              </p>
              <p className="text-sm text-[#064d51]/70">
                {formData.pickupDate} to {formData.deliveryDate}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#064d51] mb-2">Load</h3>
              <p className="text-[#064d51]">
                {TRUCK_TYPES.find((t) => t.value === formData.truckType)?.label}
              </p>
              <p className="text-sm text-[#064d51]/70">
                {formData.weight} kg •{' '}
                {formData.fullPartial === 'FULL' ? 'Full Load' : 'Partial Load'}
              </p>
              <p className="text-sm text-[#064d51]/70">{formData.cargoDescription}</p>
            </div>

            <div>
              <h3 className="font-semibold text-[#064d51] mb-2">Rate</h3>
              <p className="text-2xl font-bold text-[#1e9c99]">
                {parseFloat(formData.rate || '0').toLocaleString()} ETB
              </p>
              <p className="text-sm text-[#064d51]/70">
                {formData.bookMode === 'INSTANT' ? 'Instant Book' : 'Request to Book'}
              </p>
            </div>

            {formData.isAnonymous && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  This load will be posted anonymously
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#1e9c99]/10 border border-[#1e9c99]/20 rounded-xl p-4">
            <p className="text-sm text-[#064d51]">
              By posting this load, you agree to the platform's terms of service
              and authorize carriers to bid on or accept this shipment.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={prevStep}
          disabled={step === 1 || isSubmitting}
          className="px-6 py-2 border border-[#064d51]/20 rounded-lg text-[#064d51] font-medium hover:bg-[#064d51]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <div className="flex gap-3">
          {step < 4 ? (
            <>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-6 py-2 border border-[#064d51]/20 rounded-lg text-[#064d51] font-medium hover:bg-[#064d51]/5 disabled:opacity-50 transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={nextStep}
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#064d51] text-white rounded-lg font-medium hover:bg-[#053d40] disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-6 py-2 border border-[#064d51]/20 rounded-lg text-[#064d51] font-medium hover:bg-[#064d51]/5 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#064d51] text-white rounded-lg font-medium hover:bg-[#053d40] disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Posting...' : 'Post Load'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
