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
  // Build loading place address - only include non-empty fields
  const loadingAddress: Record<string, unknown> = {
    country: [loadingPoint.country],
  };
  if (loadingPoint.locality && !isCountryName(loadingPoint.locality)) {
    loadingAddress.locality = loadingPoint.locality;
  }
  if (loadingPoint.postalCode && loadingPoint.postalCode.trim()) {
    loadingAddress.postal_code = loadingPoint.postalCode;
  }

  // Build unloading place address - only include non-empty fields
  const unloadingAddress: Record<string, unknown> = {
    country: [unloadingPoint.country],
  };
  if (unloadingPoint.locality && !isCountryName(unloadingPoint.locality)) {
    unloadingAddress.locality = unloadingPoint.locality;
  }
  if (unloadingPoint.postalCode && unloadingPoint.postalCode.trim()) {
    unloadingAddress.postal_code = unloadingPoint.postalCode;
  }

  // Build loading place object
  const loadingPlace: Record<string, unknown> = {
    address: loadingAddress,
  };
  // Only include coordinates if they are valid (non-zero)
  if (loadingPoint.latitude !== 0 && loadingPoint.longitude !== 0) {
    loadingPlace.coordinates = {
      latitude: loadingPoint.latitude,
      longitude: loadingPoint.longitude,
      range: loadingPoint.range,
    };
  }

  // Build unloading place object
  const unloadingPlace: Record<string, unknown> = {
    address: unloadingAddress,
  };
  // Only include coordinates if they are valid (non-zero)
  if (unloadingPoint.latitude !== 0 && unloadingPoint.longitude !== 0) {
    unloadingPlace.coordinates = {
      latitude: unloadingPoint.latitude,
      longitude: unloadingPoint.longitude,
      range: unloadingPoint.range,
    };
  }

  const filter: Record<string, unknown> = {
    loading_place: [loadingPlace],
    unloading_place: [unloadingPlace],
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
  let searchAfterId: string | null = null;
  let hasMore = true;
  let pageCount = 0;
  const MAX_PAGES = 30; // Safety limit: max 30 pages (~600 offers at 20/page)

  // Ensure bearer token contains only ISO-8859-1 compatible characters
  const cleanToken = cleanBearerToken(config.bearerToken);

  while (hasMore && pageCount < MAX_PAGES) {
    const params = new URLSearchParams({ 
      filter, 
      sort, 
      counters
    });

    // Add pagination parameter with search_after cursor (format: {"search_after":{"id":"..."}})
    if (searchAfterId) {
      const pagination = JSON.stringify({ search_after: { id: searchAfterId } });
      params.set('pagination', pagination);
    }

    const url = `${config.apiUrl}?${params.toString()}`;

    console.log(`🚛 Larry: Fetching page ${pageCount + 1} for ${loadingPoint.locality} → ${unloadingPoint.locality}${searchAfterId ? ' (cursor: ' + searchAfterId.substring(0, 10) + '...)' : ''}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      mode: 'cors',
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

    const data: ApiResponse = await response.json();
    const offers = data._embedded['freight-offers'] || [];
    
    console.log(`🚛 Larry: Page ${pageCount + 1} returned ${offers.length} offers`);
    
    // Add offers to our collection
    allOffers.push(...offers);
    pageCount++;
    
    // Determine if there are more pages
    if (offers.length === 0) {
      // No offers returned - we're done
      hasMore = false;
    } else {
      // Get the ID of the last offer for the next page cursor
      const lastOffer = offers[offers.length - 1];
      if (lastOffer && lastOffer.id) {
        searchAfterId = lastOffer.id;
        // Continue fetching - Trans.eu returns ~20 per page
        // We stop when we get 0 results
      } else {
        hasMore = false;
      }
    }

    // Add a small delay between requests to avoid rate limiting
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  if (pageCount >= MAX_PAGES) {
    console.warn(`🚛 Larry: Reached max page limit (${MAX_PAGES}) for ${loadingPoint.locality} → ${unloadingPoint.locality}`);
  }

  console.log(`🚛 Larry: Total ${allOffers.length} offers for ${loadingPoint.locality} → ${unloadingPoint.locality} (${pageCount} pages)`);
  return allOffers;
}

/**
 * Fetch freight offers for all combinations of loading and unloading points.
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

  // Build all pairs: each loading point × each unloading point
  const pairs: { loading: WayPoint; unloading: WayPoint }[] = [];

  for (const lp of config.loadingPoints) {
    for (const up of config.unloadingPoints) {
      pairs.push({ loading: lp, unloading: up });
    }
  }

  // If return route enabled, also add reverse pairs
  if (config.includeReturnRoute) {
    for (const up of config.unloadingPoints) {
      for (const lp of config.loadingPoints) {
        pairs.push({ loading: up, unloading: lp });
      }
    }
  }

  console.log(`🚛 Larry: Fetching offers for ${pairs.length} route pairs with pagination...`);

  // Fetch all pairs in parallel (with concurrency limit)
  const BATCH_SIZE = 3; // Reduced to be gentler on the API
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    
    console.log(`🚛 Larry: Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pairs.length / BATCH_SIZE)}`);
    
    try {
      const results = await Promise.all(
        batch.map((p) => fetchPair(config, p.loading, p.unloading))
      );

      for (const offers of results) {
        for (const offer of offers) {
          if (!seenIds.has(offer.id)) {
            seenIds.add(offer.id);
            allOffers.push(offer);
          }
        }
      }

      console.log(`🚛 Larry: Total unique offers so far: ${allOffers.length}`);
    } catch (error) {
      // Handle CORS and other network errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(
          'CORS Error: Cannot access Trans.eu API from localhost. ' +
          'Please use the Chrome Extension on platform.trans.eu instead, ' +
          'or ensure you have a valid bearer token.'
        );
      }
      throw error;
    }
  }

  console.log(`🚛 Larry: Finished! Found ${allOffers.length} unique offers total`);

  return {
    _embedded: { 'freight-offers': allOffers },
    total: allOffers.length,
  };
}
