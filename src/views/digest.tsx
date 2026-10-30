import type { Night } from '../digest/types.js';

// A row is marked .warn when it retried 3+ times or its last run failed.
function warn(row: Night['rows'][number]): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

export function Digest({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <tr class={warn(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && <p class="mute">{night.badLines} bad line(s) skipped</p>}
    </>
  );
}

export function DigestNotFound({ night }: { night: string }) {
  return <p class="warn">no digest for {night}</p>;
}
