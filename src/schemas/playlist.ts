import { z } from 'zod';

export const playlistSchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  description: z.string().max(500).optional(),
  curator: z.string(),
  tags: z.array(z.string()).max(5),
  items: z.array(
    z.object({
      article_id: z.string(),
      added_at: z.coerce.date(),
      note: z.string().max(200).optional(),
    }),
  ),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Playlist = z.infer<typeof playlistSchema>;
