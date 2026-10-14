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
  it('renders each requested format and preserves international as default', () => {
    expect(run('08031234567').stdout).toContain('International number: +234 803 123 4567');
    expect(run('08031234567', '--format', 'national').stdout).toContain('National number: 0803 123 4567');
    expect(run('08031234567', '--format', 'e164').stdout).toContain('E164 number: +2348031234567');
  });
  it('rejects invalid format values and missing values', () => {
    expect(run('08031234567', '--format', 'local').status).toBe(2);
    expect(run('08031234567', '--format').status).toBe(2);
  });
  it('adds formats and type without removing the existing JSON fields', () => {
    const result = JSON.parse(run('08031234567', '--json').stdout);
    expect(result).toMatchObject({ ok: true, number: '+234 803 123 4567', numberType: 'mobile', e164: '+2348031234567' });
    expect(result).toHaveProperty('nationalFormat');
    expect(result).toHaveProperty('internationalFormat');
    expect(result).toHaveProperty('countryName');
  });
});
