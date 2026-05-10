/**
 * DFS Route Optimization Strategy - Time Calculations and EU Compliance
 * 
 * Handles all time-related calculations, EU driving regulations, and chronology validation
 */

import type { DFSOffer, RouteContext, RiskType } from './types';
import { estimateDrivingTimeHours } from './geometry';

// EU Driving Regulations (EC 561/2006)
export const EU_DRIVING_RULES = {
  maxDailyDrivingHours: 9, // Can be extended to 10h twice per week
  maxExtendedDailyDrivingHours: 10,
  maxExtendedDaysPerWeek: 2,
  maxWeeklyDrivingHours: 56,
  maxBiWeeklyDrivingHours: 90,
  minDailyRestHours: 11, // Can be reduced to 9h three times between weekly rests
  minReducedDailyRestHours: 9,
  maxReducedRestsPerWeek: 3,
  minWeeklyRestHours: 45,
  minReducedWeeklyRestHours: 24,
  maxContinuousDrivingHours: 4.5, // Must take 45min break after this
  minBreakMinutes: 45
};

/**
 * Calculate arrival time at next loading point considering travel time
 */
export function calculateArrivalTime(
  departureTime: Date,
  distanceKm: number,
  averageSpeed: number = 80
): Date {
  const drivingHours = estimateDrivingTimeHours(distanceKm, averageSpeed);
  const drivingMs = drivingHours * 60 * 60 * 1000;
  
  // Add mandatory breaks for long distances
  const mandatoryBreaks = Math.floor(drivingHours / 4.5);
  const breakTimeMs = mandatoryBreaks * 45 * 60 * 1000; // 45 minutes per break
  
  return new Date(departureTime.getTime() + drivingMs + breakTimeMs);
}

/**
 * Check if chronology is valid (no time travel)
 */
export function isChronologyValid(
  unloadTime: Date,
  nextLoadTime: Date,
  travelDistanceKm: number,
  averageSpeed: number = 80,
  bufferHours: number = 2
): boolean {
  const arrivalTime = calculateArrivalTime(unloadTime, travelDistanceKm, averageSpeed);
  const bufferMs = bufferHours * 60 * 60 * 1000;
  
  // Allow some flexibility - can arrive up to buffer hours after loading window starts
  return arrivalTime.getTime() <= (nextLoadTime.getTime() + bufferMs);
}

/**
 * Detect time-related risks in a route chain
 */
export function detectTimeRisks(context: RouteContext): RiskType[] {
  const risks: RiskType[] = [];
  
  for (let i = 0; i < context.chain.length; i++) {
    const offer = context.chain[i];
    
    // Check for weekend deliveries
    const unloadDay = new Date(offer.unloadStart).getDay();
    if (unloadDay === 0 || unloadDay === 6) { // Sunday or Saturday
      risks.push(RiskType.WEEKEND_DELIVERY);
    }
    
    // Check for night arrivals (22:00 - 06:00)
    const unloadHour = new Date(offer.unloadStart).getHours();
    if (unloadHour >= 22 || unloadHour <= 6) {
      risks.push(RiskType.NIGHT_ARRIVAL);
    }
    
    // Check for time overlaps with next offer
    if (i < context.chain.length - 1) {
      const nextOffer = context.chain[i + 1];
      const currentUnload = new Date(offer.unloadEnd);
      const nextLoad = new Date(nextOffer.loadStart);
      
      if (currentUnload.getTime() > nextLoad.getTime()) {
        risks.push(RiskType.TIME_OVERLAP);
      }
      
      // Check for tight schedules (less than 4 hours between unload and next load)
      const timeDiffHours = (nextLoad.getTime() - currentUnload.getTime()) / (1000 * 60 * 60);
      if (timeDiffHours < 4 && timeDiffHours > 0) {
        risks.push(RiskType.TIGHT_SCHEDULE);
      }
    }
  }
  
  return [...new Set(risks)]; // Remove duplicates
}

