import { z } from 'zod';

export const influencerSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.enum(['x', 'threads', 'blog', 'youtube']),
  handle: z.string(),
  bio: z.string().max(300).optional(),
  opinions: z.array(
    z.object({
      text: z.string().max(500),
      source_url: z.string().url(),
      date: z.coerce.date(),
      topic: z.string(),
    }),
  ).optional().default([]),
});

export type Influencer = z.infer<typeof influencerSchema>;
