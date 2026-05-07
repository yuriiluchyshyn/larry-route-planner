import type { ApiResponse, FreightOffer, RouteConfig, WayPoint } from '../types';

/**
 * Clean bearer token to ensure it contains only ISO-8859-1 compatible characters
 */
function cleanBearerToken(token: string): string {
  // Remove any non-ASCII characters that might cause fetch header issues
  return token.replace(/[^\x00-\xFF]/g, '').trim();
}

/**
 * Build the filter query parameter for a specific loading->unloading pair
 */
function buildFilterParam(
  config: RouteConfig,
  loadingPoint: WayPoint,
  unloadingPoint: WayPoint
): string {
  return buildFilterParamMulti(config, [loadingPoint], [unloadingPoint]);
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
    const address: Record<string, unknown> = {
      country: [lp.country],
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
    }
    
    // Only include coordinates if they are valid (non-zero)
    if (lp.latitude !== 0 && lp.longitude !== 0) {
      place.coordinates = {
        latitude: lp.latitude,
        longitude: lp.longitude,
        range: lp.range,
      };
    }
    return place;
  });

  // Build unloading places array
  const unloadingPlaces = unloadingPoints.map(up => {
    const address: Record<string, unknown> = {
      country: [up.country],
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
    }
    
    // Only include coordinates if they are valid (non-zero)
    if (up.latitude !== 0 && up.longitude !== 0) {
      place.coordinates = {
        latitude: up.latitude,
        longitude: up.longitude,
        range: up.range,
      };
    }
    return place;
  });

  const filter: Record<string, unknown> = {
    loading_place: loadingPlaces,
    unloading_place: unloadingPlaces,
    load_weight: { from: config.minWeight },
    cargo_capacity: { from: config.minCapacity },
    places_matching_type: "cross",
    exclude_suspended: true,
  };

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
 * Fetch freight offers for a single loading->unloading pair with pagination
 */
