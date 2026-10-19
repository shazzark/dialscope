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

  it('explains installed CLI modes, exit codes, and API startup', () => {
    const help=run('--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('dialscope [number]');
    expect(help.stdout).toContain('dialscope-api');
    expect(help.stdout).toContain('Exit codes: 0 success');
    expect(help.stdout).toContain('Default region: NG');
    const batchHelp=run('--input','contacts.csv','--help');
    expect(batchHelp.status).toBe(0);
    expect(batchHelp.stdout).toContain('--duplicates-output FILE');
  });
  it('keeps human diagnostics off stdout and gives a correction for invalid numbers', () => {
    const result=run('not a number');
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('use --region for national-format input');
  });
  it('reports package and metadata provenance without changing lookup JSON', () => {
    const info=run('--info');
    expect(info.status).toBe(0);
    expect(JSON.parse(info.stdout)).toMatchObject({packageVersion:'1.1.0',bundledMetadataVersion:'unknown',bundledMetadataDate:'unknown'});
    expect(run('--info','+14155552671').status).toBe(2);
  });

  it('rejects unknown flags with only the help correction', () => {
    const result=run('+14155552671','--wat');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Run dialscope --help');
    expect(result.stderr).not.toContain('Check the digits');
  });
  it('renders each requested format and preserves international as default', () => {
    expect(run('08031234567').stdout).toContain('International number: +234 803 123 4567');
    expect(run('08031234567', '--format', 'national').stdout).toContain('National number: 0803 123 4567');
    expect(run('08031234567', '--format', 'e164').stdout).toContain('E164 number: +2348031234567');
  }, 20000);
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
