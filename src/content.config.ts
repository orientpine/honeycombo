import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { curatedArticleSchema } from './schemas/curated-article';
import { feedArticleSchema } from './schemas/feed-article';
import { influencerSchema } from './schemas/influencer';
import { mustReadSchema } from './schemas/must-read';

const curated = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/curated' }),
  schema: curatedArticleSchema,
});

const feeds = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/feeds' }),
  schema: feedArticleSchema,
});

const mustRead = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/must-read' }),
  schema: mustReadSchema,
});


const influencers = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/influencers' }),
  schema: influencerSchema,
});

export const collections = { curated, feeds, mustRead, influencers };
