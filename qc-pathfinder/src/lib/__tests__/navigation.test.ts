import { describe, expect, it } from 'vitest';
import {
  calculateRemainingAlongRoute,
  filterAccuracy,
  isArrived,
  isOffCampus,
  isOffRoute,
  QC_CAMPUS_BOUNDS,
} from '../navigation';

describe('Navigation and Geolocation Engine', () => {
  describe('Off-Campus Detection', () => {
    it('returns false for points inside Queens College campus', () => {
      // Kiely Hall
      const kielyCoords: [number, number] = [-73.8160, 40.7360];
      expect(isOffCampus(kielyCoords, QC_CAMPUS_BOUNDS)).toBe(false);

      // Rosenthal Library
      const rosenthalCoords: [number, number] = [-73.8190, 40.7365];
      expect(isOffCampus(rosenthalCoords, QC_CAMPUS_BOUNDS)).toBe(false);
    });

    it('returns false for points right outside campus within 300m threshold', () => {
      // Just across Kissena Blvd (approx 80m from east campus boundary)
      const nearKissena: [number, number] = [-73.8100, 40.7360];
      expect(isOffCampus(nearKissena, QC_CAMPUS_BOUNDS, 300)).toBe(false);
    });

    it('returns true for points more than 300m outside campus bounds', () => {
      // Flushing Main St (far north, > 1.5km away)
      const flushingMainSt: [number, number] = [-73.8300, 40.7580];
      expect(isOffCampus(flushingMainSt, QC_CAMPUS_BOUNDS, 300)).toBe(true);

      // Manhattan Times Square
      const timesSquare: [number, number] = [-73.9855, 40.7580];
      expect(isOffCampus(timesSquare, QC_CAMPUS_BOUNDS, 300)).toBe(true);
    });
  });

  describe('Accuracy Filtering', () => {
    it('accepts high-accuracy readings (<= 100m) for navigation', () => {
      const goodGps = filterAccuracy(8);
      expect(goodGps.validForNav).toBe(true);
      expect(goodGps.weakSignal).toBe(false);

      const acceptableGps = filterAccuracy(45);
      expect(acceptableGps.validForNav).toBe(true);
      expect(acceptableGps.weakSignal).toBe(false);
    });

    it('flags readings worse than 100m as weak signal and invalid for navigation', () => {
      const weakReading = filterAccuracy(120);
      expect(weakReading.validForNav).toBe(false);
      expect(weakReading.weakSignal).toBe(true);

      const cellTowerRough = filterAccuracy(800);
      expect(cellTowerRough.validForNav).toBe(false);
      expect(cellTowerRough.weakSignal).toBe(true);
    });
  });

  describe('Off-Route Detection', () => {
    // A straight horizontal path on campus along latitude 40.7360
    const route: Array<[number, number]> = [
      [-73.8180, 40.7360],
      [-73.8160, 40.7360],
      [-73.8140, 40.7360],
    ];

    it('returns false when user is on or very close to the route (< 30m)', () => {
      // Exactly on path
      expect(isOffRoute([-73.8160, 40.7360], route, 30)).toBe(false);

      // ~10m offset to the north (0.00009 deg lat ~ 10m)
      const nearPath: [number, number] = [-73.8160, 40.73609];
      expect(isOffRoute(nearPath, route, 30)).toBe(false);
    });

    it('returns true when user drifts more than 30m off the route', () => {
      // ~60m offset to the north (0.00054 deg lat ~ 60m)
      const farOffPath: [number, number] = [-73.8160, 40.73654];
      expect(isOffRoute(farOffPath, route, 30)).toBe(true);
    });
  });

  describe('Arrival Detection', () => {
    const destinationAccessPoints: Array<[number, number]> = [
      [-73.81615, 40.73620], // Kiely North entrance
      [-73.81625, 40.73580], // Kiely South entrance
    ];

    it('returns true when user is within 25m of any destination access point', () => {
      // 10m from North entrance
      const closeUser: [number, number] = [-73.81615, 40.73628];
      expect(isArrived(closeUser, destinationAccessPoints, 25)).toBe(true);
    });

    it('returns false when user is further than 25m from all access points', () => {
      // 50m away
      const distantUser: [number, number] = [-73.81615, 40.73665];
      expect(isArrived(distantUser, destinationAccessPoints, 25)).toBe(false);
    });
  });

  describe('Remaining Distance Calculation Along Route', () => {
    // Route from point A to point B to point C
    // ~168m from A to B, ~168m from B to C = Total ~336m
    const routeCoords: Array<[number, number]> = [
      [-73.8180, 40.7360],
      [-73.8160, 40.7360],
      [-73.8140, 40.7360],
    ];

    it('computes accurate remaining and walked distance as user progresses', () => {
      // Start of route
      const atStart = calculateRemainingAlongRoute([-73.8180, 40.7360], routeCoords);
      expect(atStart.walkedDistanceMeters).toBeCloseTo(0, 0);
      expect(atStart.remainingDistanceMeters).toBeGreaterThan(300);

      // Midpoint of route (at point B)
      const atMid = calculateRemainingAlongRoute([-73.8160, 40.7360], routeCoords);
      expect(atMid.walkedDistanceMeters).toBeGreaterThan(150);
      expect(atMid.remainingDistanceMeters).toBeGreaterThan(150);
      expect(atMid.walkedDistanceMeters + atMid.remainingDistanceMeters).toBeCloseTo(
        atStart.remainingDistanceMeters,
        0
      );

      // End of route
      const atEnd = calculateRemainingAlongRoute([-73.8140, 40.7360], routeCoords);
      expect(atEnd.remainingDistanceMeters).toBeCloseTo(0, 0);
      expect(atEnd.walkedDistanceMeters).toBeGreaterThan(300);
    });
  });
});
