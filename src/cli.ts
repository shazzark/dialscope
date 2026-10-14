#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { lookupPhoneNumber, isSupportedRegion, type LookupResult } from './lookup.js';

const usage = `dialscope — offline phone number information\n\nUsage:\n  npm run dev -- [number] [--region ISO] [--json]\n  npm run dev -- --help\n  node dist/cli.js [number] [--region ISO] [--json]\n\nWith no number, prompts for one interactively. Default region: NG.\nNumbers beginning with + use their explicit calling code.\n\nMetadata is numbering-area information, not a live location. Carrier metadata\nidentifies original assignment where available; porting may change the current\nnetwork. Validation does not prove that a number is active. Time zones are\npossible numbering metadata, never the device's live time zone.`;

function renderHuman(result: LookupResult): void {
  if (!result.ok) {
    console.error(`Error [${result.error.code}]: ${result.error.message}`);
    return;
  }
  console.log(`International number: ${result.number}`);
  console.log(`Country calling code: ${result.countryCode}`);
  console.log(`Country: ${result.countryName}`);
  console.log(`Area description: ${result.areaDescription ?? 'Unknown'} (numbering-area information)`);
  console.log(`Original assigned carrier: ${result.originalCarrier ?? 'Unknown'} (may differ after porting)`);
  console.log(`Possible time zones: ${result.timeZones.length ? result.timeZones.join(', ') : 'Unknown'}`);
  console.log('Validation does not prove that a number is active or reveal anyone’s live location.');
}

function exitCode(result: LookupResult): number {
  if (result.ok) return 0;
  return result.error.code === 'INVALID_INPUT' || result.error.code === 'INVALID_REGION' ? 2 : 1;
}

async function main(args: readonly string[]): Promise<number> {
  const cliArgs = [...args];
  const npmLifecycle = process.env.npm_lifecycle_event === 'dev';
  let json = npmLifecycle && process.env.npm_config_json === 'true';
  let region = npmLifecycle && process.env.npm_config_region && process.env.npm_config_region !== 'true'
    ? process.env.npm_config_region.toUpperCase()
    : 'NG';
  let number: string | undefined;
  if (npmLifecycle && process.env.npm_config_region === 'true') {
    const npmConsumedRegion = cliArgs.at(-1);
    if (npmConsumedRegion) {
      cliArgs.pop();
      cliArgs.push('--region', npmConsumedRegion);
    } else {
      cliArgs.push('--region');
    }
  }
  for (let index = 0; index < cliArgs.length; index += 1) {
    const argument = cliArgs[index] ?? '';
    if (argument === '--help' || argument === '-h') {
      if (json) console.log(JSON.stringify({ help: usage })); else console.log(usage);
      return 0;
    }
    if (argument === '--json') { json = true; continue; }
    if (argument === '--region') {
      const value = cliArgs[index + 1];
      if (!value || value.startsWith('--')) {
        const result: LookupResult = { ok: false, error: { code: 'INVALID_REGION', message: '--region requires a two-letter ISO region code.' } };
        if (json) console.log(JSON.stringify(result)); else renderHuman(result);
        return exitCode(result);
      }
      region = value.toUpperCase(); index += 1; continue;
    }
    if (argument.startsWith('-')) {
      const result: LookupResult = { ok: false, error: { code: 'INVALID_INPUT', message: `Unknown flag "${argument}".` } };
      if (json) console.log(JSON.stringify(result)); else renderHuman(result);
      return exitCode(result);
    }
    if (number !== undefined) {
      const result: LookupResult = { ok: false, error: { code: 'INVALID_INPUT', message: 'Provide only one phone number.' } };
      if (json) console.log(JSON.stringify(result)); else renderHuman(result);
      return exitCode(result);
    }
    number = argument;
  }
  if (!isSupportedRegion(region)) {
    const result: LookupResult = { ok: false, error: { code: 'INVALID_REGION', message: `Unsupported region "${region}". Use a supported two-letter ISO region code.` } };
    if (json) console.log(JSON.stringify(result)); else renderHuman(result);
    return exitCode(result);
  }
  if (number === undefined) {
    if (json) {
      const result: LookupResult = { ok: false, error: { code: 'INVALID_INPUT', message: 'A number argument is required in JSON mode.' } };
      console.log(JSON.stringify(result)); return exitCode(result);
    }
    const prompt = createInterface({ input: stdin, output: stdout });
    try { number = (await prompt.question('Phone number: ')).trim(); }
    catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') { console.error('Input cancelled.'); return 130; }
      throw error;
    } finally { prompt.close(); }
  }
  const result = await lookupPhoneNumber(number, region);
  if (json) console.log(JSON.stringify(result)); else renderHuman(result);
  return exitCode(result);
}

const npmForwardedUnknownFlag = process.env.npm_lifecycle_event === 'dev'
  ? Object.entries(process.env).find(([key, value]) => key.startsWith('npm_config_') && key !== 'npm_config_json' && key !== 'npm_config_region' && value === 'true' && !['npm_config_audit', 'npm_config_fund', 'npm_config_save', 'npm_config_update_notifier'].includes(key))?.[0]
  : undefined;

try {
  const args = process.argv.slice(2);
  if (npmForwardedUnknownFlag) args.unshift(`--${npmForwardedUnknownFlag.slice('npm_config_'.length).replaceAll('_', '-')}`);
  process.exitCode = await main(args);
} catch {
  const result: LookupResult = { ok: false, error: { code: 'DEPENDENCY_FAILURE', message: 'Phone lookup failed unexpectedly.' } };
  const json = process.argv.includes('--json') || (process.env.npm_lifecycle_event === 'dev' && process.env.npm_config_json === 'true');
  if (json) console.log(JSON.stringify(result)); else console.error(`Error [${result.error.code}]: ${result.error.message}`);
  process.exitCode = 1;
}
