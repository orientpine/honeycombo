import { z } from 'zod';

export const feedArticleSchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  url: z.string().url(),
  source: z.string(),
  type: z.enum(['article', 'youtube', 'x_thread', 'threads', 'other']).default('article'),
  thumbnail_url: z.string().url().optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(5),
  published_at: z.coerce.date(),
  feed_id: z.string(),
});

export type FeedArticle = z.infer<typeof feedArticleSchema>;
