'use client';

/**
 * Create Truck Posting Form Component
 *
 * Form for creating a new truck posting
 * Sprint 12 - Story 12.3: Truck Posting
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { getCSRFToken } from '@/lib/csrfFetch';

interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
}

interface Location {
  id: string;
  name: string;
  nameEthiopic: string | null;
  region: string;
}

export default function CreatePostingForm({ trucks }: { trucks: Truck[] }) {
  const router = useRouter();
  const toast = useToast();

  const [formData, setFormData] = useState({
    truckId: '',
    originCityId: '',
    destinationCityId: '',
    availableFrom: '',
    availableTo: '',
    fullPartial: 'FULL',
    contactName: '',
    contactPhone: '',
    notes: '',
  });

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  /**
   * Fetch locations on mount
   */
  useEffect(() => {
    fetchLocations();
  }, []);

  /**
   * Fetch Ethiopian locations
   */
  const fetchLocations = async () => {
    try {
      setIsLoadingLocations(true);
      const response = await fetch('/api/locations?limit=100');
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setIsLoadingLocations(false);
    }
  };

  /**
   * Handle input change
   */
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    if (!formData.truckId) {
      setError('Please select a truck');
      return false;
    }

    if (!formData.originCityId) {
      setError('Origin city is required');
      return false;
    }

    if (!formData.availableFrom) {
      setError('Availability start date is required');
      return false;
    }

    if (!formData.contactName.trim()) {
      setError('Contact name is required');
      return false;
    }

    if (!formData.contactPhone.trim()) {
      setError('Contact phone is required');
      return false;
    }

    // Validate phone format (simple validation)
    const phoneRegex = /^[+]?[\d\s()-]{10,}$/;
    if (!phoneRegex.test(formData.contactPhone.trim())) {
      setError('Please enter a valid phone number');
      return false;
    }

    // Validate dates
    const availableFrom = new Date(formData.availableFrom);
    const now = new Date();
    if (availableFrom < now) {
      setError('Availability start date must be in the future');
      return false;
    }

    if (formData.availableTo) {
      const availableTo = new Date(formData.availableTo);
      if (availableTo <= availableFrom) {
        setError('Availability end date must be after start date');
        return false;
      }
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
      const postingData = {
        truckId: formData.truckId,
        originCityId: formData.originCityId,
        destinationCityId: formData.destinationCityId || null,
        availableFrom: new Date(formData.availableFrom).toISOString(),
        availableTo: formData.availableTo
          ? new Date(formData.availableTo).toISOString()
          : null,
        fullPartial: formData.fullPartial,
        contactName: formData.contactName.trim(),
        contactPhone: formData.contactPhone.trim(),
        notes: formData.notes.trim() || null,
      };

      const response = await fetch('/api/truck-postings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify(postingData),
        credentials: 'include',
      });

      if (response.ok) {
        // Success - redirect to postings list
        toast.success('Truck posting created successfully!');
        router.push('/carrier/postings?success=posting-created');
        router.refresh();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to create posting';
        setError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error creating posting:', error);
      const errorMessage = 'Failed to create posting. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Truck Selection */}
        <div>
          <label className="block text-sm font-medium text-[#064d51] mb-2">
            Select Truck *
          </label>
          <select
            name="truckId"
            value={formData.truckId}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
          >
            <option value="">Choose a truck...</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.licensePlate} - {truck.truckType.replace(/_/g, ' ')} (
                {truck.capacity.toLocaleString()} kg)
              </option>
            ))}
          </select>
        </div>

        {/* Route Section */}
        <div className="border-t border-[#064d51]/10 pt-6">
          <h3 className="text-lg font-semibold text-[#064d51] mb-4">Route</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Origin City */}
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Origin City *
              </label>
              <select
                name="originCityId"
                value={formData.originCityId}
                onChange={handleChange}
                required
                disabled={isLoadingLocations}
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] disabled:opacity-50"
              >
                <option value="">
                  {isLoadingLocations ? 'Loading...' : 'Select origin...'}
                </option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.region})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination City */}
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Destination City
              </label>
              <select
                name="destinationCityId"
                value={formData.destinationCityId}
                onChange={handleChange}
                disabled={isLoadingLocations}
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] disabled:opacity-50"
              >
                <option value="">Any destination</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.region})
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#064d51]/60 mt-1">
                Leave empty if going to any destination
              </p>
            </div>
          </div>
        </div>

        {/* Availability Section */}
        <div className="border-t border-[#064d51]/10 pt-6">
          <h3 className="text-lg font-semibold text-[#064d51] mb-4">
            Availability
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Available From */}
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Available From *
              </label>
              <input
                type="datetime-local"
                name="availableFrom"
                value={formData.availableFrom}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>

            {/* Available To */}
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Available To
              </label>
              <input
                type="datetime-local"
                name="availableTo"
                value={formData.availableTo}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
              <p className="text-xs text-[#064d51]/60 mt-1">
                Leave empty for indefinite availability
              </p>
            </div>
          </div>

          {/* Full/Partial Load */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-[#064d51] mb-2">
              Load Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="fullPartial"
                  value="FULL"
                  checked={formData.fullPartial === 'FULL'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm text-[#064d51]">Full Load Only</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="fullPartial"
                  value="PARTIAL"
                  checked={formData.fullPartial === 'PARTIAL'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm text-[#064d51]">Partial Loads OK</span>
              </label>
            </div>
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="border-t border-[#064d51]/10 pt-6">
          <h3 className="text-lg font-semibold text-[#064d51] mb-4">
            Contact Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Name */}
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Contact Name *
              </label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                required
                placeholder="e.g., John Doe"
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-2">
                Contact Phone *
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                required
                placeholder="e.g., +251-911-123456"
                className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-[#064d51] mb-2">
            Additional Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            maxLength={500}
            placeholder="Any additional information about this posting..."
            className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
          />
          <p className="text-xs text-[#064d51]/60 mt-1">
            {formData.notes.length}/500 characters
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-4 border-t border-[#064d51]/10">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-[#064d51] text-white rounded-lg font-medium hover:bg-[#053d40] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating Posting...' : 'Create Posting'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="px-6 py-3 border border-[#064d51]/20 text-[#064d51] rounded-lg font-medium hover:bg-[#f0fdfa] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
