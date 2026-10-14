import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

const cli = resolve('dist/cli.js');
function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

describe('terminal interface', () => {
  it('prints parseable JSON without human messages', () => {
    const result = run('+14155552671', '--json');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true });
  });

  it('renders JSON input errors and returns a nonzero status', () => {
    const result = run('abc', '--json');
    expect(result.status).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('explains help', () => expect(run('--help').stdout).toContain('Default region: NG'));

  it('rejects unknown flags', () => expect(run('+14155552671', '--wat').status).toBe(2));
});
