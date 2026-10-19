#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { lookupPhoneNumber, isSupportedRegion, type LookupResult } from './lookup.js';
import { runBatch } from './batch.js';
import { getMetadataInfo } from './info.js';

const usage = `dialscope - offline phone number information and contact cleaning

Usage:
  dialscope [number] [--region ISO] [--format national|international|e164] [--json]
  dialscope --input FILE --output FILE [--column NAME] [--region ISO] [--output-format csv|json] [--overwrite] [--report]
  dialscope --input FILE --output FILE --clean [--column NAME] [--region ISO]
  dialscope --input FILE --output FILE --dedupe --duplicates-output FILE [--column NAME] [--region ISO] [--overwrite]
  dialscope --info
  dialscope --help

Single-number lookup:
  With no number, prompts for one interactively. Default region: NG.
  National-format digits use --region (default NG); a leading + supplies the country calling code.
  --format selects national, international (default), or e164 human output.
  --json writes one machine-readable result to stdout; diagnostics go to stderr.
  JSON retains the existing number field and includes nationalFormat, internationalFormat,
  e164, and metadata-backed numberType. --info prints version and metadata provenance.

CSV batch lookup:
  Input must have a header row; --column defaults to phone and --region defaults to NG.
  Output defaults to CSV; choose JSON with --output-format json. Existing output requires --overwrite.
  --clean preserves contact columns and adds normalized_phone, extension, row_id, and review status fields.
  --dedupe keeps each first valid identity and requires --duplicates-output for removed rows.
  --report emits a compact JSON summary to stdout; progress messages go to stderr.
  Each input row produces a result; completed batches with row errors exit with status 3.
  Input is limited to 10 MiB and 10,000 data rows. Use dialscope --input FILE --help for batch help.

--info reports package/dependency versions and known bundled metadata freshness (unknown when not published).
Exit codes: 0 success; 1 fatal file, CSV, or processing error; 2 invalid single lookup/options; 3 batch completed with invalid rows.
Metadata describes numbering assignments, not an active line or live location.

API startup:
  npm run start:api     Start from a source checkout on 127.0.0.1:3000.
  dialscope-api         Start the installed API command explicitly.`;

type DisplayFormat = 'national' | 'international' | 'e164';
function renderHuman(result: LookupResult, format: DisplayFormat = 'international', correction = ''): void {
  if (!result.ok) {
    console.error(`Error [${result.error.code}]: ${result.error.message}${correction}`);
    return;
  }
  const labels: Record<DisplayFormat, string> = { national: result.nationalFormat, international: result.internationalFormat, e164: result.e164 };
  console.log(`${format[0]?.toUpperCase()}${format.slice(1)} number: ${labels[format]}`);
  console.log(`Number type: ${result.numberType ?? 'Unknown'}`);
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
  if (args.includes('--input') || args.some((arg) => arg.startsWith('--input='))) return runBatch(args);
  if (args.includes('--info')) {
    if (args.length !== 1) { console.error('Error: --info cannot be combined with lookup or batch options.'); return 2; }
    console.log(JSON.stringify(getMetadataInfo())); return 0;
  }
  const cliArgs = [...args];
  const npmLifecycle = process.env.npm_lifecycle_event === 'dev';
  let json = npmLifecycle && process.env.npm_config_json === 'true';
  let region = npmLifecycle && process.env.npm_config_region && process.env.npm_config_region !== 'true'
    ? process.env.npm_config_region.toUpperCase()
    : 'NG';
  let number: string | undefined;
  let format: DisplayFormat = 'international';
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
    if (argument === '--format') {
      const value = cliArgs[index + 1];
      if (value !== 'national' && value !== 'international' && value !== 'e164') {
        const result: LookupResult = { ok: false, error: { code: 'INVALID_INPUT', message: '--format must be national, international, or e164.' } };
        if (json) console.log(JSON.stringify(result)); else renderHuman(result);
        return exitCode(result);
      }
      format = value; index += 1; continue;
    }
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
      const result: LookupResult = { ok: false, error: { code: 'INVALID_INPUT', message: `Unknown flag "${argument}". Run dialscope --help to see supported options.` } };
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
  if (json) console.log(JSON.stringify(result));
  else renderHuman(result,format,result.ok ? '' : result.error.code === 'INVALID_INPUT'
    ? ' Check the digits and use --region for national-format input.'
    : result.error.code === 'INVALID_REGION' ? ' Choose a supported two-letter ISO region code.' : '');
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
  const result: LookupResult = { ok: false, error: { code: 'DEPENDENCY_FAILURE', message: 'Phone lookup failed unexpectedly. Check the installation and try again.' } };
  const json = process.argv.includes('--json') || (process.env.npm_lifecycle_event === 'dev' && process.env.npm_config_json === 'true');
  if (json) console.log(JSON.stringify(result)); else console.error(`Error [${result.error.code}]: ${result.error.message}`);
  process.exitCode = 1;
}
