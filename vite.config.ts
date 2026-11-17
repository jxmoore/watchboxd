import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// In production Vercel serves api/*.ts as serverless functions.
// In `npm run dev` this plugin routes /api/<name> to the same files, so no Vercel CLI is needed locally.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z-]+)(\?|$)/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          await mod.default(req, res);
        } catch (e) {
          server.ssrFixStacktrace(e as Error);
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (e as Error).message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env values (TMDB_API_KEY) visible to the API handlers in dev. Not exposed to the browser.
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env });
  return { plugins: [react(), localApi()] };
});
