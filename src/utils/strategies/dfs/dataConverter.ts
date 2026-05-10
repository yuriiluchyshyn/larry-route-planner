/**
 * DFS Route Optimization Strategy - Data Converter
 * 
 * Converts between FreightOffer format and DFS internal format
 */

import type { FreightOffer, OptimizedRoute, RouteSegment } from '../../../types';
import type { DFSOffer, RouteContext, Point, DFSConfig } from './types';
import { calculateDistance } from './geometry';

/**
 * Convert FreightOffer to DFSOffer format
 */
export function convertFreightOfferToDFS(offer: FreightOffer): DFSOffer {
  // Find loading and unloading spots
  const loadingSpot = offer.freight.spots.find(s => 
    s.operations.some(o => o.type === 'loading')
  );
  const unloadingSpot = offer.freight.spots.find(s => 
    s.operations.some(o => o.type === 'unloading')
  );
  
  if (!loadingSpot || !unloadingSpot) {
    throw new Error(`Offer ${offer.id} missing loading or unloading spot`);
  }
  
  // Get operation details
  const loadingOp = loadingSpot.operations.find(o => o.type === 'loading');
  const unloadingOp = unloadingSpot.operations.find(o => o.type === 'unloading');
  
  if (!loadingOp || !unloadingOp) {
    throw new Error(`Offer ${offer.id} missing loading or unloading operation`);
  }
  
  return {
    id: offer.id,
    loadPoint: {
      lat: loadingSpot.place.coordinates.latitude,
      lon: loadingSpot.place.coordinates.longitude
    },
    unloadPoint: {
      lat: unloadingSpot.place.coordinates.latitude,
      lon: unloadingSpot.place.coordinates.longitude
    },
    loadStart: new Date(loadingOp.timespan.begin),
    loadEnd: new Date(loadingOp.timespan.end),
    unloadStart: new Date(unloadingOp.timespan.begin),
    unloadEnd: new Date(unloadingOp.timespan.end),
    distanceKm: (offer.freight.route.distance || 0) / 1000, // Convert meters to km
    price: offer.price.value || 0,
    weight: offer.freight.requirements.transport.total_weight,
    currency: offer.price.currency,
    originalOffer: offer
  };
}

/**
 * Convert array of FreightOffers to DFSOffers
 */
export function convertFreightOffersToDFS(offers: FreightOffer[]): DFSOffer[] {
  const converted: DFSOffer[] = [];
  
  for (const offer of offers) {
    try {
      converted.push(convertFreightOfferToDFS(offer));
    } catch (error) {
      console.warn(`Failed to convert offer ${offer.id}:`, error);
      // Skip invalid offers instead of failing completely
    }
  }
  
  return converted;
}

/**
 * Convert RouteContext to OptimizedRoute format
 */
