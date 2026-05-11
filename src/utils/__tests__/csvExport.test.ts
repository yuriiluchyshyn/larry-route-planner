import { describe, test, expect, vi } from 'vitest';
import { exportOffersToCSV, exportRoutesToCSV, generateTimestampedFilename } from '../csvExport';
import type { FreightOffer, OptimizedRoute } from '../../types';

// Mock DOM methods
Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

Object.defineProperty(global, 'Blob', {
  value: class MockBlob {
    constructor(public content: any[], public options: any) {}
  },
});

// Mock document methods
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(() => ({
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {},
    })),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  },
});

// Mock alert
global.alert = vi.fn();

describe('CSV Export Utils', () => {
  describe('generateTimestampedFilename', () => {
    test('should generate filename with timestamp', () => {
      const filename = generateTimestampedFilename('test-file');
      expect(filename).toMatch(/^test-file-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    });

    test('should support custom extension', () => {
      const filename = generateTimestampedFilename('test-file', 'xlsx');
      expect(filename).toMatch(/^test-file-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.xlsx$/);
    });
  });

  describe('exportOffersToCSV', () => {
    test('should show alert for empty offers array', () => {
      exportOffersToCSV([]);
      expect(global.alert).toHaveBeenCalledWith('Немає пропозицій для експорту');
    });

    test('should process offers correctly', () => {
      const mockOffer: FreightOffer = {
        id: 'test-1',
        index: '1',
        created_at: '2024-01-01T00:00:00Z',
        publish_date: '2024-01-01T00:00:00Z',
        type: 'freight',
        company: {
          id: 1,
          legal_name: 'Test Company',
          certificates: [],
          is_debtor: false,
          safepay: true,
        },
        price: {
          value: 1500,
          currency: 'EUR',
          dynamic_price_raised: false,
        },
        freight: {
          id: 1,
          publication_id: 1,
          period: { payment: 'NET', days: 30 },
          is_quick_pay: false,
          is_roundtrip: false,
          route: { id: '1', distance: 500000, distance_override: null },
          spots: [
            {
              place: {
                address: { locality: 'Warsaw', postal_code: '00-001', country: 'Poland' },
                coordinates: { latitude: 52.2297, longitude: 21.0122 },
                distance: 0,
              },
              operations: [{ type: 'loading', timespan: { begin: '2024-01-15T08:00:00Z', end: '2024-01-15T10:00:00Z', timezone: 'UTC' }, local_timespan: { begin: '2024-01-15T08:00:00Z', end: '2024-01-15T10:00:00Z', timezone: 'UTC' } }],
            },
            {
              place: {
                address: { locality: 'Berlin', postal_code: '10115', country: 'Germany' },
                coordinates: { latitude: 52.5200, longitude: 13.4050 },
                distance: 500,
              },
              operations: [{ type: 'unloading', timespan: { begin: '2024-01-16T14:00:00Z', end: '2024-01-16T16:00:00Z', timezone: 'UTC' }, local_timespan: { begin: '2024-01-16T14:00:00Z', end: '2024-01-16T16:00:00Z', timezone: 'UTC' } }],
            },
          ],
          capacity: 24,
          loading_meters: null,
          requirements: {
            shipping_remarks: null,
            other_requirements: [],
            required_ways_of_loading: [],
            required_truck_bodies: [],
            vehicle_size: 'MEGA',
            is_ftl: true,
            transport: { count: null, total_weight: 20000, type: 'GENERAL', settlement: 'PER_LOAD', settlement_basis: null, schedule_type: 'ASAP' },
            temperature: { min: null, max: null },
            expected_monitoring: 'NONE',
          },
        },
        rating_summary: {
          rate: 4.5,
          rates_count: 100,
          ratings_trend: 'STABLE',
          companies_count: 1,
          payment_issues: { paid_on_time: 95, paid_with_delay: 5, unresolved: 0 },
        },
      } as FreightOffer;

      // Should not throw and should call document methods
      expect(() => exportOffersToCSV([mockOffer], 'test.csv')).not.toThrow();
    });
  });

  describe('exportRoutesToCSV', () => {
    test('should show alert for empty routes array', () => {
      exportRoutesToCSV([]);
      expect(global.alert).toHaveBeenCalledWith('Немає маршрутів для експорту');
    });

    test('should process routes correctly', () => {
      const mockOffer: FreightOffer = {
        id: 'test-1',
        index: '1',
        created_at: '2024-01-01T00:00:00Z',
        publish_date: '2024-01-01T00:00:00Z',
        type: 'freight',
        company: {
          id: 1,
          legal_name: 'Test Company',
          certificates: [],
          is_debtor: false,
          safepay: true,
        },
        price: {
          value: 1500,
          currency: 'EUR',
          dynamic_price_raised: false,
        },
        freight: {} as any,
        rating_summary: {} as any,
      };

      const mockRoute: OptimizedRoute = {
        segments: [
          {
            offer: mockOffer,
            from: 'Warsaw',
            to: 'Berlin',
            distanceKm: 500,
            loadingDate: '2024-01-15',
            unloadingDate: '2024-01-16',
            pricePerKm: 3.0,
            isEmpty: false,
            emptyDistanceKm: 0,
            drivingHours: 6,
            restStops: 1,
          },
        ],
        totalDistanceKm: 500,
        loadedDistanceKm: 500,
        emptyDistanceKm: 0,
        emptyRunPercent: 0,
        totalDays: 2,
        idleHours: 0,
        totalDrivingHours: 6,
        totalRestHours: 11,
        mandatoryBreaks: 1,
        weeklyRestsNeeded: 0,
        score: 85,
        euCompliant: true,
      };

      // Should not throw and should call document methods
      expect(() => exportRoutesToCSV([mockRoute], 'test.csv')).not.toThrow();
    });
  });
});