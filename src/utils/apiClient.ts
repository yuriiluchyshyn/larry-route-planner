import type { ApiResponse, FreightOffer, RouteConfig, WayPoint } from '../types';
import countryCodesData from '../data/countryCodes.json';
import { geocodeCity } from './transeuGeocode';

/**
 * Ensure waypoint has coordinates - ALWAYS fetch from Trans.eu geocoder API
 * to get accurate coordinates matching what the website uses
 */
async function ensureCoordinates(waypoint: WayPoint, bearerToken: string): Promise<WayPoint> {
  // If no city name, can't geocode (country-level search)
  if (!waypoint.locality || isCountryName(waypoint.locality)) {
    return waypoint;
  }

  // ALWAYS fetch from API to get accurate coordinates
  const countryCode = extractCountryCode(waypoint.country);
  console.log(`🌍 Larry: Fetching coordinates from Trans.eu API for ${waypoint.locality} in ${waypoint.country}...`);
  
  try {
    const result = await geocodeCity(waypoint.locality, countryCode, bearerToken, waypoint.postalCode);
    
    if (result) {
      console.log(`🌍 Larry: ✅ Got coordinates from API for ${waypoint.locality}: ${result.latitude}, ${result.longitude}`);
      return {
        ...waypoint,
        latitude: result.latitude,
        longitude: result.longitude,
        postalCode: result.postalCode || waypoint.postalCode
      };
    } else {
      console.warn(`🌍 Larry: ❌ Could not geocode ${waypoint.locality} via API, using existing coords`);
      return waypoint;
    }
  } catch (error) {
    console.warn(`🌍 Larry: Geocoding failed for ${waypoint.locality}:`, error);
    return waypoint;
  }
}

/**
 * Extract country code from Trans.eu format (e.g., "47_poland" -> "PL")
 */
function extractCountryCode(transeuCountry: string): string {
  // Map Trans.eu country codes back to ISO codes for geocoding
  const reverseMap: Record<string, string> = {
    '47_poland': 'PL',
    '21_germany': 'DE', 
    '19_france': 'FR',
    '16_czech_republic': 'CZ',
    '5_austria': 'AT',
    '56_slovakia': 'SK',
    '43_netherlands': 'NL',
    '7_belgium': 'BE',
    '28_italy': 'IT',
    '58_spain': 'ES',
    '26_hungary': 'HU',
    '50_romania': 'RO',
    '10_bulgaria': 'BG',
    '25_croatia': 'HR',
    '57_slovenia': 'SI',
    '35_lithuania': 'LT',
    '34_latvia': 'LV',
    '18_estonia': 'EE'
  };
  
  return reverseMap[transeuCountry] || transeuCountry.split('_')[1]?.toUpperCase()?.slice(0, 2) || 'PL';
}

/**
 * Clean bearer token to ensure it contains only ISO-8859-1 compatible characters
 */
function cleanBearerToken(token: string): string {
  // Remove any non-ASCII characters that might cause fetch header issues
  return token.replace(/[^\x00-\xFF]/g, '').trim();
}

/**
 * Fix known incorrect country codes using centralized mapping
 */
function fixCountryCode(code: string): string {
  return (countryCodesData.fixes as Record<string, string>)[code] || code;
}

/**
 * Build filter with multiple loading/unloading points in a single request
 * This matches how Trans.eu platform sends requests
 */
