'use client';

/**
 * Add Truck Form Component
 *
 * Form for registering a new truck with Google Places Autocomplete
 * Sprint 12 - Story 12.2: Truck Management
 * Updated: Task 4 - PlacesAutocomplete for location
 * Updated: Document upload during truck creation
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import PlacesAutocomplete, { PlaceResult } from '@/components/PlacesAutocomplete';
import { TruckDocumentType } from '@prisma/client';

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

const TRUCK_DOCUMENT_TYPES: { value: TruckDocumentType; label: string; description: string }[] = [
  { value: 'REGISTRATION', label: 'Vehicle Registration', description: 'Official vehicle registration document' },
  { value: 'INSURANCE', label: 'Insurance Certificate', description: 'Valid insurance coverage document' },
  { value: 'INSPECTION', label: 'Inspection Certificate', description: 'Latest vehicle inspection report' },
  { value: 'ROAD_WORTHINESS', label: 'Road Worthiness', description: 'Road worthiness certification' },
  { value: 'OTHER', label: 'Other Document', description: 'Any other relevant document' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

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

interface QueuedDocument {
  file: File;
  type: TruckDocumentType;
}

export default function AddTruckForm() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Document upload state
  const [queuedDocuments, setQueuedDocuments] = useState<QueuedDocument[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<TruckDocumentType>('REGISTRATION');
  const [uploadingDocs, setUploadingDocs] = useState(false);

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
   * Handle document file selection
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload PDF, JPG, or PNG files.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    // Add to queue
    setQueuedDocuments(prev => [...prev, { file, type: selectedDocType }]);
    toast.success(`${file.name} added to upload queue`);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Remove document from queue
   */
  const removeQueuedDocument = (index: number) => {
    setQueuedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Upload queued documents after truck creation
   */
  const uploadQueuedDocuments = async (truckId: string): Promise<boolean> => {
    if (queuedDocuments.length === 0) return true;

    setUploadingDocs(true);
    let allSuccessful = true;

    for (const doc of queuedDocuments) {
      try {
        const formData = new FormData();
        formData.append('file', doc.file);
        formData.append('type', doc.type);
        formData.append('entityType', 'truck');
        formData.append('entityId', truckId);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          console.error(`Failed to upload ${doc.file.name}`);
          allSuccessful = false;
        }
      } catch (error) {
        console.error(`Error uploading ${doc.file.name}:`, error);
        allSuccessful = false;
      }
    }

    setUploadingDocs(false);
    return allSuccessful;
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
        const truckData = await response.json();

        // Upload queued documents if any
        if (queuedDocuments.length > 0) {
          toast.info('Uploading documents...');
          const docsUploaded = await uploadQueuedDocuments(truckData.id);
          if (!docsUploaded) {
            toast.warning('Truck created but some documents failed to upload. You can upload them later.');
          } else {
            toast.success('Documents uploaded successfully!');
          }
        }

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

  // Standard input class for consistency (dark mode supported via globals.css)
  const inputClass = "w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600";
  const selectClass = "w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600";
  const labelClass = "block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2";
  const hintClass = "text-xs text-gray-500 dark:text-gray-400 mt-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 md:p-8">
      <div className="space-y-6">
        {/* Form Header */}
        <div className="border-b border-gray-200 dark:border-slate-700 pb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Truck</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Fill in the details below to register a new truck</p>
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

        {/* Documents Section */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Truck Documents
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upload vehicle registration, insurance, and other required documents. Documents will be uploaded after truck creation.
          </p>

          {/* Document Type Selection and File Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Document Type</label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value as TruckDocumentType)}
                className={selectClass}
              >
                {TRUCK_DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className={hintClass}>
                {TRUCK_DOCUMENT_TYPES.find((t) => t.value === selectedDocType)?.description}
              </p>
            </div>
            <div>
              <label className={labelClass}>Select File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className={`${inputClass} file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-blue-300`}
              />
              <p className={hintClass}>PDF, JPG, or PNG (max 10MB)</p>
            </div>
          </div>

          {/* Queued Documents List */}
          {queuedDocuments.length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Documents to Upload ({queuedDocuments.length})
              </h4>
              <div className="space-y-2">
                {queuedDocuments.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white dark:bg-slate-700 p-3 rounded-lg border border-gray-200 dark:border-slate-600"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{doc.file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.type.replace(/_/g, ' ')} • {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQueuedDocument(index)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Is Available */}
        <div className="flex items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
          <input
            type="checkbox"
            name="isAvailable"
            checked={formData.isAvailable}
            onChange={handleChange}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label className="ml-3 block text-sm font-medium text-gray-800 dark:text-gray-200">
            Mark truck as available for new loads
          </label>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-slate-700">
          <button
            type="submit"
            disabled={isSubmitting || uploadingDocs}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {uploadingDocs
              ? 'Uploading Documents...'
              : isSubmitting
                ? 'Submitting...'
                : queuedDocuments.length > 0
                  ? `Submit for Approval (${queuedDocuments.length} doc${queuedDocuments.length > 1 ? 's' : ''})`
                  : 'Submit for Approval'
            }
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting || uploadingDocs}
            className="px-6 py-3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
