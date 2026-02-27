/**
 * Ethiopian Cities, Towns, and Regions
 *
 * Comprehensive list of Ethiopian locations for use in dropdowns
 * and location selection across the FreightET platform
 */

export const ETHIOPIAN_LOCATIONS = [
  // Major Cities
  "Addis Ababa",
  "Dire Dawa",
  "Mekele",
  "Gondar",
  "Hawassa",
  "Bahir Dar",
  "Jimma",
  "Adama (Nazret)",
  "Dessie",
  "Jijiga",

  // Regional Capitals
  "Harar",
  "Gambela",
  "Semera",
  "Asosa",

  // Major Towns & Cities (Alphabetically organized)
  "Addis Zemen",
  "Adigrat",
  "Akaki",
  "Ambo",
  "Arba Minch",
  "Asaita",
  "Asella",
  "Awash",
  "Axum",
  "Bale Robe",
  "Bedele",
  "Bonga",
  "Bule Hora",
  "Butajira",
  "Chiro",
  "Debre Birhan",
  "Debre Markos",
  "Debre Tabor",
  "Dembidolo",
  "Dilla",
  "Djibouti", // Important heavy duty truck route
  "Finote Selam",
  "Goba",
  "Gode",
  "Gore",
  "Hosaena",
  "Inda Silase",
  "Kemise",
  "Kombolcha",
  "Lalibela",
  "Metu",
  "Mizan Teferi",
  "Mojo", // Important heavy duty truck route
  "Negele Arsi",
  "Negele Borena",
  "Nekemte",
  "Sebeta",
  "Shakiso",
  "Shambu",
  "Shashamane",
  "Shire",
  "Sodo",
  "Welkite",
  "Weldiya",
  "Yabelo",
  "Ziway",
].sort();

/**
 * Get location options formatted for select dropdowns
 */
export function getLocationOptions() {
  return [
    { value: "", label: "Select City" },
    ...ETHIOPIAN_LOCATIONS.map((location) => ({
      value: location,
      label: location,
    })),
  ];
}

/**
 * Validate if a location is in the Ethiopian locations list
 */
export function isValidEthiopianLocation(location: string): boolean {
  return ETHIOPIAN_LOCATIONS.includes(location);
}

/**
 * Get Ethiopian regions
 */
export const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "Southern Nations, Nationalities, and Peoples Region (SNNPR)",
  "South West Ethiopia",
  "Tigray",
].sort();
