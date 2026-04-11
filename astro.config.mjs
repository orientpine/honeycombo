import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://honeycombo.orientpine.workers.dev',
  integrations: [sitemap()],
});
