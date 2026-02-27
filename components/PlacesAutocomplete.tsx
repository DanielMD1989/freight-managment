"use client";

/**
 * Google Places Autocomplete Component
 *
 * Provides real-time location autocomplete for Ethiopian and Djibouti cities/addresses
 * Sprint 15 - Story 15.1: Google Places Autocomplete Integration
 */

import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

export interface PlaceResult {
  address: string;
  city: string;
  region: string;
  country: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId: string;
  formattedAddress: string;
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string, place?: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  countryRestriction?: string[]; // ISO 3166-1 Alpha-2 country codes
  types?: string[]; // Place types to filter (e.g., ['(cities)', 'geocode'])
  required?: boolean;
  name?: string;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  placeholder = "Search for a city or address...",
  className = "",
  disabled = false,
  countryRestriction = ["ET", "DJ"], // Ethiopia and Djibouti
  types = ["(cities)"], // Default to cities only
  required = false,
  name,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "Google Maps API key not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file."
      );
      setIsLoading(false);
      return;
    }

    // Load Google Maps JavaScript API
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loader
      .load()
      .then(() => {
        setIsApiLoaded(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error loading Google Maps API:", err);
        setError(
          "Failed to load Google Maps API. Please check your internet connection."
        );
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isApiLoaded || !inputRef.current || autocompleteRef.current) {
      return;
    }

    // Initialize Autocomplete
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types,
      componentRestrictions:
        countryRestriction.length > 0
          ? { country: countryRestriction }
          : undefined,
      fields: [
        "address_components",
        "geometry",
        "formatted_address",
        "place_id",
        "name",
      ],
    });

    autocompleteRef.current = autocomplete;

    // Handle place selection
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        console.warn("No location details available for this place");
        return;
      }

      // Extract city and region from address components
      let city = "";
      let region = "";
      let country = "";

      place.address_components?.forEach((component) => {
        const types = component.types;

        if (
          types.includes("locality") ||
          types.includes("administrative_area_level_2")
        ) {
          city = component.long_name;
        } else if (types.includes("administrative_area_level_1")) {
          region = component.long_name;
        } else if (types.includes("country")) {
          country = component.long_name;
        }
      });

      // Use place name as fallback if city is not found
      if (!city && place.name) {
        city = place.name;
      }

      const placeResult: PlaceResult = {
        address: city,
        city,
        region,
        country,
        coordinates: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        },
        placeId: place.place_id || "",
        formattedAddress: place.formatted_address || "",
      };

      onChange(city || place.formatted_address || "", placeResult);
    });

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [isApiLoaded, types, countryRestriction, onChange]);

  // Handle manual input changes (when user types without selecting)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  if (error) {
    // Fallback to regular text input if API fails
    return (
      <div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          required={required}
          name={name}
        />
        <p className="mt-1 text-xs text-red-600">{error}</p>
        <p className="mt-1 text-xs text-gray-500">Using fallback text input</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled || isLoading}
        required={required}
        name={name}
      />
      {isLoading && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
