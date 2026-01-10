'use client';

/**
 * Edit Truck Form Component
 *
 * Form for editing an existing truck or resubmitting a rejected truck
 * Sprint 12 - Story 12.2: Truck Management
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

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume?: number | null;
  currentCity?: string | null;
  currentRegion?: string | null;
  isAvailable: boolean;
  status: string;
  approvalStatus: string;
  rejectionReason?: string | null;
}

interface EditTruckFormProps {
  truck: Truck;
  isResubmit: boolean;
}

export default function EditTruckForm({ truck, isResubmit }: EditTruckFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [formData, setFormData] = useState({
    truckType: truck.truckType,
    licensePlate: truck.licensePlate,
    capacity: truck.capacity.toString(),
    volume: truck.volume?.toString() || '',
    currentCity: truck.currentCity || '',
    currentRegion: truck.currentRegion || '',
    isAvailable: truck.isAvailable,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  /**
   * Get CSRF token
   */
  const getCSRFToken = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/csrf-token');
      if (!response.ok) {
        console.error('CSRF token request failed:', response.status);
        return null;
      }
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
      setFormData({
        ...formData,
        currentCity: place.city || value,
        currentRegion: place.region || '',
      });
    } else {
      setFormData({
        ...formData,
        currentCity: value,
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

      // Prepare update data
      const updateData: Record<string, unknown> = {
        truckType: formData.truckType,
        licensePlate: formData.licensePlate.trim(),
        capacity: parseFloat(formData.capacity),
        volume: formData.volume ? parseFloat(formData.volume) : null,
        currentCity: formData.currentCity || null,
        currentRegion: formData.currentRegion || null,
        isAvailable: formData.isAvailable,
      };

      // If resubmitting, reset approval status to PENDING
      if (isResubmit) {
        updateData.approvalStatus = 'PENDING';
        updateData.rejectionReason = null;
      }

      const response = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(updateData),
        credentials: 'include',
      });

      if (response.ok) {
        if (isResubmit) {
          toast.success('Truck resubmitted for approval!');
          router.push('/carrier/trucks?tab=pending&success=truck-resubmitted');
        } else {
          toast.success('Truck updated successfully!');
          router.push('/carrier/trucks?success=truck-updated');
        }
        router.refresh();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to update truck';
        setError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error updating truck:', error);
      const errorMessage = 'Failed to update truck. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Standard input class for consistency - Teal design system
  const inputClass = "w-full px-4 py-3 bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] placeholder-[#064d51]/50 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600";
  const selectClass = "w-full px-4 py-3 bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600";
  const labelClass = "block text-sm font-semibold text-[#064d51] dark:text-gray-200 mb-2";
  const hintClass = "text-xs text-[#064d51]/60 dark:text-gray-400 mt-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 md:p-8">
      <div className="space-y-6">
        {/* Form Header */}
        <div className="border-b border-[#064d51]/10 dark:border-slate-700 pb-4">
          <h2 className="text-2xl font-bold text-[#064d51] dark:text-white">
            {isResubmit ? 'Resubmit Truck' : 'Edit Truck'}
          </h2>
          <p className="text-[#064d51]/70 dark:text-gray-400 mt-1">
            {isResubmit
              ? 'Update and resubmit your truck for admin approval'
              : 'Update your truck information'
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300 text-sm font-medium">{error}</p>
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

        {/* Is Available */}
        <div className="flex items-center bg-[#f0fdfa] dark:bg-slate-800 p-4 rounded-lg">
          <input
            type="checkbox"
            name="isAvailable"
            checked={formData.isAvailable}
            onChange={handleChange}
            className="h-5 w-5 text-[#1e9c99] border-[#064d51]/30 rounded focus:ring-[#1e9c99]"
          />
          <label className="ml-3 block text-sm font-medium text-[#064d51] dark:text-gray-200">
            Mark truck as available for new loads
          </label>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-6 border-t border-[#064d51]/10 dark:border-slate-700">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-[#064d51] text-white rounded-lg font-semibold hover:bg-[#053d40] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting
              ? (isResubmit ? 'Resubmitting...' : 'Saving...')
              : (isResubmit ? 'Resubmit for Approval' : 'Save Changes')
            }
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="px-6 py-3 bg-white dark:bg-slate-800 border border-[#064d51]/20 dark:border-slate-600 text-[#064d51] dark:text-gray-300 rounded-lg font-semibold hover:bg-[#f0fdfa] dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
