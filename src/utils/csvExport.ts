import type { FreightOffer, OptimizedRoute } from '../types';

/**
 * Utility functions for exporting data to CSV format
 */

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) return '';
  
  // Create header row
  const headerRow = headers.join(',');
  
  // Create data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Handle values that might contain commas, quotes, or newlines
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Export freight offers to CSV
 */
export function exportOffersToCSV(offers: FreightOffer[], filename: string = 'freight-offers.csv'): void {
  if (offers.length === 0) {
    alert('Немає пропозицій для експорту');
    return;
  }

  const csvData = offers.map(offer => ({
    id: offer.id,
    company: offer.company.legal_name,
    price: offer.price.value || 0,
    currency: offer.price.currency,
    capacity: offer.freight.capacity,
    weight: offer.freight.requirements.transport.total_weight || 0,
    distance_km: Math.round(offer.freight.route.distance / 1000),
    loading_city: offer.freight.spots.find(s => s.operations.some(o => o.type === 'loading'))?.place.address.locality || '',
    loading_country: offer.freight.spots.find(s => s.operations.some(o => o.type === 'loading'))?.place.address.country || '',
    loading_date: offer.freight.spots.find(s => s.operations.some(o => o.type === 'loading'))?.operations.find(o => o.type === 'loading')?.timespan.begin || '',
    unloading_city: offer.freight.spots.find(s => s.operations.some(o => o.type === 'unloading'))?.place.address.locality || '',
    unloading_country: offer.freight.spots.find(s => s.operations.some(o => o.type === 'unloading'))?.place.address.country || '',
    unloading_date: offer.freight.spots.find(s => s.operations.some(o => o.type === 'unloading'))?.operations.find(o => o.type === 'unloading')?.timespan.end || '',
    is_ftl: offer.freight.requirements.is_ftl,
    vehicle_size: offer.freight.requirements.vehicle_size,
    payment_days: offer.freight.period.days,
    is_quick_pay: offer.freight.is_quick_pay,
    rating: offer.rating_summary.rate,
    rates_count: offer.rating_summary.rates_count,
    created_at: offer.created_at,
    publish_date: offer.publish_date
  }));

  const headers = [
    'id', 'company', 'price', 'currency', 'capacity', 'weight', 'distance_km',
    'loading_city', 'loading_country', 'loading_date',
    'unloading_city', 'unloading_country', 'unloading_date',
    'is_ftl', 'vehicle_size', 'payment_days', 'is_quick_pay',
    'rating', 'rates_count', 'created_at', 'publish_date'
  ];

  const csvContent = arrayToCSV(csvData, headers);
  downloadCSV(csvContent, filename);
}

/**
 * Export optimized routes to CSV
 */
export function exportRoutesToCSV(routes: OptimizedRoute[], filename: string = 'optimized-routes.csv'): void {
  if (routes.length === 0) {
    alert('Немає маршрутів для експорту');
    return;
  }

  const csvData: any[] = [];
  
  routes.forEach((route, routeIndex) => {
    route.segments.forEach((segment, segmentIndex) => {
      csvData.push({
        route_index: routeIndex + 1,
        segment_index: segmentIndex + 1,
        offer_id: segment.offer.id,
        company: segment.offer.company.legal_name,
        from_city: segment.from,
        to_city: segment.to,
        distance_km: segment.distanceKm,
        loading_date: segment.loadingDate,
        unloading_date: segment.unloadingDate,
        price: segment.offer.price.value || 0,
        price_per_km: segment.pricePerKm || 0,
        is_empty: segment.isEmpty,
        empty_distance_km: segment.emptyDistanceKm,
        driving_hours: segment.drivingHours,
        rest_stops: segment.restStops,
        // Route totals (repeated for each segment)
        route_total_distance_km: route.totalDistanceKm,
        route_loaded_distance_km: route.loadedDistanceKm,
        route_empty_distance_km: route.emptyDistanceKm,
        route_empty_run_percent: route.emptyRunPercent,
        route_total_days: route.totalDays,
        route_idle_hours: route.idleHours,
        route_total_driving_hours: route.totalDrivingHours,
        route_total_rest_hours: route.totalRestHours,
        route_mandatory_breaks: route.mandatoryBreaks,
        route_weekly_rests_needed: route.weeklyRestsNeeded,
        route_score: route.score,
        route_eu_compliant: route.euCompliant,
        route_time_overlap: route.timeOverlap || false
      });
    });
  });

  const headers = [
    'route_index', 'segment_index', 'offer_id', 'company',
    'from_city', 'to_city', 'distance_km', 'loading_date', 'unloading_date',
    'price', 'price_per_km', 'is_empty', 'empty_distance_km',
    'driving_hours', 'rest_stops',
    'route_total_distance_km', 'route_loaded_distance_km', 'route_empty_distance_km',
    'route_empty_run_percent', 'route_total_days', 'route_idle_hours',
    'route_total_driving_hours', 'route_total_rest_hours', 'route_mandatory_breaks',
    'route_weekly_rests_needed', 'route_score', 'route_eu_compliant', 'route_time_overlap'
  ];

  const csvContent = arrayToCSV(csvData, headers);
  downloadCSV(csvContent, filename);
}

/**
 * Generate filename with timestamp
 */
export function generateTimestampedFilename(prefix: string, extension: string = 'csv'): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds and 'Z'
  return `${prefix}-${timestamp}.${extension}`;
}