async function fetchPair(
  config: RouteConfig,
  loadingPoint: WayPoint,
  unloadingPoint: WayPoint
): Promise<FreightOffer[]> {
  const filter = buildFilterParam(config, loadingPoint, unloadingPoint);
  const sort = JSON.stringify({ field: 'index', order: 'desc' });
  const counters = JSON.stringify(['all']);

  const allOffers: FreightOffer[] = [];
  const seenIds = new Set<string>();
  let searchAfterId: string | null = null;
  let hasMore = true;
  let pageCount = 0;
  let expectedTotal = 0;
  const MAX_PAGES = 50; // Safety limit: max 50 pages (~1000 offers at 20/page)

  // Ensure bearer token contains only ISO-8859-1 compatible characters
  const cleanToken = cleanBearerToken(config.bearerToken);

  while (hasMore && pageCount < MAX_PAGES) {
    const params = new URLSearchParams({ 
      filter, 
      sort, 
      counters
    });

    // Add pagination parameter with search_after cursor
    // Trans.eu API uses the 'index' field value as cursor (same field used in sort)
    if (searchAfterId) {
      const pagination = JSON.stringify({ search_after: { id: searchAfterId } });
      params.set('pagination', pagination);
    }

    const url = `${config.apiUrl}?${params.toString()}`;

    console.log(`🚛 Larry: Fetching page ${pageCount + 1} for ${loadingPoint.locality} → ${unloadingPoint.locality} (have ${allOffers.length} offers so far)`);

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
      
      if (response.status === 404) {
        errorMessage += ` - The API endpoint might be incorrect or the route ${loadingPoint.locality} → ${unloadingPoint.locality} was not found`;
      } else if (response.status === 401) {
        errorMessage += ` - Invalid or expired bearer token. Please get a fresh token from platform.trans.eu`;
      } else if (response.status === 403) {
        errorMessage += ` - Access forbidden. Check your bearer token permissions`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const offers: FreightOffer[] = data._embedded?.['freight-offers'] || [];
    
    // On first page, capture the total count if available
    if (pageCount === 0 && data.total) {
      expectedTotal = data.total;
      console.log(`🚛 Larry: API reports total of ${expectedTotal} offers available`);
    }

    console.log(`🚛 Larry: Page ${pageCount + 1} returned ${offers.length} offers`);
    
    if (offers.length === 0) {
      // If we haven't reached expected total, try one more time with same cursor
      // (API might have a temporary gap)
      if (expectedTotal > 0 && allOffers.length < expectedTotal && emptyPageRetries < 2) {
        emptyPageRetries++;
        console.log(`🚛 Larry: Empty page but expected ${expectedTotal}, retry ${emptyPageRetries}/2`);
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }
      hasMore = false;
      break;
    }
    
    // Reset empty page retries on successful page
    emptyPageRetries = 0;

    // Add only new offers (deduplicate)
    let newOffersCount = 0;
    for (const offer of offers) {
      if (!seenIds.has(offer.id)) {
        seenIds.add(offer.id);
        allOffers.push(offer);
        newOffersCount++;
      }
    }

    // If all offers on this page were duplicates, stop
    if (newOffersCount === 0) {
      console.log(`🚛 Larry: All offers on page ${pageCount + 1} are duplicates, stopping`);
      hasMore = false;
      break;
    }

    pageCount++;

    // Get the ID of the last offer for the next page cursor
    // IMPORTANT: search_after must use the 'index' field (same field used in sort)
    const lastOffer = offers[offers.length - 1];
    if (lastOffer && (lastOffer as any).index) {
      searchAfterId = (lastOffer as any).index;
    } else if (lastOffer && lastOffer.id) {
      // Fallback to id if index not available
      searchAfterId = lastOffer.id;
    } else {
      hasMore = false;
      break;
    }

    // Check if we've fetched all expected offers
    if (expectedTotal > 0 && allOffers.length >= expectedTotal) {
      console.log(`🚛 Larry: Reached expected total (${expectedTotal}), stopping`);
      hasMore = false;
      break;
    }

    // Add a small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  if (pageCount >= MAX_PAGES) {
    console.warn(`🚛 Larry: Reached max page limit (${MAX_PAGES}) for ${loadingPoint.locality} → ${unloadingPoint.locality}`);
  }

  console.log(`🚛 Larry: ✅ Total ${allOffers.length} offers for ${loadingPoint.locality} → ${unloadingPoint.locality} (${pageCount} pages, expected: ${expectedTotal})`);
  return allOffers;
}

/**
 * Fetch freight offers for all combinations of loading and unloading points.
 * Sends all loading/unloading points in a single request (matching Trans.eu behavior).
 * If includeReturnRoute is enabled, also fetches reverse directions.
 */
export async function fetchFreightOffers(
  config: RouteConfig
): Promise<ApiResponse> {
  // Check if bearer token is provided
  if (!config.bearerToken || config.bearerToken.trim() === '') {
    throw new Error('Bearer token is required. Please add your API token from platform.trans.eu');
  }

  // Validate bearer token contains only ISO-8859-1 compatible characters
  const hasInvalidChars = /[^\x00-\xFF]/.test(config.bearerToken);
  if (hasInvalidChars) {
    throw new Error('Bearer token contains invalid characters. Please ensure your token contains only standard ASCII characters.');
  }

  const allOffers: FreightOffer[] = [];
  const seenIds = new Set<string>();

  // Strategy: Send all loading + unloading points in ONE request (like Trans.eu does)
  console.log(`🚛 Larry: Fetching offers with all points combined (${config.loadingPoints.length} loading, ${config.unloadingPoints.length} unloading)...`);

  // Main request: all loading points → all unloading points (matches Trans.eu exactly)
  const mainOffers = await fetchPairMulti(config, config.loadingPoints, config.unloadingPoints);
  for (const offer of mainOffers) {
    if (!seenIds.has(offer.id)) {
      seenIds.add(offer.id);
      allOffers.push(offer);
    }
  }
  console.log(`🚛 Larry: Main direction: ${allOffers.length} unique offers`);

  // If return route enabled, fetch reverse direction as a SEPARATE request
  if (config.includeReturnRoute) {
    console.log(`🚛 Larry: Fetching return route (reverse direction)...`);
    const returnOffers = await fetchPairMulti(config, config.unloadingPoints, config.loadingPoints);
    let returnCount = 0;
    for (const offer of returnOffers) {
      if (!seenIds.has(offer.id)) {
        seenIds.add(offer.id);
        allOffers.push(offer);
        returnCount++;
      }
    }
    console.log(`🚛 Larry: Return direction: ${returnCount} new unique offers`);
  }

  console.log(`🚛 Larry: ✅ Finished! Found ${allOffers.length} unique offers total`);

  return {
    _embedded: { 'freight-offers': allOffers },
    total: allOffers.length,
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
  let searchAfterId: string | null = null;
  let hasMore = true;
  let pageCount = 0;
  let expectedTotal = 0;
  const MAX_PAGES = 50;

  const cleanToken = cleanBearerToken(config.bearerToken);
  const routeLabel = `${loadingPoints.map(p => p.locality || p.country).join('+')} → ${unloadingPoints.map(p => p.locality || p.country).join('+')}`;
  let emptyPageRetries = 0;

  while (hasMore && pageCount < MAX_PAGES) {
    const params = new URLSearchParams({ 
      filter, 
      sort, 
      counters
    });

    if (searchAfterId) {
      const pagination = JSON.stringify({ search_after: { id: searchAfterId } });
      params.set('pagination', pagination);
    }

    const url = `${config.apiUrl}?${params.toString()}`;

    console.log(`🚛 Larry: Fetching page ${pageCount + 1} for ${routeLabel} (have ${allOffers.length} offers so far)`);

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
    
    if (pageCount === 0 && data.total) {
      expectedTotal = data.total;
      console.log(`🚛 Larry: API reports total of ${expectedTotal} offers available`);
    }

    console.log(`🚛 Larry: Page ${pageCount + 1} returned ${offers.length} offers`);
    
    if (offers.length === 0) {
      hasMore = false;
      break;
    }

    let newOffersCount = 0;
    for (const offer of offers) {
      if (!seenIds.has(offer.id)) {
        seenIds.add(offer.id);
        allOffers.push(offer);
        newOffersCount++;
      }
    }

    if (newOffersCount === 0) {
      console.log(`🚛 Larry: All offers on page ${pageCount + 1} are duplicates, stopping`);
      hasMore = false;
      break;
    }

    pageCount++;

    const lastOffer = offers[offers.length - 1];
    if (lastOffer && (lastOffer as any).index) {
      searchAfterId = (lastOffer as any).index;
    } else if (lastOffer && lastOffer.id) {
      searchAfterId = lastOffer.id;
    } else {
      hasMore = false;
      break;
    }

    if (expectedTotal > 0 && allOffers.length >= expectedTotal) {
      console.log(`🚛 Larry: Reached expected total (${expectedTotal}), stopping`);
      hasMore = false;
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log(`🚛 Larry: ✅ Total ${allOffers.length} offers for ${routeLabel} (${pageCount} pages, expected: ${expectedTotal})`);
  return allOffers;
}
