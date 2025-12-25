'use client';

/**
 * Load Creation Form Component
 *
 * Multi-step form for creating load postings
 * Sprint 11 - Story 11.2: Load Creation Form
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Dire Dawa', 'Mekelle', 'Gondar', 'Bahir Dar',
  'Hawassa', 'Awasa', 'Jimma', 'Jijiga', 'Shashamane',
  'Bishoftu', 'Arba Minch', 'Hosaena', 'Harar', 'Dilla',
  'Nekemte', 'Debre Birhan', 'Asella', 'Debre Markos', 'Kombolcha',
  'Debre Tabor', 'Adigrat', 'Woldiya', 'Sodo', 'Gambela',
];

export default function LoadCreationForm() {
  const router = useRouter();

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
   * Get CSRF token
   */
  const getCSRFToken = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/csrf');
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return null;
    }
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

      // Prepare submission data
      const submitData = {
        ...formData,
        weight: parseFloat(formData.weight),
        rate: parseFloat(formData.rate),
        status: isDraft ? 'DRAFT' : 'POSTED',
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
        router.push(`/shipper/loads/${result.load.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create load');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error creating load:', error);
      setError('Failed to create load. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step > s ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <span>Location</span>
          <span>Load Details</span>
          <span>Pricing</span>
          <span>Review</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Step 1: Location & Schedule */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Location & Schedule
          </h2>

          {/* Pickup Information */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Pickup Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup City *
                </label>
                <select
                  value={formData.pickupCity}
                  onChange={(e) => updateField('pickupCity', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Date *
                </label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => updateField('pickupDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.pickupAddress}
                  onChange={(e) => updateField('pickupAddress', e.target.value)}
                  placeholder="Enter specific pickup location..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delivery Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery City *
                </label>
                <select
                  value={formData.deliveryCity}
                  onChange={(e) => updateField('deliveryCity', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Date *
                </label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => updateField('deliveryDate', e.target.value)}
                  min={formData.pickupDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress}
                  onChange={(e) =>
                    updateField('deliveryAddress', e.target.value)
                  }
                  placeholder="Enter specific delivery location..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="appointmentRequired"
              className="ml-2 block text-sm text-gray-700"
            >
              Appointment required for pickup/delivery
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Load Details */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Load Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Truck Type *
              </label>
              <select
                value={formData.truckType}
                onChange={(e) => updateField('truckType', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TRUCK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (kg) *
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => updateField('weight', e.target.value)}
                min="0"
                step="0.01"
                placeholder="Enter weight..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Load Type *
              </label>
              <select
                value={formData.fullPartial}
                onChange={(e) => updateField('fullPartial', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="FULL">Full Truckload</option>
                <option value="PARTIAL">Partial Load</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cargo Description *
              </label>
              <textarea
                value={formData.cargoDescription}
                onChange={(e) =>
                  updateField('cargoDescription', e.target.value)
                }
                rows={3}
                placeholder="Describe the cargo..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 5 characters
              </p>
            </div>
          </div>

          {/* Special Requirements */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Special Requirements
            </h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isFragile"
                  checked={formData.isFragile}
                  onChange={(e) => updateField('isFragile', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="isFragile"
                  className="ml-2 block text-sm text-gray-700"
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="requiresRefrigeration"
                  className="ml-2 block text-sm text-gray-700"
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
          <h2 className="text-2xl font-bold text-gray-900">
            Pricing & Booking
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate (ETB) *
              </label>
              <input
                type="number"
                value={formData.rate}
                onChange={(e) => updateField('rate', e.target.value)}
                min="0"
                step="0.01"
                placeholder="Enter rate..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total amount you're willing to pay
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Mode *
              </label>
              <select
                value={formData.bookMode}
                onChange={(e) => updateField('bookMode', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="REQUEST">Request (carrier must apply)</option>
                <option value="INSTANT">Instant (first come, first served)</option>
              </select>
            </div>
          </div>

          {/* Privacy & Contact */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Privacy & Contact
            </h3>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isAnonymous"
                  checked={formData.isAnonymous}
                  onChange={(e) => updateField('isAnonymous', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="isAnonymous"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Post anonymously (hide company name from carriers)
                </label>
              </div>

              {!formData.isAnonymous && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.shipperContactName}
                      onChange={(e) =>
                        updateField('shipperContactName', e.target.value)
                      }
                      placeholder="Contact person name..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.shipperContactPhone}
                      onChange={(e) =>
                        updateField('shipperContactPhone', e.target.value)
                      }
                      placeholder="+251..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Instructions (Optional)
                </label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) =>
                    updateField('specialInstructions', e.target.value)
                  }
                  rows={3}
                  placeholder="Any special instructions for the carrier..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Review & Submit</h2>

          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Route</h3>
              <p className="text-gray-700">
                {formData.pickupCity} → {formData.deliveryCity}
              </p>
              <p className="text-sm text-gray-600">
                {formData.pickupDate} to {formData.deliveryDate}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Load</h3>
              <p className="text-gray-700">
                {TRUCK_TYPES.find((t) => t.value === formData.truckType)?.label}
              </p>
              <p className="text-sm text-gray-600">
                {formData.weight} kg •{' '}
                {formData.fullPartial === 'FULL' ? 'Full Load' : 'Partial Load'}
              </p>
              <p className="text-sm text-gray-600">{formData.cargoDescription}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Rate</h3>
              <p className="text-2xl font-bold text-blue-600">
                {parseFloat(formData.rate || '0').toLocaleString()} ETB
              </p>
              <p className="text-sm text-gray-600">
                {formData.bookMode === 'INSTANT' ? 'Instant Book' : 'Request to Book'}
              </p>
            </div>

            {formData.isAnonymous && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-sm text-yellow-800">
                  This load will be posted anonymously
                </p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
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
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <div className="flex gap-3">
          {step < 4 ? (
            <>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={nextStep}
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
