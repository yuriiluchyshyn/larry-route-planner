// Types based on the Trans.eu freight-offers API response

export interface Coordinates {
  latitude: number;
  longitude: number;
  range?: number;
}

export interface Address {
  locality: string;
  postal_code: string;
  country: string;
}

export interface Place {
  address: Address;
  coordinates: Coordinates;
  distance: number;
}

export interface Timespan {
  begin: string;
  end: string;
  timezone: string;
}

export interface Operation {
  type: 'loading' | 'unloading';
  timespan: Timespan;
  local_timespan: Timespan;
}

export interface Spot {
  place: Place;
  operations: Operation[];
}

export interface Route {
  id: string;
  distance: number; // in meters
  distance_override: number | null;
}

export interface Requirements {
  shipping_remarks: string | null;
  other_requirements: string[];
  required_ways_of_loading: string[];
  required_truck_bodies: string[];
  vehicle_size: string;
  is_ftl: boolean;
  transport: {
    count: number | null;
    total_weight: number | null;
    type: string;
    settlement: string;
    settlement_basis: string | null;
    schedule_type: string;
  };
  temperature: {
    min: number | null;
    max: number | null;
  };
  expected_monitoring: string;
}

export interface Price {
  value: number | null;
  currency: string;
  dynamic_price_raised: boolean;
}

export interface Freight {
  id: number;
  publication_id: number;
  period: {
    payment: string;
    days: number;
  };
  is_quick_pay: boolean;
  is_roundtrip: boolean;
  route: Route;
  spots: Spot[];
  capacity: number;
  loading_meters: number | null;
  requirements: Requirements;
}

export interface Company {
  id: number;
  legal_name: string;
  certificates: string[];
  is_debtor: boolean;
  safepay: boolean;
}

export interface RatingSummary {
  rate: number;
  rates_count: number;
  ratings_trend: string;
  companies_count: number;
  payment_issues: {
    paid_on_time: number;
    paid_with_delay: number;
    unresolved: number;
  };
}

export interface FreightOffer {
  id: string;
  index: string; // Used for pagination cursor
  created_at: string;
  publish_date: string;
  type: string;
  freight: Freight;
  price: Price;
  company: Company;
  rating_summary: RatingSummary;
}

export interface ApiResponse {
  _embedded: {
    'freight-offers': FreightOffer[];
  };
  total: number;
}

// A single waypoint (loading or unloading location)
export interface WayPoint {
  id: string;
  locality: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  range: number;
}

// Route planner configuration
export interface RouteConfig {
  apiUrl: string;
  bearerToken: string;
  // Multiple loading/unloading points
  loadingPoints: WayPoint[];
  unloadingPoints: WayPoint[];
  // Filter params
  minWeight: number;
  minCapacity: number;
  // Route optimization params
  daysOnRoad: number;
  maxEmptyRunPercent: number;
  minPricePerKm: number;
  homeBase: WayPoint; // start/end point for the lorry
  includeReturnRoute: boolean; // fetch reverse direction offers
  // Departure & return date ranges
  departureFrom: string; // ISO date string (YYYY-MM-DD)
  departureTo: string;
  returnFrom: string;
  returnTo: string;
}

// EU Driving Regulations (EC 561/2006)
export interface EUDrivingRules {
  maxDailyDrivingHours: number; // 9h (can be extended to 10h twice a week)
  maxExtendedDailyDrivingHours: number; // 10h
  maxExtendedDaysPerWeek: number; // 2
  maxWeeklyDrivingHours: number; // 56h
  maxBiWeeklyDrivingHours: number; // 90h over 2 consecutive weeks
  minDailyRestHours: number; // 11h (can be reduced to 9h three times between rests)
  minReducedDailyRestHours: number; // 9h
  maxReducedRestsPerWeek: number; // 3
  minWeeklyRestHours: number; // 45h
  minReducedWeeklyRestHours: number; // 24h
  maxContinuousDrivingHours: number; // 4.5h
  minBreakMinutes: number; // 45min after 4.5h driving
  maxDaysBeforeWeeklyRest: number; // 6 consecutive days
}

// Optimized route segment
export interface RouteSegment {
  offer: FreightOffer;
  from: string;
  to: string;
  distanceKm: number;
  loadingDate: string;
  unloadingDate: string;
  pricePerKm: number | null;
  isEmpty: boolean;
  emptyDistanceKm: number;
  drivingHours: number; // estimated driving hours for this segment
  restStops: number; // number of mandatory breaks needed
}

export interface OptimizedRoute {
  segments: RouteSegment[];
  totalDistanceKm: number;
  loadedDistanceKm: number;
  emptyDistanceKm: number;
  emptyRunPercent: number;
  totalDays: number;
  idleHours: number;
  totalDrivingHours: number;
  totalRestHours: number;
  mandatoryBreaks: number;
  weeklyRestsNeeded: number;
  score: number;
  euCompliant: boolean;
}
