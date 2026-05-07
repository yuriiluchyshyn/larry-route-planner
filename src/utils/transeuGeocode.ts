/**
 * Trans.eu Geocoder API client
 */

export interface TranseuLocation {
  geocoderId: string;
  country: string;
  type: 'country' | 'combined_postal_area' | 'postal_area' | 'locality_postal_area' | 'locality';
  countryName: string | null;
  admin1: string | null;
  locality: string | null;
  district: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  latitude: number;
  longitude: number;
  bbox: [[number, number], [number, number]];
  radius: number;
  timezone: string | null;
}

export interface TranseuGeocodeResponse {
  page_count: number;
  total_items: number;
  page: number;
  page_size: number;
  _embedded: {
    locations: TranseuLocation[];
  };
}

/**
 * Search locations using Trans.eu geocoder API
 */
export async function searchTranseuLocations(
  query: string,
  bearerToken: string,
  options: {
    types?: string[];
    limit?: number;
    offset?: number;
    lang?: string;
  } = {}
): Promise<TranseuLocation[]> {
  const {
    types = ['combined_postal_area', 'postal_area', 'locality_postal_area', 'country', 'locality'],
    limit = 10,
    offset = 0,
    lang = 'ua'
  } = options;

  const filter = JSON.stringify({ type: types });
  const params = new URLSearchParams({
    search: query,
    lang,
    filter,
    offset: offset.toString(),
    limit: limit.toString()
  });

  const url = `/api/geocoder/app/geocoder-api/api/v2/locations?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      mode: 'cors',
    });

    if (!response.ok) {
      console.warn(`Trans.eu geocoder API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: TranseuGeocodeResponse = await response.json();
    return data._embedded?.locations || [];
  } catch (error) {
    console.warn('Trans.eu geocoder API request failed:', error);
    return [];
  }
}

/**
 * Geocode a city name to get coordinates using Trans.eu API
 * Use postal code if provided to get exact coordinates matching website behavior
 */
export async function geocodeCity(
  cityName: string,
  countryCode: string,
  bearerToken: string,
  postalCode?: string
): Promise<{ latitude: number; longitude: number; postalCode?: string } | null> {
  // Build search query - include postal code if provided (matches website behavior)
  const query = postalCode ? `${postalCode} ${cityName}` : cityName;
  console.log(`🌍 Larry: Geocoder query: "${query}"`);
  
  const locations = await searchTranseuLocations(query, bearerToken, {
    types: ['locality_postal_area', 'locality', 'combined_postal_area', 'postal_area'],
    limit: 20
  });

  console.log(`🌍 Larry: Geocoder returned ${locations.length} locations`);

  // Priority 1: Exact locality + postal code match (most precise)
  if (postalCode) {
    const postalMatch = locations.find(loc => 
      loc.locality?.toLowerCase() === cityName.toLowerCase() && 
      loc.country === countryCode &&
      loc.postalCode === postalCode
    );
    if (postalMatch) {
      console.log(`🌍 Larry: Found exact postal+locality match: ${postalMatch.type}`);
      return {
        latitude: postalMatch.latitude,
        longitude: postalMatch.longitude,
        postalCode: postalMatch.postalCode || undefined
      };
    }
  }

  // Priority 2: locality_postal_area with matching city in correct country
  const localityPostalMatch = locations.find(loc => 
    loc.type === 'locality_postal_area' &&
    loc.locality?.toLowerCase() === cityName.toLowerCase() && 
    loc.country === countryCode
  );
  if (localityPostalMatch) {
    console.log(`🌍 Larry: Found locality_postal_area match`);
    return {
      latitude: localityPostalMatch.latitude,
      longitude: localityPostalMatch.longitude,
      postalCode: localityPostalMatch.postalCode || undefined
    };
  }

  // Priority 3: Exact locality match in correct country
  const exactMatch = locations.find(loc => 
    loc.locality?.toLowerCase() === cityName.toLowerCase() && 
    loc.country === countryCode
  );
  if (exactMatch) {
    console.log(`🌍 Larry: Found exact locality match: ${exactMatch.type}`);
    return {
      latitude: exactMatch.latitude,
      longitude: exactMatch.longitude,
      postalCode: exactMatch.postalCode || undefined
    };
  }

  // Priority 4: Partial match in same country
  const countryMatch = locations.find(loc => 
    loc.country === countryCode && 
    (loc.locality?.toLowerCase().includes(cityName.toLowerCase()) ||
     cityName.toLowerCase().includes(loc.locality?.toLowerCase() || ''))
  );
  if (countryMatch) {
    console.log(`🌍 Larry: Found partial country match: ${countryMatch.type}`);
    return {
      latitude: countryMatch.latitude,
      longitude: countryMatch.longitude,
      postalCode: countryMatch.postalCode || undefined
    };
  }

  console.log(`🌍 Larry: No match found for ${cityName} in ${countryCode}`);
  return null;
}

/**
 * Get country coordinates using Trans.eu API
 */
export async function getCountryCoordinates(
  countryCode: string,
  bearerToken: string
): Promise<{ latitude: number; longitude: number } | null> {
  const locations = await searchTranseuLocations(countryCode, bearerToken, {
    types: ['country'],
    limit: 1
  });

  const country = locations.find(loc => loc.country === countryCode && loc.type === 'country');
  if (country) {
    return {
      latitude: country.latitude,
      longitude: country.longitude
    };
  }

  return null;
}