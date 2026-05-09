import type { EUDrivingRules } from '../types';

/**
 * EU Driving Regulations based on Regulation (EC) No 561/2006
 * and Directive 2002/15/EC
 */
export const EU_DRIVING_RULES: EUDrivingRules = {
  maxDailyDrivingHours: 9,
  maxExtendedDailyDrivingHours: 10,
  maxExtendedDaysPerWeek: 2,
  maxWeeklyDrivingHours: 56,
  maxBiWeeklyDrivingHours: 90,
  minDailyRestHours: 11,
  minReducedDailyRestHours: 9,
  maxReducedRestsPerWeek: 3,
  minWeeklyRestHours: 45,
  minReducedWeeklyRestHours: 24,
  maxContinuousDrivingHours: 4.5,
  minBreakMinutes: 45,
  maxDaysBeforeWeeklyRest: 6,
};

/**
 * Average speed for a lorry on European roads (km/h)
 */
export const AVG_LORRY_SPEED_KMH = 70;

/**
 * Calculate how many driving hours a distance requires
 */
export function distanceToDrivingHours(distanceKm: number, speedKmh: number = AVG_LORRY_SPEED_KMH): number {
  return distanceKm / speedKmh;
}

/**
 * Calculate mandatory breaks needed for a given driving duration
 * After every 4.5h of driving, a 45-min break is required
 */
export function calculateMandatoryBreaks(drivingHours: number): number {
  if (drivingHours <= EU_DRIVING_RULES.maxContinuousDrivingHours) return 0;
  return Math.floor(drivingHours / EU_DRIVING_RULES.maxContinuousDrivingHours);
}

/**
 * Calculate total break time in hours for a given number of breaks
 */
export function totalBreakTimeHours(breaks: number): number {
  return (breaks * EU_DRIVING_RULES.minBreakMinutes) / 60;
}

/**
 * Calculate how many daily rests are needed for a trip spanning multiple days
 */
export function calculateDailyRests(totalDrivingHours: number): number {
  // Each day allows max 9h driving (or 10h extended)
  // Using standard 9h as baseline
  return Math.max(
    0,
    Math.ceil(totalDrivingHours / EU_DRIVING_RULES.maxDailyDrivingHours) - 1
  );
}

/**
 * Calculate weekly rests needed based on total days
 */
export function calculateWeeklyRests(totalDays: number): number {
  return Math.floor(totalDays / EU_DRIVING_RULES.maxDaysBeforeWeeklyRest);
}

/**
 * Calculate total rest hours needed for a trip
 */
export function calculateTotalRestHours(
  totalDrivingHours: number,
  totalDays: number
): number {
  const dailyRests = calculateDailyRests(totalDrivingHours);
  const weeklyRests = calculateWeeklyRests(totalDays);

  const dailyRestHours = dailyRests * EU_DRIVING_RULES.minDailyRestHours;
  const weeklyRestHours = weeklyRests * EU_DRIVING_RULES.minWeeklyRestHours;
  const breaks = calculateMandatoryBreaks(totalDrivingHours);
  const breakHours = totalBreakTimeHours(breaks);

  return dailyRestHours + weeklyRestHours + breakHours;
}

/**
 * Check if a route is EU-compliant
 */
export function isEUCompliant(
  totalDrivingHours: number,
  totalDays: number
): boolean {
  // Check weekly driving limit
  const weeks = Math.ceil(totalDays / 7);
  const avgWeeklyDriving = totalDrivingHours / weeks;
  if (avgWeeklyDriving > EU_DRIVING_RULES.maxWeeklyDrivingHours) return false;

  // Check bi-weekly limit
  if (weeks >= 2) {
    const biWeeklyDriving = totalDrivingHours / Math.ceil(weeks / 2);
    if (biWeeklyDriving > EU_DRIVING_RULES.maxBiWeeklyDrivingHours) return false;
  }

  // Check daily average (rough check)
  const avgDailyDriving = totalDrivingHours / Math.max(totalDays, 1);
  if (avgDailyDriving > EU_DRIVING_RULES.maxExtendedDailyDrivingHours) return false;

  return true;
}

/**
 * Calculate realistic travel time including mandatory breaks and rests
 * Returns total elapsed time in hours
 */
export function calculateRealisticTravelTime(distanceKm: number, speedKmh: number = AVG_LORRY_SPEED_KMH): number {
  const drivingHours = distanceToDrivingHours(distanceKm, speedKmh);
  const breaks = calculateMandatoryBreaks(drivingHours);
  const breakHours = totalBreakTimeHours(breaks);

  // If driving exceeds daily limit, add daily rest
  const dailyRests = calculateDailyRests(drivingHours);
  const restHours = dailyRests * EU_DRIVING_RULES.minDailyRestHours;

  return drivingHours + breakHours + restHours;
}
