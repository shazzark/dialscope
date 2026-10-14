import { open, readFile, realpath, stat, link, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { isSupportedRegion, lookupPhoneNumber, type LookupResult } from './lookup.js';

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_DATA_ROWS = 10_000;
const columns = ['row_id','input','lookup_status','number','national_format','international_format','e164','country_code','country_name','area_description','original_carrier','number_type','time_zones','error_code','error_message'] as const;
type Row = Record<string, string>;

function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Unknown file or processing error.'; }
function formulaSafe(value: string): string {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
}
function outputRow(id: number, input: string, result: LookupResult): Record<string, string | number> {
  if (!result.ok) return { row_id: id, input, lookup_status: 'error', number: '', national_format: '', international_format: '', e164: '', country_code: '', country_name: '', area_description: '', original_carrier: '', number_type: '', time_zones: '[]', error_code: result.error.code, error_message: result.error.message };
  return { row_id: id, input, lookup_status: 'success', number: result.number, national_format: result.nationalFormat, international_format: result.internationalFormat, e164: result.e164, country_code: result.countryCode, country_name: result.countryName, area_description: result.areaDescription ?? '', original_carrier: result.originalCarrier ?? '', number_type: result.numberType ?? '', time_zones: JSON.stringify(result.timeZones), error_code: '', error_message: '' };
}
async function sameFile(input: string, output: string): Promise<boolean> {
  const inputPath = resolve(input), outputPath = resolve(output);
  if (process.platform === 'win32' ? inputPath.toLowerCase() === outputPath.toLowerCase() : inputPath === outputPath) return true;
  try {
    const [a,b] = await Promise.all([stat(inputPath), stat(outputPath)]);
    if (a.dev === b.dev && a.ino === b.ino) return true;
  } catch { /* A not-yet-existing output is checked using its canonical parent below. */ }
  try {
    const [parent, source] = await Promise.all([realpath(dirname(outputPath)), realpath(inputPath)]);
    const canonicalOutput = join(parent, basename(outputPath));
    return process.platform === 'win32' ? source.toLowerCase() === canonicalOutput.toLowerCase() : source === canonicalOutput;
  } catch { return false; }
}

export async function runBatch(args: readonly string[]): Promise<number> {
  const options = new Map<string, string>(); let overwrite = false; let json = false; let positional = false;
  for (let i=0; i<args.length; i+=1) {
    const arg=args[i] ?? '';
    if (arg === '--overwrite') { overwrite=true; continue; }
    if (arg === '--json') { json=true; continue; }
    if (['--input','--column','--output','--output-format','--region'].includes(arg)) {
      const value=args[++i]; if (!value || value.startsWith('--')) { console.error(`Fatal error: ${arg} requires a value.`); return 1; }
      options.set(arg,value); continue;
    }
    if (arg === '--help' || arg === '-h') return 1;
    if (arg.startsWith('-') || positional) { console.error('Fatal error: batch options cannot be combined with a positional phone number or unknown flags.'); return 1; }
    positional=true;
  }
  if (positional) { console.error('Fatal error: a single phone number cannot be combined with batch flags.'); return 1; }
  if (!options.has('--input') || !options.has('--output')) { console.error('Fatal error: batch mode requires --input and --output.'); return 1; }
  if (json || options.has('--json') || options.has('--format')) { console.error('Fatal error: --json/--format single-lookup flags cannot be combined with batch mode.'); return 1; }
  const inputPath=resolve(options.get('--input')!), outputPath=resolve(options.get('--output')!);
  const region=options.get('--region') ?? 'NG'; const column=options.get('--column') ?? 'phone'; const outputFormat=options.get('--output-format') ?? 'csv';
  if (!isSupportedRegion(region)) { console.error('Fatal error: unsupported --region.'); return 1; }
  if (outputFormat !== 'csv' && outputFormat !== 'json') { console.error('Fatal error: --output-format must be csv or json.'); return 1; }
  try {
    if (await sameFile(inputPath,outputPath)) throw new Error('Input and output paths refer to the same file.');
    if (!overwrite) { try { await stat(outputPath); throw new Error('Output already exists; pass --overwrite to replace it.'); } catch (e) { if (e instanceof Error && e.message.includes('already exists')) throw e; } }
    const inputBytes=await readFile(inputPath);
    if (inputBytes.byteLength > MAX_INPUT_BYTES) throw new Error(`Input exceeds the ${MAX_INPUT_BYTES} byte limit.`);
    if (inputBytes.byteLength === 0) throw new Error('Input file is empty; a header row is required.');
    const records=parse(inputBytes,{bom:true,columns:(headers: string[])=>{
      if (!headers.length || headers.some(h=>!h.trim()) || new Set(headers).size!==headers.length) throw new Error('CSV must have non-empty, unique headers.');
      if (!headers.includes(column)) throw new Error(`CSV is missing the requested ${column} column.`);
      return headers;
    },skip_empty_lines:true,max_record_size:MAX_INPUT_BYTES}) as Row[];
    if (records.length > MAX_DATA_ROWS) throw new Error(`Input exceeds the ${MAX_DATA_ROWS} data-row limit.`);
    const rows: Record<string,string|number>[]=[];
    for (let i=0;i<records.length;i+=1) {
      const original=records[i]?.[column] ?? '';
      const result=original.trim() ? await lookupPhoneNumber(original,region) : {ok:false as const,error:{code:'INVALID_INPUT' as const,message:'Phone cell is empty.'}};
      rows.push(outputRow(i+1,original,result));
    }
    const body=outputFormat==='json' ? JSON.stringify(rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v]))),null,2)+'\n'
      : stringify(rows,{header:true,columns:[...columns],record_delimiter:'\r\n',cast:{string:(v:string)=>formulaSafe(v)}});
    await writeAtomic(outputPath,body,overwrite);
    const failures=rows.filter(r=>r.lookup_status==='error').length;
    console.log(`Wrote ${rows.length} rows to ${outputPath}; ${failures} row error(s).`);
    return failures ? 3 : 0;
  } catch (error) { console.error(`Fatal error: ${errorText(error)}`); return 1; }
}

async function writeAtomic(target: string, body: string, overwrite: boolean): Promise<void> {
  const temp=join(dirname(target),`.${basename(target)}.${randomUUID()}.tmp`); let handle;
  try {
    handle=await open(temp,'wx',0o600); await handle.writeFile(body,'utf8'); await handle.close(); handle=undefined;
    if (overwrite) await rename(temp,target); else await link(temp,target);
  } finally {
    if (handle) await handle.close().catch(()=>undefined);
    await unlink(temp).catch(()=>undefined);
  }
}
