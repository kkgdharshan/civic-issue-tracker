import { z } from 'zod';

export const IssueCoordinatesSchema = z.object({
  latitude: z
    .number({ required_error: 'Latitude is required' })
    .min(-90.0, 'Latitude must be between -90 and 90')
    .max(90.0, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ required_error: 'Longitude is required' })
    .min(-180.0, 'Longitude must be between -180 and 180')
    .max(180.0, 'Longitude must be between -180 and 180'),
  accuracyMeters: z.number().optional(),
});

export const CreateIssueSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(150, 'Title cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Please provide comprehensive context (at least 10 characters)')
    .max(5000, 'Description cannot exceed 5000 characters'),
  category: z.enum([
    'INFRASTRUCTURE',
    'PUBLIC_SAFETY',
    'ENVIRONMENTAL',
    'HAZARD',
    'UTILITIES',
  ] as const, {
    errorMap: () => ({ message: 'Please select a valid civic category' }),
  }),
  severity: z.enum([
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL_EMERGENCY',
  ] as const, {
    errorMap: () => ({ message: 'Please specify an emergency severity tier' }),
  }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  mediaUrls: z.array(z.string().url('Invalid asset URI')).max(5, 'Maximum 5 attachments permitted').default([]),
});

export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;
