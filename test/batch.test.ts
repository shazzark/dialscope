import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';

const cli=join(process.cwd(),'dist','cli.js');
async function fixture(run:(dir:string)=>Promise<void>) { const dir=await mkdtemp(join(tmpdir(),'dialscope-batch-')); try { await run(dir); } finally { await rm(dir,{recursive:true,force:true}); } }
describe('CSV batch mode',()=>{
  it('preserves order and duplicates, handles BOM/quoted cells/CRLF, and isolates invalid rows',async()=>fixture(async dir=>{
    const input=join(dir,'numbers.csv'), output=join(dir,'results.csv');
    await writeFile(input,'\uFEFFphone,note\r\n08031234567,"first, quoted"\r\ninvalid,x\r\n08031234567,duplicate\r\n', 'utf8');
    const result=spawnSync(process.execPath,[cli,'--input',input,'--column','phone','--output',output],{encoding:'utf8'});
    expect(result.status).toBe(3);
    const records=parse(await readFile(output),{columns:true}) as Record<string,string>[];
    expect(records.map(r=>r.row_id)).toEqual(['1','2','3']);
    expect(records.map(r=>r.lookup_status)).toEqual(['success','error','success']);
    expect(records[0]?.input).toBe('08031234567');
    expect(records[0]?.time_zones).toBe('["Africa/Lagos"]');
    expect(records[0]?.e164).toBe("'+2348031234567");
  }));
  it('escapes spreadsheet formulas and refuses output overwrite and input aliases',async()=>fixture(async dir=>{
    const input=join(dir,'in.csv'), output=join(dir,'out.csv');
    await writeFile(input,'phone\n+2348031234567\n');
    const first=spawnSync(process.execPath,[cli,'--input',input,'--output',output],{encoding:'utf8'});
    expect(first.status).toBe(0);
    expect(await readFile(output,'utf8')).toContain("'+2348031234567");
    expect(spawnSync(process.execPath,[cli,'--input',input,'--output',output],{encoding:'utf8'}).status).toBe(1);
    expect(spawnSync(process.execPath,[cli,'--input',input,'--output',input,'--overwrite'],{encoding:'utf8'}).status).toBe(1);
    expect((await readFile(input,'utf8')).startsWith('phone')).toBe(true);
  }),20000);
  it('preserves original phone strings in JSON and distinguishes fatal CSV errors',async()=>fixture(async dir=>{
    const input=join(dir,'in.csv'), output=join(dir,'out.json');
    await writeFile(input,'phone\n=not a number\n\n');
    const partial=spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--output-format','json'],{encoding:'utf8'});
    expect(partial.status).toBe(3);
    expect(JSON.parse(await readFile(output,'utf8'))[0].input).toBe('=not a number');
    await writeFile(input,'phone\n"unterminated');
    expect(spawnSync(process.execPath,[cli,'--input',input,'--output',join(dir,'bad.csv')],{encoding:'utf8'}).status).toBe(1);
  }));
  it('cleans equivalent formats, retains contact columns and reports deterministic duplicate removals',async()=>fixture(async dir=>{
    const input=join(dir,'contacts.csv'), output=join(dir,'clean.csv'), duplicates=join(dir,'duplicates.csv');
    await writeFile(input,'phone,name,email,group\n08031234567,Ada,ada@example.test,one\n+234 803 123 4567,Ada copy,copy@example.test,two\n08031234567 ext 42,Extension,ext@example.test,three\n08031234567 ext 43,Other extension,other@example.test,four\nnot a number,Bad,bad@example.test,five\n');
    const result=spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--clean','--dedupe','--duplicates-output',duplicates],{encoding:'utf8'});
    expect(result.status).toBe(3);
    const cleaned=parse(await readFile(output),{columns:true}) as Record<string,string>[];
    const removed=parse(await readFile(duplicates),{columns:true}) as Record<string,string>[];
    expect(cleaned.map(row=>row.row_id)).toEqual(['1','3','4','5']);
    expect(cleaned.map(row=>row.name)).toEqual(['Ada','Extension','Other extension','Bad']);
    expect(cleaned.map(row=>row.normalized_phone)).toEqual(["'+2348031234567","'+2348031234567","'+2348031234567",'']);
    expect(cleaned[1]?.extension).toBe('42');
    expect(cleaned[2]?.extension).toBe('43');
    expect(cleaned[3]?.error_message).toContain('invalid');
    expect(removed.map(row=>[row.row_id,row.duplicate_of_row_id,row.name])).toEqual([['2','1','Ada copy']]);
  }));
  it('rejects deduplication without its review output and protects every artifact path',async()=>fixture(async dir=>{
    const input=join(dir,'in.csv'), output=join(dir,'out.csv'), duplicates=join(dir,'dupes.csv');
    await writeFile(input,'phone,note\n08031234567,ok\n');
    expect(spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--dedupe'],{encoding:'utf8'}).status).toBe(1);
    expect(spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--dedupe','--duplicates-output',input],{encoding:'utf8'}).status).toBe(1);
    expect(spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--dedupe','--duplicates-output',duplicates],{encoding:'utf8'}).status).toBe(0);
  }));
  it('emits reconciled JSON summary on stdout and progress on stderr',async()=>fixture(async dir=>{
    const input=join(dir,'in.csv'), output=join(dir,'out.csv');
    await writeFile(input,'phone\n08031234567\n+2348031234567\n08031234567 ext 42\ninvalid\n');
    const result=spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--report'],{encoding:'utf8'});
    expect(result.status).toBe(3);
    const summary=JSON.parse(result.stdout) as Record<string,unknown>;
    expect(summary).toMatchObject({totalDataRows:4,validCount:3,invalidCount:1,uniqueValidNumberIdentities:2,duplicateRowCount:1,duplicateGroupCount:1,countryBreakdown:{Nigeria:3},numberTypeBreakdown:{mobile:3}});
    expect(result.stderr).toContain('Wrote 4 rows');
  }));
  it('rejects the configured data-row limit before processing rows',async()=>fixture(async dir=>{
    const input=join(dir,'many.csv'), output=join(dir,'out.csv');
    await writeFile(input,`phone\n${'invalid\n'.repeat(10_001)}`);
    const result=spawnSync(process.execPath,[cli,'--input',input,'--output',output],{encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('10000 data-row limit');
  }));
});
