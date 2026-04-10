import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://honeycombo.pages.dev',
  integrations: [sitemap()],
});
