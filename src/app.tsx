import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Digest, DigestNotFound } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (!night) {
      return c.html(
        <Layout title="digest" lane={lane()}>
          <DigestNotFound night={c.req.param('night')} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title="digest" lane={lane()}>
        <Digest night={night} />
      </Layout>,
    );
  });

  // Same reader the page uses (#2a), so the page and this JSON cannot disagree (ADR 0001).
  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (!night) return c.json({ error: 'no digest for that night' }, 404);
    return c.json(night);
  });

  return app;
}