function buildFilterParamMulti(
  config: RouteConfig,
  loadingPoints: WayPoint[],
  unloadingPoints: WayPoint[]
): string {
  // Build loading places array
  const loadingPlaces = loadingPoints.map(lp => {
    const country = fixCountryCode(lp.country);
    const address: Record<string, unknown> = {
      country: [country],
    };
    if (lp.locality && !isCountryName(lp.locality)) {
      address.locality = lp.locality;
    }
    if (lp.postalCode && lp.postalCode.trim()) {
      address.postal_code = lp.postalCode;
    }

    const place: Record<string, unknown> = { address };
    
    // If only country (no city), mark as country-level search
    if (!lp.locality || isCountryName(lp.locality)) {
      place.isCountry = true;
    } else {
      // Include coordinates for city-level searches (non-zero)
      if (lp.latitude !== 0 && lp.longitude !== 0) {
        place.coordinates = {
          latitude: lp.latitude,
          longitude: lp.longitude,
          range: lp.range,
        };
      }
    }
    return place;
  });

  // Build unloading places array
  const unloadingPlaces = unloadingPoints.map(up => {
    const country = fixCountryCode(up.country);
    const address: Record<string, unknown> = {
      country: [country],
    };
    if (up.locality && !isCountryName(up.locality)) {
      address.locality = up.locality;
    }
    if (up.postalCode && up.postalCode.trim()) {
      address.postal_code = up.postalCode;
    }

    const place: Record<string, unknown> = { address };
    
    // If only country (no city), mark as country-level search
    if (!up.locality || isCountryName(up.locality)) {
      place.isCountry = true;
    } else {
      // Include coordinates for city-level searches (non-zero)
      if (up.latitude !== 0 && up.longitude !== 0) {
        place.coordinates = {
          latitude: up.latitude,
          longitude: up.longitude,
          range: up.range,
        };
      }
    }
    return place;
  });

  const filter: Record<string, unknown> = {
    loading_place: loadingPlaces,
    unloading_place: unloadingPlaces,
    places_matching_type: "cross",
    exclude_suspended: true,
  };

  // Add weight filter only if values are provided
  const weightFilter: Record<string, unknown> = {};
  if (config.minWeight !== undefined && config.minWeight > 0) {
    weightFilter.from = config.minWeight;
  }
  if (config.maxWeight !== undefined && config.maxWeight > 0) {
    weightFilter.to = config.maxWeight;
  }
  if (Object.keys(weightFilter).length > 0) {
    filter.load_weight = weightFilter;
  }

  // Add capacity filter only if values are provided
  const capacityFilter: Record<string, unknown> = {};
  if (config.minCapacity !== undefined && config.minCapacity > 0) {
    capacityFilter.from = config.minCapacity;
  }
  if (config.maxCapacity !== undefined && config.maxCapacity > 0) {
    capacityFilter.to = config.maxCapacity;
  }
  if (Object.keys(capacityFilter).length > 0) {
    filter.cargo_capacity = capacityFilter;
  }

  return JSON.stringify(filter);
}

/**
 * Check if a string is a country name rather than a city name
 */
function isCountryName(name: string): boolean {
  const countryNames = [
    'Німеччина', 'Польща', 'Франція', 'Чехія', 'Австрія', 'Словаччина',
    'Угорщина', 'Італія', 'Іспанія', 'Нідерланди', 'Бельгія', 'Литва',
    'Латвія', 'Естонія', 'Румунія', 'Болгарія', 'Хорватія', 'Словенія',
    'Сербія', 'Боснія', 'Македонія', 'Албанія', 'Чорногорія',
    // English names
    'Germany', 'Poland', 'France', 'Czech Republic', 'Austria', 'Slovakia',
    'Hungary', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Lithuania',
    'Latvia', 'Estonia', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia',
    'Serbia', 'Bosnia', 'Macedonia', 'Albania', 'Montenegro',
    // German names
    'Deutschland', 'Polen', 'Frankreich', 'Tschechien', 'Österreich',
    'Slowakei', 'Ungarn', 'Italien', 'Spanien', 'Niederlande', 'Belgien',
  ];
  return countryNames.includes(name);
}

/**
 * Fetch freight offers for all combinations of loading and unloading points.
 * Sends all loading/unloading points in a single request (matching Trans.eu behavior).
 * If includeReturnRoute is enabled, also fetches reverse directions.
 */
