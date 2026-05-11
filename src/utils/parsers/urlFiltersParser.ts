/**
 * URL Filters Parser
 * Парсер фільтрів з URL параметрів
 */

import type { RouteConfig } from '../../types';

/**
 * Парсити фільтри з URL параметрів
 */
export function parseFiltersFromUrl(): Partial<RouteConfig> | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const filtersParam = urlParams.get('filters');
    
    if (!filtersParam) return null;
    
    const filters = JSON.parse(filtersParam);
    console.log('Larry: Filters received from URL:', filters);
    
    const config: Partial<RouteConfig> = {};
    
    // Map loading points
    if (filters.loadingPoints && filters.loadingPoints.length > 0) {
      config.loadingPoints = filters.loadingPoints.map((point: any, index: number) => ({
        id: point.id || `lp${index + 1}`,
        locality: point.locality || '',
        postalCode: point.postalCode || '',
        country: point.country || '47_poland',
        latitude: point.latitude || 0,
        longitude: point.longitude || 0,
        range: point.range || 50
      }));
    }
    
    // Map unloading points
    if (filters.unloadingPoints && filters.unloadingPoints.length > 0) {
      config.unloadingPoints = filters.unloadingPoints.map((point: any, index: number) => ({
        id: point.id || `up${index + 1}`,
        locality: point.locality || '',
        postalCode: point.postalCode || '',
        country: point.country || '21_germany',
        latitude: point.latitude || 0,
        longitude: point.longitude || 0,
        range: point.range || 50
      }));
    }
    
    // Map weight filters
    if (filters.minWeight !== undefined && filters.minWeight !== null) {
      config.minWeight = filters.minWeight;
    }
    if (filters.maxWeight !== undefined && filters.maxWeight !== null) {
      config.maxWeight = filters.maxWeight;
    }
    // Map capacity filter from extension
    if (filters.minCapacity !== undefined && filters.minCapacity !== null) {
      config.minCapacity = filters.minCapacity;
    }
    if (filters.maxCapacity !== undefined && filters.maxCapacity !== null) {
      config.maxCapacity = filters.maxCapacity;
    }
    
    return config;
  } catch (error) {
    console.warn('Larry: Failed to parse filters from URL:', error);
    return null;
  }
}