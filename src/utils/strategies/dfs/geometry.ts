/**
 * DFS Route Optimization Strategy - Geometry and Distance Calculations
 * 
 * Handles all spatial calculations including distance, travel time, and coordinate operations
 */

import type { Point } from './types';

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers with road factor applied
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const R = 6371; // Earth's radius in km
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLon = (p2.lon - p1.lon) * (Math.PI / 180);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineDistance = R * c;
  
  // Apply road factor (roads are not straight lines)
  return straightLineDistance * 1.3; // 30% longer for realistic road distance
}

/**
 * Calculate driving time in hours based on distance and average speed
 */
export function estimateDrivingTimeHours(distanceKm: number, averageSpeed: number = 80): number {
  return distanceKm / averageSpeed;
}

/**
 * Calculate realistic travel time including mandatory breaks and rest periods
 * Based on EU driving regulations (EC 561/2006)
 */
export function calculateRealisticTravelTime(distanceKm: number, averageSpeed: number = 80): number {
  const baseDrivingTime = estimateDrivingTimeHours(distanceKm, averageSpeed);
  
  // Add mandatory breaks (45 min every 4.5 hours of driving)
  const mandatoryBreaks = Math.floor(baseDrivingTime / 4.5);
  const breakTime = mandatoryBreaks * 0.75; // 45 minutes = 0.75 hours
  
  // Add buffer for traffic, fuel stops, etc.
  const bufferTime = baseDrivingTime * 0.1; // 10% buffer
  
  return baseDrivingTime + breakTime + bufferTime;
}

/**
 * Check if a point is within a certain radius from base point
 */
export function isWithinRadius(point: Point, basePoint: Point, radiusKm: number): boolean {
  return calculateDistance(point, basePoint) <= radiusKm;
}

/**
 * Calculate the center point (centroid) of multiple points
 */
export function calculateCentroid(points: Point[]): Point {
  if (points.length === 0) {
    throw new Error('Cannot calculate centroid of empty points array');
  }
  
  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lon: acc.lon + point.lon
    }),
    { lat: 0, lon: 0 }
  );
  
  return {
    lat: sum.lat / points.length,
    lon: sum.lon / points.length
  };
}

/**
 * Calculate bounding box for a set of points
 */
export function calculateBoundingBox(points: Point[]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  if (points.length === 0) {
    throw new Error('Cannot calculate bounding box of empty points array');
  }
  
  return points.reduce(
    (bounds, point) => ({
      minLat: Math.min(bounds.minLat, point.lat),
      maxLat: Math.max(bounds.maxLat, point.lat),
      minLon: Math.min(bounds.minLon, point.lon),
      maxLon: Math.max(bounds.maxLon, point.lon)
    }),
    {
      minLat: points[0].lat,
      maxLat: points[0].lat,
      minLon: points[0].lon,
      maxLon: points[0].lon
    }
  );
}

/**
 * Estimate fuel consumption based on distance and truck efficiency
 */
export function estimateFuelConsumption(distanceKm: number, fuelEfficiencyL100km: number = 35): number {
  return (distanceKm * fuelEfficiencyL100km) / 100;
}

/**
 * Calculate CO2 emissions based on distance
 */
export function estimateCO2Emissions(distanceKm: number, emissionFactorKgCO2perKm: number = 0.8): number {
  return distanceKm * emissionFactorKgCO2perKm;
}