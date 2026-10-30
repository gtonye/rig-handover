// Plan morning-digest § 1. One row per job in runs/<night>.jsonl. Times stay as written in the
// log, offset included. `owner` stays null here; views show it as `—`.
export type Status = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: Status;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// null = no file for that night (404). rows = [] = empty file ("nothing ran"). Rows sorted by
// job; badLines = lines that didn't parse or had the wrong shape; counts = lines per status.
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: Record<Status, number>;
};

export type ReadNight = (runsDir: string, night: string) => Night | null;
