import { z } from 'zod';

export const trendingSchema = z.object({
  id: z.string(),
  week: z.string(),
  generated_at: z.coerce.date(),
  not_enough_data: z.boolean().optional(),
  items: z.array(
    z.object({
      rank: z.number().int().min(1),
      keyword: z.string(),
      score: z.number(),
      direction: z.enum(['rising', 'stable', 'falling']),
      velocity: z.number(),
      article_count: z.number().int().min(0),
      top_articles: z.array(z.string()),
    }),
  ),
});

export type Trending = z.infer<typeof trendingSchema>;
