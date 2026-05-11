/**
 * Route Models - Основні моделі для маршрутів
 */

export interface RouteSpot {
  place?: {
    address?: {
      locality?: string;
      postal_code?: string;
      country?: string;
    };
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
    distance?: number;
  };
  operations?: Array<{
    type?: 'loading' | 'unloading';
    timespan?: {
      begin?: string;
      end?: string;
      timezone?: string;
    };
    local_timespan?: {
      begin?: string;
      end?: string;
      timezone?: string;
    };
  }>;
  // Додаткові поля
  [key: string]: any;
}

export interface RouteData {
  id: string;
  route?: {
    id?: string;
    distance?: number;
    distance_override?: number;
  };
  spots?: RouteSpot[];
  freight?: {
    id?: number;
    capacity?: number;
    loading_meters?: number;
  };
  company?: {
    id?: number;
    legal_name?: string;
  };
  price?: {
    value?: number | null;
    currency?: string;
  };
  // Додаткові поля, які можуть бути в реальних даних
  [key: string]: any;
}

export interface FreightOffersResponse {
  _embedded: {
    'freight-offers': RouteData[];
  };
  total: number;
  counters: {
    all: number;
    direct: number;
    private: number;
    multi_ftl: number;
  };
}

/**
 * Валідація та нормалізація даних маршруту
 */
export function validateAndNormalizeRoute(route: any): RouteData | null {
  if (!route || typeof route !== 'object') {
    console.warn('⚠️ Invalid route object:', route);
    return null;
  }

  if (!route.id) {
    console.warn('⚠️ Route missing ID:', route);
    return null;
  }

  // Нормалізуємо структуру
  const normalizedRoute: RouteData = {
    id: route.id,
    route: route.route || {},
    spots: Array.isArray(route.spots) ? route.spots : [],
    freight: route.freight || {},
    company: route.company || {},
    price: route.price || { value: null, currency: 'EUR' },
    ...route // Зберігаємо всі інші поля
  };

  return normalizedRoute;
}

/**
 * Перевірка чи маршрут має мінімально необхідні дані для оптимізації
 */
export function isRouteOptimizable(route: RouteData): boolean {
  return !!(
    route.id &&
    route.route?.distance &&
    route.spots &&
    Array.isArray(route.spots) &&
    route.spots.length > 0
  );
}