export async function fetchFreightOffers(
  config: RouteConfig
): Promise<ApiResponse & { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] }> {
  // Check if bearer token is provided
  if (!config.bearerToken || config.bearerToken.trim() === '') {
    throw new Error('Bearer token is required. Please add your API token from platform.trans.eu');
  }

  // Validate bearer token contains only ISO-8859-1 compatible characters
  const hasInvalidChars = /[^\x00-\xFF]/.test(config.bearerToken);
  if (hasInvalidChars) {
    throw new Error('Bearer token contains invalid characters. Please ensure your token contains only standard ASCII characters.');
  }

  // Deduplicate waypoints by country+locality+postalCode
  const dedupeWaypoints = (points: WayPoint[]) => {
    const seen = new Set<string>();
    return points.filter(p => {
      const key = `${p.country || ''}|${p.locality || ''}|${p.postalCode || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const dedupedLoadingPoints = dedupeWaypoints(config.loadingPoints);
  const dedupedUnloadingPoints = dedupeWaypoints(config.unloadingPoints);
  
  if (dedupedLoadingPoints.length !== config.loadingPoints.length) {
    console.log(`🧹 Larry: Deduplicated loading points: ${config.loadingPoints.length} → ${dedupedLoadingPoints.length}`);
  }
  if (dedupedUnloadingPoints.length !== config.unloadingPoints.length) {
    console.log(`🧹 Larry: Deduplicated unloading points: ${config.unloadingPoints.length} → ${dedupedUnloadingPoints.length}`);
  }

  // Geocode waypoints to ensure coordinates are available
  console.log(`🌍 Larry: Ensuring coordinates for all waypoints...`);
  const geocodedLoadingPoints = await Promise.all(
    dedupedLoadingPoints.map(point => ensureCoordinates(point, config.bearerToken))
  );
  const geocodedUnloadingPoints = await Promise.all(
    dedupedUnloadingPoints.map(point => ensureCoordinates(point, config.bearerToken))
  );

  const allOffers: FreightOffer[] = [];
  const seenIds = new Set<string>();

  // Strategy: Send all loading + unloading points in ONE request (like Trans.eu does)
  console.log(`🚛 Larry: Fetching offers with all points combined (${geocodedLoadingPoints.length} loading, ${geocodedUnloadingPoints.length} unloading)...`);

  // Main request: all loading points → all unloading points (matches Trans.eu exactly)
  const mainOffers = await fetchPairMulti(config, geocodedLoadingPoints, geocodedUnloadingPoints);
  for (const offer of mainOffers) {
    if (!seenIds.has(offer.id)) {
      seenIds.add(offer.id);
      allOffers.push(offer);
    }
  }
  console.log(`🚛 Larry: Main direction: ${mainOffers.length} unique offers`);

  // If return route enabled, fetch reverse direction as a SEPARATE request
  let returnOffers: FreightOffer[] = [];
  if (config.includeReturnRoute) {
    console.log(`🚛 Larry: Fetching return route (reverse direction)...`);
    returnOffers = await fetchPairMulti(config, geocodedUnloadingPoints, geocodedLoadingPoints);
    let returnCount = 0;
    for (const offer of returnOffers) {
      if (!seenIds.has(offer.id)) {
        seenIds.add(offer.id);
        allOffers.push(offer);
        returnCount++;
      }
    }
    console.log(`🚛 Larry: Return direction: ${returnOffers.length} offers (${returnCount} new unique)`);
  }

  console.log(`🚛 Larry: ✅ Finished! Found ${allOffers.length} unique offers total`);

  return {
    _embedded: { 'freight-offers': allOffers },
    total: allOffers.length,
    mainOffers,
    returnOffers,
  };
}

/**
 * Fetch with multiple loading/unloading points in a single filter (matching Trans.eu behavior)
 */
async function fetchPairMulti(
  config: RouteConfig,
  loadingPoints: WayPoint[],
  unloadingPoints: WayPoint[]
): Promise<FreightOffer[]> {
  const filter = buildFilterParamMulti(config, loadingPoints, unloadingPoints);
  const sort = JSON.stringify({ field: 'index', order: 'desc' });
  const counters = JSON.stringify(['all']);

  const allOffers: FreightOffer[] = [];
  const seenIds = new Set<string>();
  let searchAfterValue: string | null = null;
  let hasMore = true;
  let pageCount = 0;
  let expectedTotal = 0;
  let emptyPageRetries = 0;
  const MAX_PAGES = 100; // Safety limit: max 100 pages

  const cleanToken = cleanBearerToken(config.bearerToken);
  const routeLabel = `${loadingPoints.map(p => p.locality || p.country).join('+')} → ${unloadingPoints.map(p => p.locality || p.country).join('+')}`;

  while (hasMore && pageCount < MAX_PAGES) {
    const params = new URLSearchParams({ 
      filter, 
      sort, 
      counters
    });

    // Trans.eu pagination uses search_after with the id of the last item
    if (searchAfterValue) {
      // Trans.eu format: pagination={"search_after":{"id":"<last_offer_id>"}}
      const pagination = JSON.stringify({ search_after: { id: searchAfterValue } });
      params.set('pagination', pagination);
    }

    const url = `${config.apiUrl}?${params.toString()}`;

    console.log(`🚛 Larry: Fetching page ${pageCount + 1} for ${routeLabel} (have ${allOffers.length} offers so far${searchAfterValue ? ', cursor: ' + searchAfterValue : ''})`);
    if (searchAfterValue) {
      console.log(`🚛 Larry: Pagination URL: ${url}`);
      console.log(`🚛 Larry: Using cursor type: index, value: ${searchAfterValue}`);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      mode: 'cors',
      cache: 'no-store',
    });

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      if (response.status === 401) {
        errorMessage += ` - Invalid or expired bearer token`;
      } else if (response.status === 403) {
        errorMessage += ` - Access forbidden`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const offers: FreightOffer[] = data._embedded?.['freight-offers'] || [];
    
    // On first page, log response structure and capture total count
    if (pageCount === 0) {
      // Log response keys to understand API structure
      const responseKeys = Object.keys(data);
      console.log(`🚛 Larry: Response keys: ${responseKeys.join(', ')}`);
      
      if (data._embedded?.['freight-offers']?.length > 0) {
        const sampleOffer = data._embedded['freight-offers'][0];
        const offerKeys = Object.keys(sampleOffer);
        console.log(`🚛 Larry: Offer keys: ${offerKeys.join(', ')}`);
        console.log(`🚛 Larry: Sample offer.id = "${sampleOffer.id}" (type: ${typeof sampleOffer.id})`);
        // Log ALL fields that could be pagination cursors
        for (const key of offerKeys) {
          const val = sampleOffer[key];
          if (typeof val === 'string' || typeof val === 'number') {
            console.log(`🚛 Larry: offer.${key} = "${val}"`);
          }
        }
      }
      
      // Also log last offer on first page
      if (offers.length > 0) {
        const lastOfferFirstPage = offers[offers.length - 1];
        console.log(`🚛 Larry: LAST offer on page 1: id="${lastOfferFirstPage.id}", all string fields:`);
        for (const key of Object.keys(lastOfferFirstPage)) {
          const val = (lastOfferFirstPage as any)[key];
          if (typeof val === 'string' || typeof val === 'number') {
            console.log(`🚛 Larry:   .${key} = "${val}"`);
          }
        }
      }
      
      // Try different locations for total count
      expectedTotal = data.total || data._meta?.total || 0;
      
      // Check counters
      if (data.counters) {
        console.log(`🚛 Larry: Counters: ${JSON.stringify(data.counters)}`);
        if (data.counters.all && !expectedTotal) {
          expectedTotal = data.counters.all;
        }
      }
      
      if (expectedTotal > 0) {
        console.log(`🚛 Larry: API reports total of ${expectedTotal} offers available`);
      }
    }

    console.log(`🚛 Larry: Page ${pageCount + 1} returned ${offers.length} offers`);
    
    if (offers.length === 0) {
      // Retry once if we haven't reached expected total (API might have a gap)
      if (expectedTotal > 0 && allOffers.length < expectedTotal && emptyPageRetries < 2) {
        emptyPageRetries++;
        console.log(`🚛 Larry: Empty page but expected ${expectedTotal} (have ${allOffers.length}), retry ${emptyPageRetries}/2`);
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      hasMore = false;
      break;
    }
    
    emptyPageRetries = 0;

    let newOffersCount = 0;
    for (const offer of offers) {
      if (!seenIds.has(offer.id)) {
        seenIds.add(offer.id);
        allOffers.push(offer);
        newOffersCount++;
      }
    }

    // Only stop on duplicates if we got a FULL page of duplicates AND we have enough offers
    if (newOffersCount === 0 && offers.length > 0) {
      // If we haven't reached expected total, don't stop - try next page
      if (expectedTotal > 0 && allOffers.length < expectedTotal) {
        console.log(`🚛 Larry: Page ${pageCount + 1} all duplicates but haven't reached total (${allOffers.length}/${expectedTotal}), continuing...`);
        pageCount++;
        // Still need cursor from last offer
        const lastOffer = offers[offers.length - 1];
        if (lastOffer && lastOffer.id) {
          searchAfterValue = lastOffer.id;
        } else {
          hasMore = false;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      console.log(`🚛 Larry: All offers on page ${pageCount + 1} are duplicates, stopping`);
      hasMore = false;
      break;
    }

    pageCount++;

    // Get the cursor for the next page
    // IMPORTANT: sort is by "index" field, so search_after value must be from index field
    // (even though JSON key is "id" in the pagination param - that's how Trans.eu API expects it)
    const lastOffer = offers[offers.length - 1];
    
    // Log what we have for pagination on every page
    console.log(`🚛 Larry: Last offer on page ${pageCount}: id="${lastOffer.id}", index="${lastOffer.index}"`);
    
    if (lastOffer && lastOffer.index) {
      searchAfterValue = lastOffer.index;
    } else if (lastOffer && lastOffer.id) {
      // Fallback to id if no index
      searchAfterValue = lastOffer.id;
    } else {
      console.log(`🚛 Larry: Cannot determine next page cursor, stopping`);
      hasMore = false;
      break;
    }

    // Check if we've fetched all expected offers
    if (expectedTotal > 0 && allOffers.length >= expectedTotal) {
      console.log(`🚛 Larry: Reached expected total (${expectedTotal}), stopping`);
      hasMore = false;
      break;
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (pageCount >= MAX_PAGES) {
    console.warn(`🚛 Larry: Reached max page limit (${MAX_PAGES}) for ${routeLabel}`);
  }

  console.log(`🚛 Larry: ✅ Total ${allOffers.length} offers for ${routeLabel} (${pageCount} pages, expected: ${expectedTotal})`);
  return allOffers;
}
