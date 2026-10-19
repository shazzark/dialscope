import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { API_BODY_LIMIT_BYTES, API_LOOKUP_REQUEST_LIMIT, createApiApp } from '../src/api.js';

const apps: FastifyInstance[]=[];
async function app(options:Parameters<typeof createApiApp>[0]={}):Promise<FastifyInstance> {
  const instance=await createApiApp(options); apps.push(instance); return instance;
}
afterEach(async()=>{await Promise.all(apps.splice(0).map(instance=>instance.close()));});

describe('Fastify API',()=>{
  it('serves health and metadata-backed single-number lookup',async()=>{
    const server=await app();
    expect((await server.inject({method:'GET',url:'/health'})).json()).toEqual({status:'ok'});
    const response=await server.inject({method:'POST',url:'/v1/phone/lookup',payload:{phoneNumber:'08031234567'}});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ok:true,e164:'+2348031234567',numberType:'mobile'});
    const invalid=await server.inject({method:'POST',url:'/v1/phone/lookup',payload:{phoneNumber:'not a number'}});
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({error:{code:'INVALID_INPUT'}});
  });

  it('defines the per-server lookup request ceiling',()=>expect(API_LOOKUP_REQUEST_LIMIT).toBe(20));

  it('rejects malformed and oversized bodies with typed errors',async()=>{
    const server=await app();
    const malformed=await server.inject({method:'POST',url:'/v1/phone/lookup',payload:{phoneNumber:'08031234567',extra:'private'}});
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({error:{code:'INVALID_REQUEST'}});
    const oversized=await server.inject({method:'POST',url:'/v1/phone/lookup/batch',headers:{'content-type':'application/json'},payload:`{"phoneNumbers":["${'x'.repeat(API_BODY_LIMIT_BYTES)}"]}`});
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toMatchObject({error:{code:'PAYLOAD_TOO_LARGE'}});
    const tooMany=await server.inject({method:'POST',url:'/v1/phone/lookup/batch',payload:{phoneNumbers:Array.from({length:101},()=>'+2348031234567')}});
    expect(tooMany.statusCode).toBe(400);
    const wrongType=await server.inject({method:'POST',url:'/v1/phone/lookup',headers:{'content-type':'text/plain'},payload:'hello'});
    expect(wrongType.statusCode).toBe(415);
    expect(wrongType.json()).toMatchObject({error:{code:'UNSUPPORTED_MEDIA_TYPE'}});
    const missing=await server.inject({method:'GET',url:'/missing'});
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({error:{code:'NOT_FOUND'}});
  });

  it('returns per-row partial failures and extension-aware batch summary',async()=>{
    const server=await app();
    const response=await server.inject({method:'POST',url:'/v1/phone/lookup/batch',payload:{phoneNumbers:['08031234567','+2348031234567','08031234567 ext 42','invalid']}});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results:[{ok:true,e164:'+2348031234567'},{ok:true,e164:'+2348031234567'},{ok:true,e164:'+2348031234567'},{ok:false,error:{code:'INVALID_INPUT'}}],
      summary:{totalDataRows:4,validCount:3,invalidCount:1,uniqueValidNumberIdentities:2,duplicateRowCount:1,duplicateGroupCount:1,countryBreakdown:{Nigeria:3}},
    });
  });

  it('applies configurable rate limiting and leaves CORS disabled by default',async()=>{
    const server=await app({rateLimitMax:1,rateLimitWindowMs:60_000});
    const first=await server.inject({method:'GET',url:'/health'});
    const second=await server.inject({method:'GET',url:'/health'});
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({error:{code:'RATE_LIMITED'}});
    expect(first.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows only explicitly configured exact CORS origins',async()=>{
    const server=await app({corsOrigins:['https://contacts.example']});
    const accepted=await server.inject({method:'GET',url:'/health',headers:{origin:'https://contacts.example'}});
    const rejected=await server.inject({method:'GET',url:'/health',headers:{origin:'https://other.example'}});
    expect(accepted.headers['access-control-allow-origin']).toBe('https://contacts.example');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });
});
