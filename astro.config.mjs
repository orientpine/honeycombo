import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://honeycombo.orientpine.workers.dev',
  integrations: [sitemap({
    filter: (page) => {
      const path = new URL(page).pathname;
      return path !== '/admin' && path !== '/admin/';
    },
  })],
});
