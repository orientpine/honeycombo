import { z } from 'zod';

export const curatedArticleSchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  url: z.string().url(),
  source: z.string(),
  type: z.enum(['article', 'youtube', 'x_thread', 'threads', 'other']),
  thumbnail_url: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).min(1).max(5),
  submitted_by: z.string().optional(),
  submitted_by_id: z.string().optional(),
  submitted_at: z.coerce.date(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  engagement: z
    .object({
      views: z.number().int().min(0).default(0),
      reactions: z.number().int().min(0).default(0),
      sources_count: z.number().int().min(0).default(0),
    })
    .optional(),
});

export type CuratedArticle = z.infer<typeof curatedArticleSchema>;
