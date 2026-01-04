'use client';

/**
 * Add Truck Form Component
 *
 * Form for registering a new truck with Google Places Autocomplete
 * Sprint 12 - Story 12.2: Truck Management
 * Updated: Task 4 - PlacesAutocomplete for location
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import PlacesAutocomplete, { PlaceResult } from '@/components/PlacesAutocomplete';

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

// Ethiopian cities removed - now using Google Places Autocomplete for dynamic location search

const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'Southern Nations, Nationalities, and Peoples',
  'Southwest Ethiopia',
  'Tigray',
];

export default function AddTruckForm() {
  const router = useRouter();
  const toast = useToast();

  const [formData, setFormData] = useState({
    truckType: 'FLATBED',
    licensePlate: '',
    capacity: '',
    volume: '',
    currentCity: '',
    currentRegion: '',
    currentLat: undefined as number | undefined,
    currentLng: undefined as number | undefined,
    isAvailable: true,
    gpsDeviceId: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
   * Handle input change
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value,
    });
  };

  /**
   * Handle location change from PlacesAutocomplete
   */
  const handleLocationChange = (value: string, place?: PlaceResult) => {
    if (place) {
      // Full place selected with coordinates
      setFormData({
        ...formData,
        currentCity: place.city || value,
        currentRegion: place.region || '',
        currentLat: place.coordinates.lat,
        currentLng: place.coordinates.lng,
      });
    } else {
      // Manual text input
      setFormData({
        ...formData,
        currentCity: value,
        currentLat: undefined,
        currentLng: undefined,
      });
    }
  };

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    if (!formData.licensePlate.trim()) {
      setError('License plate is required');
      return false;
    }

    if (!formData.capacity || parseFloat(formData.capacity) <= 0) {
      setError('Capacity must be greater than 0');
      return false;
    }

    if (formData.volume && parseFloat(formData.volume) <= 0) {
      setError('Volume must be greater than 0');
      return false;
    }

    setError('');
    return true;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
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

      // Prepare data
      const truckData = {
        truckType: formData.truckType,
        licensePlate: formData.licensePlate.trim(),
        capacity: parseFloat(formData.capacity),
        volume: formData.volume ? parseFloat(formData.volume) : undefined,
        currentCity: formData.currentCity || undefined,
        currentRegion: formData.currentRegion || undefined,
        isAvailable: formData.isAvailable,
        gpsDeviceId: formData.gpsDeviceId || undefined,
      };

      const response = await fetch('/api/trucks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(truckData),
        credentials: 'include',
      });

      if (response.ok) {
        // Success - redirect to trucks list with pending tab selected
        // Sprint 18: Trucks are now pending admin approval
        toast.success('Truck submitted for admin approval!');
        router.push('/carrier/trucks?tab=pending&success=truck-added');
        router.refresh();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to add truck';
        setError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error adding truck:', error);
      const errorMessage = 'Failed to add truck. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Standard input class for consistency
  const inputClass = "w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400";
  const selectClass = "w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-semibold text-gray-800 mb-2";
  const hintClass = "text-xs text-gray-500 mt-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 md:p-8">
      <div className="space-y-6">
        {/* Form Header */}
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">Add New Truck</h2>
          <p className="text-gray-600 mt-1">Fill in the details below to register a new truck</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Truck Type */}
        <div>
          <label className={labelClass}>
            Truck Type <span className="text-red-500">*</span>
          </label>
          <select
            name="truckType"
            value={formData.truckType}
            onChange={handleChange}
            required
            className={selectClass}
          >
            {TRUCK_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* License Plate */}
        <div>
          <label className={labelClass}>
            License Plate <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="licensePlate"
            value={formData.licensePlate}
            onChange={handleChange}
            required
            placeholder="e.g., AA-12345"
            className={inputClass}
          />
          <p className={hintClass}>
            Must be unique and at least 3 characters
          </p>
        </div>

        {/* Capacity and Volume */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>
              Capacity (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              required
              min="1"
              step="0.01"
              placeholder="e.g., 5000"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Volume (m³)
            </label>
            <input
              type="number"
              name="volume"
              value={formData.volume}
              onChange={handleChange}
              min="0.01"
              step="0.01"
              placeholder="e.g., 20"
              className={inputClass}
            />
          </div>
        </div>

        {/* Current Location - Google Places Autocomplete */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>
              Current City
            </label>
            <PlacesAutocomplete
              value={formData.currentCity}
              onChange={handleLocationChange}
              placeholder="Search for city..."
              className={inputClass}
              countryRestriction={['ET', 'DJ']}
              types={['(cities)']}
              name="currentCity"
            />
            <p className={hintClass}>
              Start typing to search Ethiopian and Djibouti cities
            </p>
          </div>

          <div>
            <label className={labelClass}>
              Current Region
            </label>
            <select
              name="currentRegion"
              value={formData.currentRegion}
              onChange={handleChange}
              className={selectClass}
            >
              <option value="">Select region...</option>
              {ETHIOPIAN_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <p className={hintClass}>
              Auto-populated when selecting a city
            </p>
          </div>
        </div>

        {/* GPS Device ID */}
        <div>
          <label className={labelClass}>
            GPS Device ID
          </label>
          <input
            type="text"
            name="gpsDeviceId"
            value={formData.gpsDeviceId}
            onChange={handleChange}
            placeholder="e.g., GPS123456"
            className={inputClass}
          />
          <p className={hintClass}>
            Optional: Enter the GPS device ID if the truck has tracking enabled
          </p>
        </div>

        {/* Is Available */}
        <div className="flex items-center bg-gray-50 p-4 rounded-lg">
          <input
            type="checkbox"
            name="isAvailable"
            checked={formData.isAvailable}
            onChange={handleChange}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label className="ml-3 block text-sm font-medium text-gray-800">
            Mark truck as available for new loads
          </label>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
