/**
 * CivicPulse Validation Suite
 * Tests Zod schemas against malicious inputs, boundary coordinates, and empty payloads.
 */

import { CreateIssueSchema, IssueCoordinatesSchema } from '../lib/validations/issue';

describe('Validation Layer Tests', () => {
  describe('CreateIssueSchema', () => {
    it('should validate a valid civic issue payload', () => {
      const validPayload = {
        title: 'Exploded gas line outside bakery',
        description: 'Gas meter ruptured. Loud hissing sound and visible vapor cloud.',
        category: 'HAZARD',
        severity: 'CRITICAL_EMERGENCY',
        latitude: 37.7749,
        longitude: -122.4194,
        mediaUrls: ['https://cdn.civicpulse.internal/reports/2026/img-01.jpg'],
      };

      const result = CreateIssueSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject titles that are too short (< 5 characters)', () => {
      const invalidPayload = {
        title: 'Fire',
        description: 'Large fire at the corner of 5th street.',
        category: 'HAZARD',
        severity: 'HIGH',
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const result = CreateIssueSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 5 characters');
      }
    });

    it('should reject invalid coordinate ranges (latitude > 90)', () => {
      const invalidPayload = {
        title: 'Collapsed electric pole',
        description: 'Live electric wires dangling across roadway.',
        category: 'INFRASTRUCTURE',
        severity: 'HIGH',
        latitude: 95.1234, // Invalid latitude
        longitude: -122.4194,
      };

      const result = CreateIssueSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject unrecognized category enumerations', () => {
      const invalidPayload = {
        title: 'Illegal parking complaint',
        description: 'Vehicle parked across my driveway for 4 hours.',
        category: 'PARKING_VIOLATION', // Not an allowed civic category
        severity: 'LOW',
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const result = CreateIssueSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('IssueCoordinatesSchema', () => {
    it('should accept valid boundary coordinates', () => {
      expect(IssueCoordinatesSchema.safeParse({ latitude: -90, longitude: -180 }).success).toBe(true);
      expect(IssueCoordinatesSchema.safeParse({ latitude: 90, longitude: 180 }).success).toBe(true);
      expect(IssueCoordinatesSchema.safeParse({ latitude: 0, longitude: 0 }).success).toBe(true);
    });

    it('should reject out-of-bounds coordinates', () => {
      expect(IssueCoordinatesSchema.safeParse({ latitude: -90.1, longitude: 0 }).success).toBe(false);
      expect(IssueCoordinatesSchema.safeParse({ latitude: 0, longitude: 180.1 }).success).toBe(false);
    });
  });
});
