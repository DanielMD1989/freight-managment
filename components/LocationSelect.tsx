"use client";

import { useState, useEffect, useRef } from "react";

interface Location {
  id: string;
  name: string;
  nameEthiopic: string | null;
  region: string;
  type: string;
}

interface LocationSelectProps {
  value: string; // Location ID
  onChange: (locationId: string, locationName: string) => void;
  required?: boolean;
  placeholder?: string;
  label?: string;
}

export default function LocationSelect({
  value,
  onChange,
  required = false,
  placeholder = "Search for a city...",
  label,
}: LocationSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch location by ID when value changes externally
  useEffect(() => {
    if (value && !selectedLocation) {
      fetchLocationById(value);
    }
  }, [value]);

  // Fetch location details by ID
  const fetchLocationById = async (locationId: string) => {
    try {
      const response = await fetch(`/api/locations/${locationId}`);
      if (response.ok) {
        const location = await response.json();
        setSelectedLocation(location);
        setSearchQuery(location.name);
      }
    } catch (error) {
      console.error("Error fetching location:", error);
    }
  };

  // Search locations with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchLocations(searchQuery);
      } else if (searchQuery.length === 0) {
        setLocations([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchLocations = async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/locations?q=${encodeURIComponent(query)}&limit=20`
      );
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error searching locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
    setSearchQuery(location.name);
    setIsOpen(false);
    onChange(location.id, location.name);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);

    // Clear selection if user modifies the input
    if (selectedLocation && newValue !== selectedLocation.name) {
      setSelectedLocation(null);
      onChange("", "");
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <input
        type="text"
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={() => {
          if (locations.length > 0) setIsOpen(true);
        }}
        required={required}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-3 top-9 text-gray-400">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {isOpen && locations.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md bg-white shadow-lg border border-gray-200">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => handleSelectLocation(location)}
              className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{location.name}</div>
              <div className="text-sm text-gray-500">
                {location.nameEthiopic && (
                  <span className="mr-2">{location.nameEthiopic}</span>
                )}
                <span>
                  {location.region} · {location.type}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchQuery.length >= 2 && locations.length === 0 && !loading && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 p-4 text-center text-gray-500">
          No locations found for &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}
