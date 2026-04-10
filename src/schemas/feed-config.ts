import { z } from 'zod';

export const feedConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  category: z.string(),
  enabled: z.boolean(),
});

export type FeedConfig = z.infer<typeof feedConfigSchema>;
