import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { curatedArticleSchema } from './schemas/curated-article';
import { feedArticleSchema } from './schemas/feed-article';
import { influencerSchema } from './schemas/influencer';
import { mustReadSchema } from './schemas/must-read';
import { playlistSchema } from './schemas/playlist';
import { trendingSchema } from './schemas/trending';

const curated = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/curated' }),
  schema: curatedArticleSchema,
});

const feeds = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/feeds' }),
  schema: feedArticleSchema,
});

const trending = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/trending' }),
  schema: trendingSchema,
});

const mustRead = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/must-read' }),
  schema: mustReadSchema,
});

const playlists = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/playlists' }),
  schema: playlistSchema,
});

const influencers = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/influencers' }),
  schema: influencerSchema,
});

export const collections = { curated, feeds, trending, mustRead, playlists, influencers };
