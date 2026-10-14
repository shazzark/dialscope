import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('package entry point',()=>{
  it('imports without writing output and exposes the offline lookup',async()=>{
    const entry=pathToFileURL(resolve('dist/index.js')).href;
    const result=spawnSync(process.execPath,['--input-type=module','-e',`const m=await import(${JSON.stringify(entry)}); const r=await m.lookupPhoneNumber('08031234567'); console.log(JSON.stringify({ok:r.ok, hasType: typeof m.isSupportedRegion === 'function'}));`],{encoding:'utf8'});
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ok:true,hasType:true});
  });
});
