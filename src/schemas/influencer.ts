import { z } from 'zod';

export const influencerSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.enum(['x', 'threads', 'blog', 'youtube']),
  handle: z.string(),
  bio: z.string().max(300).optional(),
});

export type Influencer = z.infer<typeof influencerSchema>;
