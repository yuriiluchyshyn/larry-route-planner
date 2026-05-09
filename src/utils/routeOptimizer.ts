import type { FreightOffer, OptimizedRoute, RouteSegment } from '../types';
import {
  distanceToDrivingHours,
  calculateMandatoryBreaks,
  calculateTotalRestHours,
  calculateWeeklyRests,
  isEUCompliant,
  calculateRealisticTravelTime,
  EU_DRIVING_RULES,
} from './euRules';

/**
 * Calculate distance between two coordinates using Haversine formula (in km)
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateRoadDistance(straightLineKm: number): number {
  return straightLineKm * 1.3;
}

function getLoadingCoords(offer: FreightOffer): { lat: number; lon: number } {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'loading')
  );
  return {
    lat: spot?.place.coordinates.latitude ?? 0,
    lon: spot?.place.coordinates.longitude ?? 0,
  };
}

function getUnloadingCoords(offer: FreightOffer): { lat: number; lon: number } {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'unloading')
  );
  return {
    lat: spot?.place.coordinates.latitude ?? 0,
    lon: spot?.place.coordinates.longitude ?? 0,
  };
}

function getLoadingCity(offer: FreightOffer): string {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'loading')
  );
  return spot?.place.address.locality ?? 'Unknown';
}

function getUnloadingCity(offer: FreightOffer): string {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'unloading')
  );
  return spot?.place.address.locality ?? 'Unknown';
}

function getLoadingDate(offer: FreightOffer): Date {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'loading')
  );
  const op = spot?.operations.find((o) => o.type === 'loading');
  return new Date(op?.timespan.begin ?? Date.now());
}

function getUnloadingDate(offer: FreightOffer): Date {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'unloading')
  );
  const op = spot?.operations.find((o) => o.type === 'unloading');
  return new Date(op?.timespan.begin ?? Date.now());
}

function getEmptyDistance(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  return estimateRoadDistance(haversineDistance(fromLat, fromLon, toLat, toLon));
}

/**
 * Calculate idle hours between segments, accounting for EU rest requirements.
 * Idle = gap time - travel time - mandatory rest time during travel
 */
function calculateIdleHours(
  prevUnloadingDate: Date,
  nextLoadingDate: Date,
  emptyDistanceKm: number,
  speedKmh: number
): number {
  const diffMs = nextLoadingDate.getTime() - prevUnloadingDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  // Realistic travel time includes breaks and rests
  const travelTime = calculateRealisticTravelTime(emptyDistanceKm, speedKmh);
  return Math.max(0, diffHours - travelTime);
}

interface OptimizerConfig {
  daysOnRoad: number;
  maxEmptyRunPercent: number;
  minPricePerKm: number;
  homeBaseLat: number;
  homeBaseLon: number;
  departureFrom: string; // YYYY-MM-DD
  departureTo: string;
  returnFrom: string;
  returnTo: string;
  averageSpeedKmh: number;
}

/**
 * Build optimized cyclic routes for Larry using Branch-and-Bound.
 * Home base is the start/end point, loading/unloading points are intermediate stops.
 * Routes must start and end at home base within the time window.
 * 
 * Accepts either a single merged offers array, or separate main/return arrays.
 * When passed separate arrays, the optimizer can favor chains that go
 * outbound (main) then back (return).
 */