export function convertDFSToOptimizedRoute(
  context: RouteContext,
  config: DFSConfig
): OptimizedRoute {
  // Create route segments
  const segments: RouteSegment[] = [];
  
  for (let i = 0; i < context.chain.length; i++) {
    const offer = context.chain[i];
    const originalOffer = offer.originalOffer;
    
    if (!originalOffer) {
      throw new Error(`Missing original offer for ${offer.id}`);
    }
    
    // Calculate empty distance to this segment
    let emptyDistanceKm = 0;
    if (i === 0) {
      // Distance from base to first loading point
      emptyDistanceKm = calculateDistance(config.basePoint, offer.loadPoint);
    } else {
      // Distance from previous unloading to current loading
      const prevOffer = context.chain[i - 1];
      emptyDistanceKm = calculateDistance(prevOffer.unloadPoint, offer.loadPoint);
    }
    
    // Calculate price per km
    const pricePerKm = offer.distanceKm > 0 ? offer.price / offer.distanceKm : null;
    
    // Calculate driving hours and rest stops
    const drivingHours = offer.distanceKm / config.avgSpeed;
    const restStops = Math.ceil(drivingHours / 4.5); // Break every 4.5 hours
    
    // Get city names
    const loadingSpot = originalOffer.freight.spots.find(s => 
      s.operations.some(o => o.type === 'loading')
    );
    const unloadingSpot = originalOffer.freight.spots.find(s => 
      s.operations.some(o => o.type === 'unloading')
    );
    
    const segment: RouteSegment = {
      offer: originalOffer,
      from: loadingSpot?.place.address.locality || 'Unknown',
      to: unloadingSpot?.place.address.locality || 'Unknown',
      distanceKm: offer.distanceKm,
      loadingDate: offer.loadStart.toISOString(),
      unloadingDate: offer.unloadEnd.toISOString(),
      pricePerKm,
      isEmpty: false,
      emptyDistanceKm,
      drivingHours,
      restStops
    };
    
    segments.push(segment);
  }
  
  // Calculate return distance to base
  const lastOffer = context.chain[context.chain.length - 1];
  const returnDistance = calculateDistance(lastOffer.unloadPoint, config.basePoint);
  
  // Calculate totals
  const totalDistanceKm = context.totalDistanceKm + returnDistance;
  const totalEmptyKm = context.emptyDistanceKm + returnDistance;
  const emptyRunPercent = totalDistanceKm > 0 ? (totalEmptyKm / totalDistanceKm) * 100 : 0;
  
  // Calculate time metrics
  const totalDrivingHours = context.totalDrivingHours;
  const totalDays = Math.ceil(totalDrivingHours / 9); // Assuming 9h driving per day
  const mandatoryBreaks = Math.ceil(totalDrivingHours / 4.5);
  const weeklyRestsNeeded = Math.ceil(totalDays / 6);
  
  return {
    segments,
    totalDistanceKm,
    loadedDistanceKm: context.loadedDistanceKm,
    emptyDistanceKm: totalEmptyKm,
    emptyRunPercent,
    totalDays,
    idleHours: 0, // TODO: Calculate actual idle time
    totalDrivingHours,
    totalRestHours: context.totalRestHours,
    mandatoryBreaks,
    weeklyRestsNeeded,
    score: context.score,
    euCompliant: context.euViolations === 0,
    timeOverlap: context.risks.includes('TIME_OVERLAP')
  };
}

/**
 * Convert array of RouteContexts to OptimizedRoutes
 */
export function convertDFSToOptimizedRoutes(
  contexts: RouteContext[],
  config: DFSConfig
): OptimizedRoute[] {
  return contexts.map(context => convertDFSToOptimizedRoute(context, config));
}

/**
 * Create DFS configuration from route optimizer config
 */
export function createDFSConfig(params: {
  homeBaseLat: number;
  homeBaseLon: number;
  maxEmptyRunPercent: number;
  averageSpeedKmh: number;
  departureFrom: string;
  departureTo: string;
  returnFrom: string;
  returnTo: string;
  daysOnRoad?: number;
}): DFSConfig {
  return {
    basePoint: {
      lat: params.homeBaseLat,
      lon: params.homeBaseLon
    },
    maxEmptyPercent: params.maxEmptyRunPercent,
    avgSpeed: params.averageSpeedKmh,
    maxChainLength: 5,
    minChainLength: 2,
    maxSearchRadius: 500, // 500km radius from base
    departureTimeWindow: {
      from: new Date(params.departureFrom + 'T00:00:00'),
      to: new Date(params.departureTo + 'T23:59:59')
    },
    returnTimeWindow: {
      from: new Date(params.returnFrom + 'T00:00:00'),
      to: new Date(params.returnTo + 'T23:59:59')
    },
    maxDailyDrivingHours: 9,
    maxWeeklyDrivingHours: 56,
    scoreWeights: {
      loadedKmBonus: 1,
      emptyKmPenalty: 2,
      euViolationPenalty: 25,
      riskPenalty: 10,
      chainLengthBonus: 50
    }
  };
}

/**
 * Validate DFS offer data
 */
export function validateDFSOffer(offer: DFSOffer): boolean {
  // Check required fields
  if (!offer.id || !offer.loadPoint || !offer.unloadPoint) {
    return false;
  }
  
  // Check coordinates
  if (Math.abs(offer.loadPoint.lat) > 90 || Math.abs(offer.loadPoint.lon) > 180) {
    return false;
  }
  if (Math.abs(offer.unloadPoint.lat) > 90 || Math.abs(offer.unloadPoint.lon) > 180) {
    return false;
  }
  
  // Check dates
  if (offer.loadStart >= offer.loadEnd || offer.unloadStart >= offer.unloadEnd) {
    return false;
  }
  if (offer.loadEnd > offer.unloadStart) {
    return false; // Loading must finish before unloading starts
  }
  
  // Check distance and price
  if (offer.distanceKm <= 0 || offer.price < 0) {
    return false;
  }
  
  return true;
}