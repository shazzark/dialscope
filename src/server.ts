#!/usr/bin/env node
import { createApiApp } from './api.js';

function integerSetting(name:string,fallback:number,maximum:number):number {
  const raw=process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer.`);
  const value=Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be between 1 and ${maximum}.`);
  return value;
}

async function main():Promise<void> {
  const host=process.env.DIALSCOPE_HOST ?? '127.0.0.1';
  const port=integerSetting('DIALSCOPE_PORT',3000,65535);
  const rateLimitMax=integerSetting('DIALSCOPE_RATE_LIMIT_MAX',100,100_000);
  const rateLimitWindowMs=integerSetting('DIALSCOPE_RATE_LIMIT_WINDOW_MS',60_000,3_600_000);
  const corsOrigins=(process.env.DIALSCOPE_CORS_ORIGINS ?? '').split(',').map(origin=>origin.trim()).filter(Boolean);
  const app=await createApiApp({rateLimitMax,rateLimitWindowMs,corsOrigins});
  await app.listen({host,port});
  console.error(`DialScope API listening on ${host}:${port}`);
  const close=():void=>{ void app.close().catch(()=>{console.error('DialScope API shutdown failed.');process.exitCode=1;}); };
  process.once('SIGINT',close);
  process.once('SIGTERM',close);
}

void main().catch(()=>{console.error('DialScope API could not start. Check server configuration.');process.exitCode=1;});
