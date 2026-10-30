import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// runs/ is read-only: route tests get their own temp dir, like test/digest.test.ts.
const tempDirs: string[] = [];

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  tempDirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function configFor(runsDir: string) {
  return { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
}

const BAD_NIGHT_LINES = [
  '{"at":"2026-10-30T01:00:00+01:00","job":"alpha","status":"ok","owner":"rook"}',
  '{"at":"2026-10-30T01:05:00+01:00","job":"beta","status":"fail","owner":null,"error":"boom"}',
  'not json at all',
].join('\n');

describe('GET /digest/:night', () => {
  it('renders 200 HTML with one table, rows sorted by job, null owner as —', async () => {
    const dir = tempRuns({ '2026-10-30.jsonl': BAD_NIGHT_LINES });
    const res = await createApp(configFor(dir)).request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.match(/<table/g)?.length).toBe(1);
    const alphaIndex = html.indexOf('alpha');
    const betaIndex = html.indexOf('beta');
    expect(alphaIndex).toBeGreaterThan(-1);
    expect(betaIndex).toBeGreaterThan(-1);
    expect(alphaIndex).toBeLessThan(betaIndex);
    expect(html).toContain('—');
  });

  it('returns 404 for a night with no file', async () => {
    const dir = tempRuns({});
    const res = await createApp(configFor(dir)).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('renders 200 with "nothing ran" for an empty night', async () => {
    const dir = tempRuns({ '2026-10-31.jsonl': '' });
    const res = await createApp(configFor(dir)).request('/digest/2026-10-31');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still renders 200 with its good rows when a night has a bad line', async () => {
    const dir = tempRuns({ '2026-11-01.jsonl': BAD_NIGHT_LINES });
    const res = await createApp(configFor(dir)).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns 200 JSON matching the Night shape from readNight', async () => {
    const dir = tempRuns({ '2026-10-30.jsonl': BAD_NIGHT_LINES });
    const res = await createApp(configFor(dir)).request('/api/digest/2026-10-30');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-30');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
    expect(body.rows.find((r) => r.job === 'beta')?.owner).toBeNull();
    expect(body.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
  });

  it('returns 404 for a night with no file', async () => {
    const dir = tempRuns({});
    const res = await createApp(configFor(dir)).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('returns rows: [] for an empty night', async () => {
    const dir = tempRuns({ '2026-10-31.jsonl': '' });
    const res = await createApp(configFor(dir)).request('/api/digest/2026-10-31');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line in badLines while keeping the good rows', async () => {
    const dir = tempRuns({ '2026-11-01.jsonl': BAD_NIGHT_LINES });
    const res = await createApp(configFor(dir)).request('/api/digest/2026-11-01');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('same jobs, same order, for the same night', async () => {
    const dir = tempRuns({ '2026-10-30.jsonl': BAD_NIGHT_LINES });
    const app = createApp(configFor(dir));
    const htmlRes = await app.request('/digest/2026-10-30');
    const html = await htmlRes.text();
    const jsonRes = await app.request('/api/digest/2026-10-30');
    const body = (await jsonRes.json()) as Night;

    const htmlOrder = body.rows.map((r) => r.job).filter((job) => html.includes(job));
    expect(htmlOrder).toEqual(body.rows.map((r) => r.job));
    // sanity: the order check above is only meaningful if jobs actually appear in html
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
    const alphaIndex = html.indexOf('alpha');
    const betaIndex = html.indexOf('beta');
    expect(alphaIndex).toBeLessThan(betaIndex);
  });
});
