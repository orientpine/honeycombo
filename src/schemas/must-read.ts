import { z } from 'zod';

export const mustReadSchema = z.object({
  id: z.string(),
  date: z.string(),
  items: z.array(z.string()),
  pinned_by: z.string().optional(),
});

export type MustRead = z.infer<typeof mustReadSchema>;
