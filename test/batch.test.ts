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
  }));
  it('preserves original phone strings in JSON and distinguishes fatal CSV errors',async()=>fixture(async dir=>{
    const input=join(dir,'in.csv'), output=join(dir,'out.json');
    await writeFile(input,'phone\n=not a number\n\n');
    const partial=spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--output-format','json'],{encoding:'utf8'});
    expect(partial.status).toBe(3);
    expect(JSON.parse(await readFile(output,'utf8'))[0].input).toBe('=not a number');
    await writeFile(input,'phone\n"unterminated');
    expect(spawnSync(process.execPath,[cli,'--input',input,'--output',join(dir,'bad.csv')],{encoding:'utf8'}).status).toBe(1);
  }));
});
