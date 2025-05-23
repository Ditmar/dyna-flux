import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

export default defineConfig({
  site: 'http://localhost:4321/',
  output: 'server',
  integrations: [react()],
  adapter: node({
    mode: 'http',
  }),
  vite: {
    ssr: {
      noExternal: ['path-to-regexp', 'astro-seo'],
    },
  },
});