/**
 * Calculate total driving hours for a route chain
 */
export function calculateTotalDrivingHours(context: RouteContext, averageSpeed: number = 80): number {
  let totalHours = 0;
  
  // Add driving time for each loaded segment
  for (const offer of context.chain) {
    totalHours += estimateDrivingTimeHours(offer.distanceKm, averageSpeed);
  }
  
  // Add empty running time
  totalHours += estimateDrivingTimeHours(context.emptyDistanceKm, averageSpeed);
  
  return totalHours;
}

/**
 * Calculate mandatory rest hours based on total driving time
 */
export function calculateMandatoryRestHours(totalDrivingHours: number): number {
  // Daily rest: 11 hours per day (assuming 9 hours driving per day max)
  const daysOnRoad = Math.ceil(totalDrivingHours / EU_DRIVING_RULES.maxDailyDrivingHours);
  const dailyRestHours = daysOnRoad * EU_DRIVING_RULES.minDailyRestHours;
  
  // Weekly rest: 45 hours per week
  const weeksOnRoad = Math.ceil(daysOnRoad / 7);
  const weeklyRestHours = weeksOnRoad * EU_DRIVING_RULES.minWeeklyRestHours;
  
  return dailyRestHours + weeklyRestHours;
}

/**
 * Check if route complies with EU driving regulations
 */
export function checkEUCompliance(context: RouteContext, averageSpeed: number = 80): {
  isCompliant: boolean;
  violations: string[];
  totalDrivingHours: number;
  totalRestHours: number;
} {
  const violations: string[] = [];
  const totalDrivingHours = calculateTotalDrivingHours(context, averageSpeed);
  const totalRestHours = calculateMandatoryRestHours(totalDrivingHours);
  
  // Check daily driving limits
  const daysOnRoad = Math.ceil(totalDrivingHours / EU_DRIVING_RULES.maxDailyDrivingHours);
  const avgDailyHours = totalDrivingHours / daysOnRoad;
  
  if (avgDailyHours > EU_DRIVING_RULES.maxDailyDrivingHours) {
    violations.push(`Daily driving hours exceeded: ${avgDailyHours.toFixed(1)}h > ${EU_DRIVING_RULES.maxDailyDrivingHours}h`);
  }
  
  // Check weekly driving limits
  const weeksOnRoad = Math.ceil(daysOnRoad / 7);
  const avgWeeklyHours = totalDrivingHours / weeksOnRoad;
  
  if (avgWeeklyHours > EU_DRIVING_RULES.maxWeeklyDrivingHours) {
    violations.push(`Weekly driving hours exceeded: ${avgWeeklyHours.toFixed(1)}h > ${EU_DRIVING_RULES.maxWeeklyDrivingHours}h`);
  }
  
  return {
    isCompliant: violations.length === 0,
    violations,
    totalDrivingHours,
    totalRestHours
  };
}

/**
 * Calculate route duration from first loading to last unloading
 */
export function calculateRouteDuration(context: RouteContext): {
  durationHours: number;
  durationDays: number;
  startTime: Date;
  endTime: Date;
} {
  if (context.chain.length === 0) {
    return { durationHours: 0, durationDays: 0, startTime: new Date(), endTime: new Date() };
  }
  
  const startTime = new Date(context.chain[0].loadStart);
  const endTime = new Date(context.chain[context.chain.length - 1].unloadEnd);
  
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const durationDays = durationHours / 24;
  
  return {
    durationHours,
    durationDays,
    startTime,
    endTime
  };
}

/**
 * Format time duration for display
 */
export function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  const minutes = Math.floor((hours % 1) * 60);
  
  if (days > 0) {
    return `${days}д ${remainingHours}г ${minutes}хв`;
  } else if (remainingHours > 0) {
    return `${remainingHours}г ${minutes}хв`;
  } else {
    return `${minutes}хв`;
  }
}