export function buildOptimizedRoutes(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: OptimizerConfig
): OptimizedRoute[] {
  // Normalize input: build a merged list with direction tags
  let mergedOffers: FreightOffer[];
  const directionMap = new Map<string, 'main' | 'return'>();

  if (Array.isArray(offers)) {
    mergedOffers = offers;
  } else {
    const { mainOffers, returnOffers } = offers;
    mergedOffers = [];
    const seen = new Set<string>();
    for (const o of mainOffers) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        mergedOffers.push(o);
        directionMap.set(o.id, 'main');
      }
    }
    for (const o of returnOffers) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        mergedOffers.push(o);
        directionMap.set(o.id, 'return');
      }
    }
    console.log(`🏆 Larry: Optimizer input — main: ${mainOffers.length}, return: ${returnOffers.length}, merged unique: ${mergedOffers.length}`);
  }

  // No price filtering — all offers are eligible
  const filteredOffers = mergedOffers;
  console.log(`🏆 Larry: No price filtering, using all ${filteredOffers.length} offers`);

  // Step 2: Parse departure/return date ranges
  const depFrom = config.departureFrom
    ? new Date(config.departureFrom + 'T00:00:00').getTime()
    : 0;
  const depTo = config.departureTo
    ? new Date(config.departureTo + 'T23:59:59').getTime()
    : Infinity;
  const retFrom = config.returnFrom
    ? new Date(config.returnFrom + 'T00:00:00').getTime()
    : 0;
  const retTo = config.returnTo
    ? new Date(config.returnTo + 'T23:59:59').getTime()
    : Infinity;

  // Sort by loading date
  const sortedOffers = [...filteredOffers].sort(
    (a, b) => getLoadingDate(a).getTime() - getLoadingDate(b).getTime()
  );

  const n = sortedOffers.length;
  if (n === 0) return [];

  // Precompute
  const loadDates = sortedOffers.map((o) => getLoadingDate(o).getTime());
  const unloadDates = sortedOffers.map((o) => getUnloadingDate(o).getTime());
  const loadCoords = sortedOffers.map((o) => getLoadingCoords(o));
  const unloadCoords = sortedOffers.map((o) => getUnloadingCoords(o));
  const distances = sortedOffers.map(
    (o) => (o.freight.route.distance || 0) / 1000
  );

  // Precompute empty distances
  const emptyDistMatrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0)
  );
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        emptyDistMatrix[i][j] = getEmptyDistance(
          unloadCoords[i].lat,
          unloadCoords[i].lon,
          loadCoords[j].lat,
          loadCoords[j].lon
        );
      }
    }
  }

  const allRoutes: OptimizedRoute[] = [];
  let bestScore = -Infinity;

  // Max allowed driving hours per day (EU rule)
  const maxDailyDriving = EU_DRIVING_RULES.maxDailyDrivingHours;
  const maxTotalDrivingHours = config.daysOnRoad * maxDailyDriving;

  // Strategy 1: Single offer cycles (Home → Load → Unload → Home, repeated)
  for (let i = 0; i < n; i++) {
    const offer = sortedOffers[i];
    const loadTime = loadDates[i];
    const unloadTime = unloadDates[i];
    
    // Check if this offer fits within departure window
    // For return: be flexible - accept if within daysOnRoad limit
    if (loadTime < depFrom || loadTime > depTo) continue;
    // Don't strictly filter by return window for cyclic routes
    // Instead, check if the unload time is reasonable (within daysOnRoad from departure)

    // Calculate cycle metrics: Home → Loading → Unloading → Home
    const homeToLoadEmpty = getEmptyDistance(
      config.homeBaseLat,
      config.homeBaseLon,
      loadCoords[i].lat,
      loadCoords[i].lon
    );
    const unloadToHomeEmpty = getEmptyDistance(
      unloadCoords[i].lat,
      unloadCoords[i].lon,
      config.homeBaseLat,
      config.homeBaseLon
    );
    
    const cycleLoaded = distances[i];
    const cycleEmpty = homeToLoadEmpty + unloadToHomeEmpty;
    const cycleTotalDist = cycleLoaded + cycleEmpty;
    const cycleEmptyPercent = cycleTotalDist > 0 ? (cycleEmpty / cycleTotalDist) * 100 : 0;
    
    // Consider all routes regardless of empty run percentage - user decides
    if (cycleEmptyPercent <= config.maxEmptyRunPercent * 2) { // Relaxed check, just to avoid completely unrealistic routes
      const cycleDrivingHours = distanceToDrivingHours(cycleTotalDist, config.averageSpeedKmh);
      const cycleDurationMs = unloadTime - loadTime + 12 * 60 * 60 * 1000; // add 12h for return
      
      // Calculate how many cycles can fit within the time window
      const availableTimeMs = retTo - depFrom;
      const maxCycles = Math.floor(availableTimeMs / cycleDurationMs);
      
      // Try different numbers of cycles (1, 2, 3, etc.)
      for (let cycles = 1; cycles <= Math.min(maxCycles, 5); cycles++) {
        const totalDrivingHours = cycleDrivingHours * cycles;
        const totalDays = (cycleDurationMs * cycles) / (1000 * 60 * 60 * 24);
        
        if (totalDrivingHours > maxTotalDrivingHours) break;
        if (totalDays > config.daysOnRoad) break;
        
        const euCompliant = isEUCompliant(totalDrivingHours, totalDays);
        const totalRestHours = calculateTotalRestHours(totalDrivingHours, totalDays);
        const mandatoryBreaks = calculateMandatoryBreaks(totalDrivingHours);
        const weeklyRestsNeeded = calculateWeeklyRests(totalDays);
        
        // Score: reward multiple cycles, EU compliance, loaded distance
        const complianceBonus = euCompliant ? 300 : -200;
        const cycleBonus = cycles * 200; // Strong bonus for multiple cycles
        const routeScore =
          (cycleLoaded * cycles) * 2.5 -
          (cycleEmpty * cycles) * 1.0 -
          cycleEmptyPercent * 5 +
          cycleBonus +
          complianceBonus;

        if (routeScore > bestScore - 400 || true) { // accept all
          if (routeScore > bestScore) bestScore = routeScore;

          // Create segments for each cycle
          const segments: RouteSegment[] = [];
          for (let c = 0; c < cycles; c++) {
            const cycleStartTime = new Date(loadTime + c * cycleDurationMs);
            const cycleEndTime = new Date(unloadTime + c * cycleDurationMs);
            
            const segDrivingHours = distanceToDrivingHours(cycleLoaded, config.averageSpeedKmh);
            const segBreaks = calculateMandatoryBreaks(segDrivingHours);
            const pricePerKm = offer.price.value && cycleLoaded > 0 ? offer.price.value / cycleLoaded : null;

            segments.push({
              offer,
              from: getLoadingCity(offer),
              to: getUnloadingCity(offer),
              distanceKm: cycleLoaded,
              loadingDate: cycleStartTime.toISOString(),
              unloadingDate: cycleEndTime.toISOString(),
              pricePerKm,
              isEmpty: false,
              emptyDistanceKm: homeToLoadEmpty, // Empty run to reach loading point
              drivingHours: segDrivingHours,
              restStops: segBreaks,
            });
          }

          allRoutes.push({
            segments,
            totalDistanceKm: cycleTotalDist * cycles,
            loadedDistanceKm: cycleLoaded * cycles,
            emptyDistanceKm: cycleEmpty * cycles,
            emptyRunPercent: cycleEmptyPercent,
            totalDays: totalDays,
            idleHours: 0, // Assume minimal idle time for cyclic routes
            totalDrivingHours,
            totalRestHours,
            mandatoryBreaks,
            weeklyRestsNeeded,
            score: routeScore,
            euCompliant,
          });
        }
      }
    }
  }

  // Strategy 2: Multi-offer routes (Home → Load1 → Unload1 → Load2 → Unload2 → ... → Home)
  for (let startIdx = 0; startIdx < n; startIdx++) {
    const endTimeLimit =
      loadDates[startIdx] + config.daysOnRoad * 24 * 60 * 60 * 1000;

    interface StackFrame {
      chain: number[];
      lastIdx: number;
      currentLoaded: number;
      currentEmpty: number;
      currentIdle: number;
      currentDrivingHours: number;
    }

    const homeToFirstEmpty = getEmptyDistance(
      config.homeBaseLat,
      config.homeBaseLon,
      loadCoords[startIdx].lat,
      loadCoords[startIdx].lon
    );
    const homeToFirstDriving = distanceToDrivingHours(homeToFirstEmpty, config.averageSpeedKmh);

    const stack: StackFrame[] = [
      {
        chain: [startIdx],
        lastIdx: startIdx,
        currentLoaded: distances[startIdx],
        currentEmpty: homeToFirstEmpty,
        currentIdle: 0,
        currentDrivingHours:
          homeToFirstDriving + distanceToDrivingHours(distances[startIdx], config.averageSpeedKmh),
      },
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 5000;

    while (stack.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const frame = stack.pop()!;
      const {
        chain,
        lastIdx,
        currentLoaded,
        currentEmpty,
        currentIdle,
        currentDrivingHours,
      } = frame;

      // Evaluate current chain as complete route
      const returnEmpty = getEmptyDistance(
        unloadCoords[lastIdx].lat,
        unloadCoords[lastIdx].lon,
        config.homeBaseLat,
        config.homeBaseLon
      );
      const returnDriving = distanceToDrivingHours(returnEmpty, config.averageSpeedKmh);
      const totalEmpty = currentEmpty + returnEmpty;
      const totalDist = currentLoaded + totalEmpty;
      const emptyPercent = totalDist > 0 ? (totalEmpty / totalDist) * 100 : 0;
      const totalDrivingHours = currentDrivingHours + returnDriving;

      if (emptyPercent <= config.maxEmptyRunPercent * 2 && chain.length >= 1) { // Relaxed filter
        // Check departure date range: first loading must be within departure window
        const firstLoadTime = loadDates[chain[0]];
        if (firstLoadTime < depFrom || firstLoadTime > depTo) {
          // Skip — departure outside allowed range
          // But still try extending the chain below
        } else {
        // Calculate EU compliance metrics first
        const firstLoadDate = new Date(loadDates[chain[0]]);
        const lastUnloadDate = new Date(unloadDates[lastIdx]);
        const totalDays = Math.max(
          1,
          (lastUnloadDate.getTime() - firstLoadDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        // Check return date range: last unloading must be within return window
        const lastUnloadTime = unloadDates[lastIdx];
        // Flexible return: accept if within window OR if it's the latest possible route
        // that still fits within daysOnRoad limit
        const returnOk = lastUnloadTime >= retFrom && lastUnloadTime <= retTo;
        const fitsInDaysLimit = totalDays <= config.daysOnRoad;
        // Accept route if it fits return window OR if it's within days limit
        // (for cases where return window is too far and no offers match)
        const acceptRoute = returnOk || fitsInDaysLimit;

        const euCompliant = isEUCompliant(totalDrivingHours, totalDays);
        const totalRestHours = calculateTotalRestHours(
          totalDrivingHours,
          totalDays
        );
        const mandatoryBreaks = calculateMandatoryBreaks(totalDrivingHours);
        const weeklyRestsNeeded = calculateWeeklyRests(totalDays);

        // Score: reward EU compliance, loaded km; penalize empty, idle
        const complianceBonus = euCompliant ? 200 : -500;
        // Bonus for fitting within return window (but don't exclude routes outside it)
        const returnBonus = returnOk ? 100 : -50;
        const routeScore =
          currentLoaded * 1.5 -
          totalEmpty * 2.5 -
          currentIdle * 4.0 +
          chain.length * 80 -
          emptyPercent * 10 +
          complianceBonus +
          returnBonus;

        if (acceptRoute) {
          if (routeScore > bestScore) bestScore = routeScore;

          const segments: RouteSegment[] = chain.map((idx, i) => {
            const offer = sortedOffers[idx];
            let emptyToThis = 0;
            if (i > 0) {
              emptyToThis = emptyDistMatrix[chain[i - 1]][idx];
            } else {
              emptyToThis = homeToFirstEmpty;
            }
            const distKm = distances[idx];
            const segDrivingHours = distanceToDrivingHours(distKm, config.averageSpeedKmh);
            const segBreaks = calculateMandatoryBreaks(segDrivingHours);
            const pricePerKm =
              offer.price.value && distKm > 0
                ? offer.price.value / distKm
                : null;

            return {
              offer,
              from: getLoadingCity(offer),
              to: getUnloadingCity(offer),
              distanceKm: distKm,
              loadingDate: new Date(loadDates[idx]).toISOString(),
              unloadingDate: new Date(unloadDates[idx]).toISOString(),
              pricePerKm,
              isEmpty: false,
              emptyDistanceKm: emptyToThis,
              drivingHours: segDrivingHours,
              restStops: segBreaks,
            };
          });

          allRoutes.push({
            segments,
            totalDistanceKm: totalDist,
            loadedDistanceKm: currentLoaded,
            emptyDistanceKm: totalEmpty,
            emptyRunPercent: emptyPercent,
            totalDays,
            idleHours: currentIdle,
            totalDrivingHours,
            totalRestHours,
            mandatoryBreaks,
            weeklyRestsNeeded,
            score: routeScore,
            euCompliant,
          });
        }
        } // close departure date check
      }

      // Extend chain (branch)
      if (
        unloadDates[lastIdx] < endTimeLimit &&
        currentDrivingHours < maxTotalDrivingHours
      ) {
        const candidates: { idx: number; potential: number }[] = [];

        for (let j = 0; j < n; j++) {
          if (chain.includes(j)) continue;
          if (loadDates[j] < unloadDates[lastIdx]) continue;
          if (loadDates[j] > endTimeLimit) continue;

          const emptyToJ = emptyDistMatrix[lastIdx][j];
          const emptyDrivingToJ = distanceToDrivingHours(emptyToJ, config.averageSpeedKmh);
          const segDriving = distanceToDrivingHours(distances[j], config.averageSpeedKmh);
          const newTotalDriving =
            currentDrivingHours + emptyDrivingToJ + segDriving;

          // EU compliance pruning: don't exceed max driving hours
          if (newTotalDriving > maxTotalDrivingHours * 1.2) continue;

          // Empty run pruning
          const newEmpty = currentEmpty + emptyToJ;
          const newLoaded = currentLoaded + distances[j];
          const optimisticEmptyPercent =
            (newEmpty / (newLoaded + newEmpty)) * 100;
          if (optimisticEmptyPercent > config.maxEmptyRunPercent * 3) continue; // Very relaxed filter

          const potential = distances[j] * 2 - emptyToJ * 3;
          candidates.push({ idx: j, potential });
        }

        candidates.sort((a, b) => b.potential - a.potential);
        const maxBranches = Math.min(candidates.length, 5);

        for (let b = 0; b < maxBranches; b++) {
          const j = candidates[b].idx;
          const emptyToJ = emptyDistMatrix[lastIdx][j];
          const emptyDrivingToJ = distanceToDrivingHours(emptyToJ, config.averageSpeedKmh);
          const segDriving = distanceToDrivingHours(distances[j], config.averageSpeedKmh);

          const idleHours = calculateIdleHours(
            new Date(unloadDates[lastIdx]),
            new Date(loadDates[j]),
            emptyToJ,
            config.averageSpeedKmh
          );

          stack.push({
            chain: [...chain, j],
            lastIdx: j,
            currentLoaded: currentLoaded + distances[j],
            currentEmpty: currentEmpty + emptyToJ,
            currentIdle: currentIdle + idleHours,
            currentDrivingHours:
              currentDrivingHours + emptyDrivingToJ + segDriving,
          });
        }
      }
    }
  }

  // Sort by Loaded km DESC, then Empty km ASC (more loaded is better, less empty is better)
  allRoutes.sort((a, b) => {
    if (b.loadedDistanceKm !== a.loadedDistanceKm) {
      return b.loadedDistanceKm - a.loadedDistanceKm;
    }
    return a.emptyDistanceKm - b.emptyDistanceKm;
  });

  // Improved deduplication for cyclic routes
  const seen = new Set<string>();
  const uniqueRoutes = allRoutes.filter((r) => {
    // Check if this is a cyclic route (same offer repeated)
    const isCyclic = r.segments.length > 1 && 
      r.segments.every(seg => seg.offer.id === r.segments[0].offer.id);
    
    let key: string;
    if (isCyclic) {
      // For cyclic routes, use offer ID + cycle count + date range
      const firstDate = r.segments[0].loadingDate.substring(0, 10);
      const lastDate = r.segments[r.segments.length - 1].loadingDate.substring(0, 10);
      key = `CYCLE:${r.segments[0].offer.id}:x${r.segments.length}:${firstDate}-${lastDate}`;
    } else {
      // For chain routes, use the existing logic
      key = r.segments
        .map((s) => {
          const loadDay = s.loadingDate.substring(0, 10); // YYYY-MM-DD
          return `${s.from}→${s.to}@${loadDay}`;
        })
        .join('|');
    }
    
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Also remove routes that are strict subsets of longer routes (but preserve cycles)
  const finalRoutes = uniqueRoutes.filter((route, idx) => {
    // Don't filter out cyclic routes as subsets
    const isCyclic = route.segments.length > 1 && 
      route.segments.every(seg => seg.offer.id === route.segments[0].offer.id);
    if (isCyclic) return true;
    
    const routeOfferIds = new Set(route.segments.map((s) => s.offer.id));
    // Check if a higher-scored route (earlier in array) contains all our segments
    for (let i = 0; i < idx; i++) {
      const otherRoute = uniqueRoutes[i];
      const otherIsCyclic = otherRoute.segments.length > 1 && 
        otherRoute.segments.every(seg => seg.offer.id === otherRoute.segments[0].offer.id);
      
      // Don't compare against cyclic routes
      if (otherIsCyclic) continue;
      
      const otherOfferIds = new Set(otherRoute.segments.map((s) => s.offer.id));
      if (
        routeOfferIds.size < otherOfferIds.size &&
        [...routeOfferIds].every((id) => otherOfferIds.has(id))
      ) {
        return false; // this route is a subset of a better route
      }
    }
    return true;
  });

  console.log(`🏆 Larry: Generated ${allRoutes.length} raw routes → ${finalRoutes.length} after dedup/subset removal`);
  return finalRoutes; // no limit — return all
}
