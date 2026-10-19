import { afterEach, describe, expect, it, vi } from 'vitest';

const lookupGate = vi.hoisted(() => ({ pending: [] as Array<() => void> }));

vi.mock('../src/lookup.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/lookup.js')>();
  return {
    ...actual,
    lookupPhoneNumber: vi.fn(() => new Promise(resolve => {
      lookupGate.pending.push(() => resolve({ok:false as const,error:{code:'INVALID_INPUT' as const,message:'mock invalid'}}));
    })),
  };
});

import { API_LOOKUP_REQUEST_LIMIT, createApiApp } from '../src/api.js';
import type { FastifyInstance } from 'fastify';

describe('API per-server lookup capacity',()=>{
  let server: FastifyInstance | undefined;
  afterEach(async()=>{await server?.close();server=undefined;lookupGate.pending.length=0;});

  it('rejects excess simultaneous lookup requests with a typed 503',async()=>{
    const app=await createApiApp({rateLimitMax:100,rateLimitWindowMs:60_000});
    server=app;
    const requests=Array.from({length:API_LOOKUP_REQUEST_LIMIT},()=>app.inject({method:'POST',url:'/v1/phone/lookup',payload:{phoneNumber:'08031234567'}}));
    for(let attempt=0;attempt<50 && lookupGate.pending.length<API_LOOKUP_REQUEST_LIMIT;attempt+=1) await new Promise(resolve=>setTimeout(resolve,0));
    expect(lookupGate.pending).toHaveLength(API_LOOKUP_REQUEST_LIMIT);
    const overflow=await app.inject({method:'POST',url:'/v1/phone/lookup',payload:{phoneNumber:'08031234567'}});
    expect(overflow.statusCode).toBe(503);
    expect(overflow.json()).toMatchObject({error:{code:'LOOKUP_CAPACITY_EXCEEDED'}});
    for(const release of lookupGate.pending.splice(0)) release();
    const results=await Promise.all(requests);
    expect(results.every(result=>result.statusCode===422)).toBe(true);
  });
});
