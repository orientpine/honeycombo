import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  site: 'https://honeycombo.pages.dev',
  integrations: [sitemap()],
  adapter: cloudflare(),
});