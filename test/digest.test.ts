import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// runs/ is read-only: other cases get a temp dir.
function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs sorted by job, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n?.badLines).toBe(1);
    expect(n?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(n?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('folds a job into one row, times kept with their offset', () => {
    const rows = readNight('runs', '2026-10-28')?.rows ?? [];
    expect(rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(rows.find((r) => r.job === 'lane/sync')).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok' });
  });

  it('keeps a row whose owner is null', () => {
    const rows = readNight('runs', '2026-10-28')?.rows ?? [];
    expect(rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });

  it('returns null for a night with no file, or a name that is not a night', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('reads an empty file as a night where nothing ran', () => {
    const dir = tempRuns({ '2026-10-30.jsonl': '' });
    expect(readNight(dir, '2026-10-30')).toEqual({ night: '2026-10-30', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts valid JSON with the wrong shape as bad', () => {
    const dir = tempRuns({
      '2026-10-30.jsonl': [
        '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"done","owner":"rook"}',
        '{"job":"a","status":"ok","owner":"rook"}',
        '[1,2]',
        'null',
      ].join('\n'),
    });
    const n = readNight(dir, '2026-10-30');
    expect(n?.badLines).toBe(4);
    expect(n?.rows).toHaveLength(1);
  });
});
