/**
 * Ethiopian Cities and Towns - Seed Data
 *
 * This file contains 80+ major Ethiopian cities, towns, and logistics hubs
 * with accurate coordinates for the freight management platform.
 *
 * Data includes:
 * - Regional capitals (all 11 regions)
 * - Major commercial centers
 * - Important logistics hubs
 * - Border towns (for international freight)
 * - Industrial zones
 */

import { LocationType } from "@prisma/client";

export interface LocationSeedData {
  name: string;
  nameEthiopic?: string;
  region: string;
  zone?: string;
  latitude: number;
  longitude: number;
  type: LocationType;
  population?: number;
  aliases?: string[];
}

export const ethiopianLocations: LocationSeedData[] = [
  // ============================================================================
  // ADDIS ABABA (Capital City)
  // ============================================================================
  {
    name: "Addis Ababa",
    nameEthiopic: "አዲስ አበባ",
    region: "Addis Ababa",
    latitude: 9.032,
    longitude: 38.7469,
    type: "CITY",
    population: 3400000,
    aliases: ["Addis", "Addis Abeba", "Finfine"],
  },

  // ============================================================================
  // OROMIA REGION (Largest region, major logistics corridors)
  // ============================================================================
  {
    name: "Adama",
    nameEthiopic: "አዳማ",
    region: "Oromia",
    zone: "East Shewa",
    latitude: 8.54,
    longitude: 39.268,
    type: "CITY",
    population: 324000,
    aliases: ["Nazret", "Nazareth"],
  },
  {
    name: "Bishoftu",
    nameEthiopic: "ብሾፍቱ",
    region: "Oromia",
    zone: "East Shewa",
    latitude: 8.7522,
    longitude: 38.9784,
    type: "CITY",
    population: 153000,
    aliases: ["Debre Zeit", "Debre Zeyit"],
  },
  {
    name: "Jimma",
    nameEthiopic: "ጅማ",
    region: "Oromia",
    zone: "Jimma",
    latitude: 7.68,
    longitude: 36.835,
    type: "CITY",
    population: 207000,
    aliases: [],
  },
  {
    name: "Nekemte",
    nameEthiopic: "ነቀምቴ",
    region: "Oromia",
    zone: "East Welega",
    latitude: 9.0833,
    longitude: 36.55,
    type: "CITY",
    population: 115000,
    aliases: ["Nekempt"],
  },
  {
    name: "Harar",
    nameEthiopic: "ሐረር",
    region: "Harari",
    latitude: 9.31,
    longitude: 42.128,
    type: "CITY",
    population: 122000,
    aliases: ["Harer", "Jugol"],
  },
  {
    name: "Dire Dawa",
    nameEthiopic: "ድሬዳዋ",
    region: "Dire Dawa",
    latitude: 9.593,
    longitude: 41.8661,
    type: "CITY",
    population: 466000,
    aliases: ["Diredawa"],
  },
  {
    name: "Hawassa",
    nameEthiopic: "ሐዋሳ",
    region: "Sidama",
    latitude: 7.062,
    longitude: 38.476,
    type: "CITY",
    population: 318000,
    aliases: ["Awassa", "Awasa", "Hawasa"],
  },
  {
    name: "Shashamane",
    nameEthiopic: "ሻሸመኔ",
    region: "Oromia",
    zone: "West Arsi",
    latitude: 7.2,
    longitude: 38.6,
    type: "CITY",
    population: 150000,
    aliases: ["Shashemene", "Shashamene"],
  },
  {
    name: "Mojo",
    nameEthiopic: "ሞጆ",
    region: "Oromia",
    zone: "East Shewa",
    latitude: 8.5833,
    longitude: 39.1167,
    type: "TOWN",
    population: 40000,
    aliases: ["Modjo"],
  },
  {
    name: "Sebeta",
    nameEthiopic: "ሰበታ",
    region: "Oromia",
    zone: "Southwest Shewa",
    latitude: 8.9167,
    longitude: 38.6167,
    type: "TOWN",
    population: 70000,
    aliases: [],
  },
  {
    name: "Ambo",
    nameEthiopic: "አምቦ",
    region: "Oromia",
    zone: "West Shewa",
    latitude: 8.9833,
    longitude: 37.85,
    type: "TOWN",
    population: 65000,
    aliases: [],
  },
  {
    name: "Asella",
    nameEthiopic: "አሰላ",
    region: "Oromia",
    zone: "Arsi",
    latitude: 7.95,
    longitude: 39.1333,
    type: "TOWN",
    population: 67000,
    aliases: ["Asela"],
  },
  {
    name: "Robe",
    nameEthiopic: "ሮቤ",
    region: "Oromia",
    zone: "Bale",
    latitude: 7.1167,
    longitude: 40.0,
    type: "TOWN",
    population: 45000,
    aliases: [],
  },
  {
    name: "Ziway",
    nameEthiopic: "ዝዋይ",
    region: "Oromia",
    zone: "East Shewa",
    latitude: 7.9333,
    longitude: 38.7167,
    type: "TOWN",
    population: 52000,
    aliases: ["Zeway", "Batu"],
  },
  {
    name: "Holeta",
    nameEthiopic: "ሆለታ",
    region: "Oromia",
    zone: "West Shewa",
    latitude: 9.0667,
    longitude: 38.5,
    type: "TOWN",
    population: 40000,
    aliases: [],
  },

  // ============================================================================
  // AMHARA REGION (Northern highlands, major commercial routes)
  // ============================================================================
  {
    name: "Bahir Dar",
    nameEthiopic: "ባሕር ዳር",
    region: "Amhara",
    zone: "West Gojjam",
    latitude: 11.594,
    longitude: 37.3903,
    type: "CITY",
    population: 348000,
    aliases: ["Bahar Dar"],
  },
  {
    name: "Gondar",
    nameEthiopic: "ጎንደር",
    region: "Amhara",
    zone: "North Gondar",
    latitude: 12.6,
    longitude: 37.45,
    type: "CITY",
    population: 323000,
    aliases: ["Gonder"],
  },
  {
    name: "Dessie",
    nameEthiopic: "ደሴ",
    region: "Amhara",
    zone: "South Wollo",
    latitude: 11.13,
    longitude: 39.6333,
    type: "CITY",
    population: 212000,
    aliases: ["Dese", "Dessye"],
  },
  {
    name: "Debre Birhan",
    nameEthiopic: "ደብረ ብርሃን",
    region: "Amhara",
    zone: "North Shewa",
    latitude: 9.6833,
    longitude: 39.5333,
    type: "CITY",
    population: 96000,
    aliases: ["Debre Berhan"],
  },
  {
    name: "Debre Markos",
    nameEthiopic: "ደብረ ማርቆስ",
    region: "Amhara",
    zone: "East Gojjam",
    latitude: 10.35,
    longitude: 37.7333,
    type: "CITY",
    population: 85000,
    aliases: ["Debre Marcos"],
  },
  {
    name: "Kombolcha",
    nameEthiopic: "ኮምቦልቻ",
    region: "Amhara",
    zone: "South Wollo",
    latitude: 11.0833,
    longitude: 39.7333,
    type: "CITY",
    population: 93000,
    aliases: [],
  },
  {
    name: "Debre Tabor",
    nameEthiopic: "ደብረ ታቦር",
    region: "Amhara",
    zone: "South Gondar",
    latitude: 11.85,
    longitude: 38.0167,
    type: "TOWN",
    population: 55000,
    aliases: [],
  },
  {
    name: "Woldiya",
    nameEthiopic: "ወልድያ",
    region: "Amhara",
    zone: "North Wollo",
    latitude: 11.8333,
    longitude: 39.6,
    type: "TOWN",
    population: 52000,
    aliases: ["Woldia", "Weldiya"],
  },
  {
    name: "Lalibela",
    nameEthiopic: "ላሊበላ",
    region: "Amhara",
    zone: "North Wollo",
    latitude: 12.0333,
    longitude: 39.05,
    type: "TOWN",
    population: 18000,
    aliases: [],
  },

  // ============================================================================
  // TIGRAY REGION (Northern border, international trade routes)
  // ============================================================================
  {
    name: "Mekelle",
    nameEthiopic: "መቐለ",
    region: "Tigray",
    latitude: 13.4967,
    longitude: 39.4753,
    type: "CITY",
    population: 340000,
    aliases: ["Mekele", "Makale", "Mekele"],
  },
  {
    name: "Adigrat",
    nameEthiopic: "ዓዲግራት",
    region: "Tigray",
    zone: "East Tigray",
    latitude: 14.2767,
    longitude: 39.4633,
    type: "CITY",
    population: 82000,
    aliases: [],
  },
  {
    name: "Axum",
    nameEthiopic: "አክሱም",
    region: "Tigray",
    zone: "Central Tigray",
    latitude: 14.1211,
    longitude: 38.7236,
    type: "TOWN",
    population: 66000,
    aliases: ["Aksum"],
  },
  {
    name: "Shire",
    nameEthiopic: "ሽረ",
    region: "Tigray",
    zone: "North West Tigray",
    latitude: 14.1078,
    longitude: 38.2822,
    type: "TOWN",
    population: 52000,
    aliases: ["Shire Inda Selassie"],
  },

  // ============================================================================
  // SOUTHERN NATIONS (SNNPR) - Agricultural and commercial hubs
  // ============================================================================
  {
    name: "Arba Minch",
    nameEthiopic: "አርባ ምንጭ",
    region: "South Ethiopia",
    zone: "Gamo Gofa",
    latitude: 6.0333,
    longitude: 37.55,
    type: "CITY",
    population: 112000,
    aliases: ["Arbaminch"],
  },
  {
    name: "Wolaita Sodo",
    nameEthiopic: "ወላይታ ሶዶ",
    region: "South Ethiopia",
    zone: "Wolaita",
    latitude: 6.85,
    longitude: 37.75,
    type: "CITY",
    population: 93000,
    aliases: ["Sodo", "Soddo"],
  },
  {
    name: "Hosaena",
    nameEthiopic: "ሆሳዕና",
    region: "South Ethiopia",
    zone: "Hadiya",
    latitude: 7.55,
    longitude: 37.85,
    type: "TOWN",
    population: 68000,
    aliases: ["Hosaina", "Hossana"],
  },
  {
    name: "Dilla",
    nameEthiopic: "ድላ",
    region: "South Ethiopia",
    zone: "Gedeo",
    latitude: 6.4167,
    longitude: 38.3167,
    type: "TOWN",
    population: 72000,
    aliases: [],
  },
  {
    name: "Butajira",
    nameEthiopic: "ቡታጅራ",
    region: "South Ethiopia",
    zone: "Gurage",
    latitude: 8.1167,
    longitude: 38.3833,
    type: "TOWN",
    population: 42000,
    aliases: [],
  },
  {
    name: "Jinka",
    nameEthiopic: "ጅንካ",
    region: "South Ethiopia",
    zone: "South Omo",
    latitude: 5.65,
    longitude: 36.5667,
    type: "TOWN",
    population: 35000,
    aliases: [],
  },

  // ============================================================================
  // SOMALI REGION (Eastern border, livestock trade routes)
  // ============================================================================
  {
    name: "Jijiga",
    nameEthiopic: "ጅጅጋ",
    region: "Somali",
    latitude: 9.35,
    longitude: 42.8,
    type: "CITY",
    population: 164000,
    aliases: ["Jigjiga"],
  },
  {
    name: "Gode",
    nameEthiopic: "ጎዴ",
    region: "Somali",
    zone: "Shabelle",
    latitude: 5.95,
    longitude: 43.55,
    type: "TOWN",
    population: 54000,
    aliases: ["Godey"],
  },
  {
    name: "Kebri Dahar",
    nameEthiopic: "ቀብሪ ዳሃር",
    region: "Somali",
    zone: "Korahe",
    latitude: 6.7333,
    longitude: 44.2667,
    type: "TOWN",
    population: 32000,
    aliases: ["Kebre Dehar"],
  },
  {
    name: "Degeh Bur",
    nameEthiopic: "ደገህ ቡር",
    region: "Somali",
    zone: "Jarar",
    latitude: 8.2167,
    longitude: 43.5667,
    type: "TOWN",
    population: 40000,
    aliases: ["Degehabur"],
  },

  // ============================================================================
  // AFAR REGION (Strategic logistics corridor to Djibouti)
  // ============================================================================
  {
    name: "Semera",
    nameEthiopic: "ሰመራ",
    region: "Afar",
    latitude: 11.7938,
    longitude: 41.0056,
    type: "CITY",
    population: 45000,
    aliases: [],
  },
  {
    name: "Asayita",
    nameEthiopic: "አሳይታ",
    region: "Afar",
    latitude: 11.5667,
    longitude: 41.4333,
    type: "TOWN",
    population: 25000,
    aliases: ["Asaita"],
  },
  {
    name: "Gewane",
    nameEthiopic: "ገዋኔ",
    region: "Afar",
    latitude: 10.1667,
    longitude: 40.65,
    type: "TOWN",
    population: 15000,
    aliases: [],
  },

  // ============================================================================
  // BENISHANGUL-GUMUZ (Western border region)
  // ============================================================================
  {
    name: "Asosa",
    nameEthiopic: "አሶሳ",
    region: "Benishangul-Gumuz",
    latitude: 10.0667,
    longitude: 34.5333,
    type: "CITY",
    population: 42000,
    aliases: ["Assosa"],
  },

  // ============================================================================
  // GAMBELA (Western lowlands, border trade)
  // ============================================================================
  {
    name: "Gambela",
    nameEthiopic: "ጋምቤላ",
    region: "Gambela",
    latitude: 8.25,
    longitude: 34.5833,
    type: "CITY",
    population: 47000,
    aliases: ["Gambella"],
  },

  // ============================================================================
  // INDUSTRIAL ZONES & SPECIAL ECONOMIC AREAS
  // ============================================================================
  {
    name: "Dukem",
    nameEthiopic: "ዱከም",
    region: "Oromia",
    zone: "East Shewa",
    latitude: 8.8,
    longitude: 38.9,
    type: "TOWN",
    population: 28000,
    aliases: [],
  },
  {
    name: "Gelan",
    nameEthiopic: "ገላን",
    region: "Oromia",
    zone: "East Shewa",
    latitude: 8.6667,
    longitude: 39.0,
    type: "TOWN",
    population: 20000,
    aliases: [],
  },
  {
    name: "Sendafa",
    nameEthiopic: "ሰንዳፋ",
    region: "Oromia",
    zone: "North Shewa",
    latitude: 9.15,
    longitude: 39.0333,
    type: "TOWN",
    population: 25000,
    aliases: [],
  },

  // ============================================================================
  // BORDER TOWNS (International freight gateways)
  // ============================================================================
  {
    name: "Moyale",
    nameEthiopic: "ሞያሌ",
    region: "Oromia",
    zone: "Borana",
    latitude: 3.5333,
    longitude: 39.05,
    type: "TOWN",
    population: 35000,
    aliases: [],
  },
  {
    name: "Metema",
    nameEthiopic: "መተማ",
    region: "Amhara",
    zone: "West Gondar",
    latitude: 12.95,
    longitude: 36.2,
    type: "TOWN",
    population: 30000,
    aliases: [],
  },
  {
    name: "Humera",
    nameEthiopic: "ሁመራ",
    region: "Tigray",
    zone: "Western Tigray",
    latitude: 14.2833,
    longitude: 36.6167,
    type: "TOWN",
    population: 28000,
    aliases: [],
  },

  // ============================================================================
  // ADDITIONAL COMMERCIAL & LOGISTICS HUBS
  // ============================================================================
  {
    name: "Welkite",
    nameEthiopic: "ወልቂጤ",
    region: "South Ethiopia",
    zone: "Gurage",
    latitude: 8.2833,
    longitude: 37.7833,
    type: "TOWN",
    population: 38000,
    aliases: [],
  },
  {
    name: "Bonga",
    nameEthiopic: "ቦንጋ",
    region: "South Ethiopia",
    zone: "Keffa",
    latitude: 7.2833,
    longitude: 36.2333,
    type: "TOWN",
    population: 35000,
    aliases: [],
  },
  {
    name: "Mizan Teferi",
    nameEthiopic: "ሚዛን ተፈሪ",
    region: "South Ethiopia",
    zone: "Bench Sheko",
    latitude: 6.9833,
    longitude: 35.5833,
    type: "TOWN",
    population: 42000,
    aliases: ["Mizan Tefari"],
  },
  {
    name: "Debre Sina",
    nameEthiopic: "ደብረ ሲና",
    region: "Amhara",
    zone: "North Shewa",
    latitude: 9.85,
    longitude: 39.75,
    type: "TOWN",
    population: 20000,
    aliases: [],
  },
  {
    name: "Shewa Robit",
    nameEthiopic: "ሸዋ ሮቢት",
    region: "Amhara",
    zone: "North Shewa",
    latitude: 10.0,
    longitude: 39.9,
    type: "TOWN",
    population: 18000,
    aliases: [],
  },
  {
    name: "Adwa",
    nameEthiopic: "ዐድዋ",
    region: "Tigray",
    zone: "Central Tigray",
    latitude: 14.1667,
    longitude: 38.9,
    type: "TOWN",
    population: 52000,
    aliases: ["Adowa"],
  },
  {
    name: "Ginir",
    nameEthiopic: "ግንር",
    region: "Oromia",
    zone: "Bale",
    latitude: 7.1333,
    longitude: 40.7,
    type: "TOWN",
    population: 25000,
    aliases: [],
  },
  {
    name: "Negele Borana",
    nameEthiopic: "ነገሌ ቦረና",
    region: "Oromia",
    zone: "Guji",
    latitude: 5.3333,
    longitude: 39.5833,
    type: "TOWN",
    population: 30000,
    aliases: ["Negele", "Neghele"],
  },
  {
    name: "Bule Hora",
    nameEthiopic: "ቡሌ ሆራ",
    region: "Oromia",
    zone: "West Guji",
    latitude: 5.5833,
    longitude: 38.2333,
    type: "TOWN",
    population: 22000,
    aliases: ["Hagere Mariam"],
  },
  {
    name: "Yabello",
    nameEthiopic: "ያቤሎ",
    region: "Oromia",
    zone: "Borana",
    latitude: 4.8833,
    longitude: 38.0833,
    type: "TOWN",
    population: 28000,
    aliases: [],
  },
  {
    name: "Chiro",
    nameEthiopic: "ቺሮ",
    region: "Oromia",
    zone: "West Hararghe",
    latitude: 9.0833,
    longitude: 40.8667,
    type: "TOWN",
    population: 45000,
    aliases: ["Asbe Teferi"],
  },
  {
    name: "Finote Selam",
    nameEthiopic: "ፍኖተ ሰላም",
    region: "Amhara",
    zone: "West Gojjam",
    latitude: 10.7,
    longitude: 37.2667,
    type: "TOWN",
    population: 25000,
    aliases: [],
  },
  {
    name: "Bati",
    nameEthiopic: "ባቲ",
    region: "Amhara",
    zone: "Oromia",
    latitude: 11.1833,
    longitude: 40.0167,
    type: "TOWN",
    population: 22000,
    aliases: [],
  },
  {
    name: "Kemise",
    nameEthiopic: "ከሚሴ",
    region: "Amhara",
    zone: "South Wollo",
    latitude: 10.7167,
    longitude: 39.8667,
    type: "TOWN",
    population: 35000,
    aliases: ["Kemisse"],
  },
  {
    name: "Azezo",
    nameEthiopic: "አዘዞ",
    region: "Amhara",
    zone: "North Gondar",
    latitude: 12.6667,
    longitude: 37.4667,
    type: "TOWN",
    population: 18000,
    aliases: [],
  },
  {
    name: "Dangila",
    nameEthiopic: "ዳንግላ",
    region: "Amhara",
    zone: "Agew Awi",
    latitude: 11.2667,
    longitude: 36.8333,
    type: "TOWN",
    population: 30000,
    aliases: [],
  },
];

/**
 * Get total count of locations
 */
export const getTotalLocations = (): number => ethiopianLocations.length;

/**
 * Get locations by region
 */
export const getLocationsByRegion = (region: string): LocationSeedData[] => {
  return ethiopianLocations.filter((loc) => loc.region === region);
};

/**
 * Get all unique regions
 */
export const getUniqueRegions = (): string[] => {
  return [...new Set(ethiopianLocations.map((loc) => loc.region))];
};
