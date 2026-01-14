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
  { value: 'TITLE_DEED', label: 'Title Deed', description: 'Proof of truck ownership' },
  { value: 'REGISTRATION', label: 'Vehicle Registration', description: 'Official vehicle registration document' },
  { value: 'INSURANCE', label: 'Insurance Certificate', description: 'Valid insurance coverage document' },
  { value: 'ROAD_WORTHINESS', label: 'Road Worthiness', description: 'Road worthiness certification' },
  { value: 'DRIVER_LICENSE', label: 'Driver License', description: "Driver's license for this truck" },
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

    // Get CSRF token for uploads
    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      console.error('Failed to get CSRF token for document upload');
      setUploadingDocs(false);
      return false;
    }

    for (const doc of queuedDocuments) {
      try {
        const formData = new FormData();
        formData.append('file', doc.file);
        formData.append('type', doc.type);
        formData.append('entityType', 'truck');
        formData.append('entityId', truckId);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
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

  // Professional input styling - Teal design system
  const inputClass = "w-full h-9 px-3 text-sm bg-[#f0fdfa] dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded focus:ring-1 focus:ring-[#1e9c99] focus:border-[#1e9c99] focus:bg-white dark:focus:bg-slate-700 placeholder-[#064d51]/50 transition-colors";
  const selectClass = "w-full h-9 px-3 text-sm bg-[#f0fdfa] dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded focus:ring-1 focus:ring-[#1e9c99] focus:border-[#1e9c99] focus:bg-white dark:focus:bg-slate-700 transition-colors";
  const labelClass = "block text-xs font-medium text-[#064d51] dark:text-gray-400 mb-1 uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Vehicle Information Section */}
      <div className="bg-white dark:bg-slate-900 border border-[#064d51]/20 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-[#f0fdfa] dark:bg-slate-800 border-b border-[#064d51]/10 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-[#064d51] dark:text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#1e9c99]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            Vehicle Information
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Truck Type <span className="text-red-500">*</span></label>
              <select name="truckType" value={formData.truckType} onChange={handleChange} required className={selectClass}>
                {TRUCK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>License Plate <span className="text-red-500">*</span></label>
              <input type="text" name="licensePlate" value={formData.licensePlate} onChange={handleChange} required placeholder="AA-12345" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Capacity (kg) <span className="text-red-500">*</span></label>
              <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} required min="1" placeholder="5000" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Volume (m³)</label>
              <input type="number" name="volume" value={formData.volume} onChange={handleChange} min="0.01" placeholder="20" className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      {/* Location Section */}
      <div className="bg-white dark:bg-slate-900 border border-[#064d51]/20 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-[#f0fdfa] dark:bg-slate-800 border-b border-[#064d51]/10 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-[#064d51] dark:text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#1e9c99]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Current Location
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>City</label>
              <PlacesAutocomplete value={formData.currentCity} onChange={handleLocationChange} placeholder="Search city..." className={inputClass} countryRestriction={['ET', 'DJ']} types={['(cities)']} name="currentCity" />
            </div>
            <div>
              <label className={labelClass}>Region</label>
              <select name="currentRegion" value={formData.currentRegion} onChange={handleChange} className={selectClass}>
                <option value="">Select...</option>
                {ETHIOPIAN_REGIONS.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>GPS Device ID</label>
            <input type="text" name="gpsDeviceId" value={formData.gpsDeviceId} onChange={handleChange} placeholder="GPS123456 (optional)" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white dark:bg-slate-900 border border-[#064d51]/20 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-[#f0fdfa] dark:bg-slate-800 border-b border-[#064d51]/10 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-[#064d51] dark:text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#1e9c99]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documents
            <span className="text-xs font-normal text-[#064d51]/50">(optional)</span>
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Document Type</label>
              <select value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value as TruckDocumentType)} className={selectClass}>
                {TRUCK_DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>File</label>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="w-full h-9 text-sm text-[#064d51]/70 file:mr-2 file:h-9 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#064d51] file:text-white hover:file:bg-[#053d40] cursor-pointer" />
            </div>
          </div>
          {queuedDocuments.length > 0 && (
            <div className="space-y-1.5">
              {queuedDocuments.map((doc, index) => (
                <div key={index} className="flex items-center justify-between bg-[#f0fdfa] dark:bg-slate-800 px-3 py-2 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#1e9c99]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-[#064d51] dark:text-gray-300">{doc.file.name}</span>
                    <span className="text-xs text-[#064d51]/60">({doc.type.replace(/_/g, ' ')})</span>
                  </div>
                  <button type="button" onClick={() => removeQueuedDocument(index)} className="text-red-500 hover:text-red-700 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Availability Toggle */}
      <label className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-[#064d51]/20 dark:border-slate-700 rounded-lg p-4 cursor-pointer hover:bg-[#f0fdfa] dark:hover:bg-slate-800 transition-colors">
        <input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={handleChange} className="h-4 w-4 text-[#1e9c99] border-[#064d51]/30 rounded focus:ring-[#1e9c99]" />
        <div>
          <p className="text-sm font-medium text-[#064d51] dark:text-gray-200">Available for loads</p>
          <p className="text-xs text-[#064d51]/60">This truck can be matched with available loads</p>
        </div>
      </label>

      {/* Submit Buttons */}
      <div className="flex gap-3">
        <button type="submit" disabled={isSubmitting || uploadingDocs} className="flex-1 h-10 bg-[#064d51] text-white text-sm font-medium rounded-lg hover:bg-[#053d40] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {(isSubmitting || uploadingDocs) && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {uploadingDocs ? 'Uploading...' : isSubmitting ? 'Submitting...' : 'Submit for Approval'}
        </button>
        <button type="button" onClick={() => router.back()} disabled={isSubmitting || uploadingDocs} className="px-6 h-10 bg-white dark:bg-slate-800 border border-[#064d51]/20 dark:border-slate-600 text-[#064d51] dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-[#f0fdfa] dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
