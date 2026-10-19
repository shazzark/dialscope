import Fastify, { type FastifyInstance, type FastifySchema } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { isSupportedRegion, lookupPhoneNumber, type LookupErrorCode, type LookupResult } from './lookup.js';
import { summarizeBatch, type BatchSummary } from './summary.js';
import type { CountryCode } from 'libphonenumber-js/max';

export const API_BODY_LIMIT_BYTES = 32 * 1024;
export const API_BATCH_LIMIT = 100;
export const API_CONCURRENCY_LIMIT = 4;
export const API_LOOKUP_REQUEST_LIMIT = 20;
export const API_TIMEOUT_MS = 10_000;

export type ApiErrorCode = LookupErrorCode | 'INVALID_REQUEST' | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'NOT_FOUND' | 'RATE_LIMITED' | 'LOOKUP_CAPACITY_EXCEEDED' | 'REQUEST_TIMEOUT' | 'INTERNAL_ERROR';
export interface ApiError { readonly error: { readonly code: ApiErrorCode; readonly message: string } }
export interface LookupRequest { readonly phoneNumber: string; readonly region?: string }
export interface BatchLookupRequest { readonly phoneNumbers: readonly string[]; readonly region?: string }
export interface BatchLookupResponse { readonly results: readonly LookupResult[]; readonly summary: BatchSummary }
export interface ApiOptions {
  readonly rateLimitMax?: number;
  readonly rateLimitWindowMs?: number;
  readonly corsOrigins?: readonly string[];
}

const errorSchema = {
  type:'object', additionalProperties:false, required:['error'],
  properties:{ error:{ type:'object', additionalProperties:false, required:['code','message'], properties:{
    code:{type:'string',enum:['INVALID_INPUT','INVALID_REGION','METADATA_UNAVAILABLE','DEPENDENCY_FAILURE','INVALID_REQUEST','PAYLOAD_TOO_LARGE','UNSUPPORTED_MEDIA_TYPE','NOT_FOUND','RATE_LIMITED','LOOKUP_CAPACITY_EXCEEDED','REQUEST_TIMEOUT','INTERNAL_ERROR']},
    message:{type:'string',maxLength:200},
  } } },
} as const;

const lookupResultSchema = {
  oneOf:[
    {type:'object',additionalProperties:false,required:['ok','number','nationalFormat','internationalFormat','e164','numberType','countryCode','countryName','areaDescription','originalCarrier','timeZones'],properties:{
      ok:{const:true},number:{type:'string'},nationalFormat:{type:'string'},internationalFormat:{type:'string'},e164:{type:'string'},numberType:{type:['string','null'],enum:['mobile','fixed-line','fixed-line-or-mobile','voip','toll-free','shared-cost','personal-number','pager','universal-access-number','voicemail','premium-rate',null]},countryCode:{type:'string'},countryName:{type:'string'},areaDescription:{type:['string','null']},originalCarrier:{type:['string','null']},timeZones:{type:'array',items:{type:'string'}},
    }},
    {type:'object',additionalProperties:false,required:['ok','error'],properties:{ok:{const:false},error:{type:'object',additionalProperties:false,required:['code','message'],properties:{code:{type:'string'},message:{type:'string'}}}}},
  ],
} as const;

function positiveInteger(value: number | undefined, fallback: number, name: string, maximum: number): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum) throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  return selected;
}

function isOrigin(value: string): boolean {
  try { const parsed = new URL(value); return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === value; }
  catch { return false; }
}

function apiError(code: ApiErrorCode, message: string): ApiError { return {error:{code,message}}; }
function isRecord(value: unknown): value is Record<string,unknown> { return typeof value === 'object' && value !== null; }
function lookupFailure(result: Extract<LookupResult,{ok:false}>): ApiError {
  return apiError(result.error.code,result.error.message);
}
function phoneIdentity(value:string,region:CountryCode):string|null {
  const parsed=parsePhoneNumberFromString(value,region);
  return parsed?.isValid() ? `${parsed.number};ext=${parsed.ext ?? ''}` : null;
}
const summarySchema = {type:'object',additionalProperties:false,required:['totalDataRows','validCount','invalidCount','uniqueValidNumberIdentities','duplicateRowCount','duplicateGroupCount','countryBreakdown','numberTypeBreakdown','missingCarrierCount','missingAreaCount','missingTimeZoneCount'],properties:{
  totalDataRows:{type:'integer',minimum:0},validCount:{type:'integer',minimum:0},invalidCount:{type:'integer',minimum:0},uniqueValidNumberIdentities:{type:'integer',minimum:0},duplicateRowCount:{type:'integer',minimum:0},duplicateGroupCount:{type:'integer',minimum:0},
  countryBreakdown:{type:'object',additionalProperties:{type:'integer',minimum:0}},numberTypeBreakdown:{type:'object',additionalProperties:{type:'integer',minimum:0}},
  missingCarrierCount:{type:'integer',minimum:0},missingAreaCount:{type:'integer',minimum:0},missingTimeZoneCount:{type:'integer',minimum:0},
}} as const;

const schemas = (batchLimit: number): { lookup: FastifySchema; batch: FastifySchema } => ({
  lookup:{
    body:{type:'object',additionalProperties:false,required:['phoneNumber'],properties:{phoneNumber:{type:'string',minLength:1,maxLength:64},region:{type:'string',pattern:'^[A-Za-z]{2}$'}}},
    response:{200:lookupResultSchema,400:errorSchema,404:errorSchema,413:errorSchema,415:errorSchema,422:errorSchema,429:errorSchema,500:errorSchema,503:errorSchema,504:errorSchema},
  },
  batch:{
    body:{type:'object',additionalProperties:false,required:['phoneNumbers'],properties:{phoneNumbers:{type:'array',minItems:1,maxItems:batchLimit,items:{type:'string',minLength:1,maxLength:64}},region:{type:'string',pattern:'^[A-Za-z]{2}$'}}},
    response:{200:{type:'object',additionalProperties:false,required:['results','summary'],properties:{results:{type:'array',items:lookupResultSchema},summary:summarySchema}},400:errorSchema,404:errorSchema,413:errorSchema,415:errorSchema,422:errorSchema,429:errorSchema,500:errorSchema,503:errorSchema,504:errorSchema},
  },
});

async function withConcurrency<T, R>(items: readonly T[], concurrency: number, action: (item:T,index:number)=>Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item !== undefined) results[index] = await action(item,index);
    }
  };
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},worker));
  return results;
}

/** Build the HTTP adapter without listening or creating process-level side effects. */
export async function createApiApp(options: ApiOptions = {}): Promise<FastifyInstance> {
  const rateLimitMax = positiveInteger(options.rateLimitMax,100,'rateLimitMax',100_000);
  const rateLimitWindowMs = positiveInteger(options.rateLimitWindowMs,60_000,'rateLimitWindowMs',3_600_000);
  const corsOrigins = options.corsOrigins ?? [];
  if (corsOrigins.some(origin => !isOrigin(origin))) throw new Error('corsOrigins must contain exact HTTP or HTTPS origins.');

  const app = Fastify({logger:false,bodyLimit:API_BODY_LIMIT_BYTES,requestTimeout:API_TIMEOUT_MS,handlerTimeout:API_TIMEOUT_MS,ajv:{customOptions:{removeAdditional:false}}});
  let activeLookupRequests = 0;
  await app.register(rateLimit,{max:rateLimitMax,timeWindow:rateLimitWindowMs,skipOnError:false});
  if (corsOrigins.length > 0) await app.register(cors,{origin:[...corsOrigins],methods:['GET','POST']});

  app.setErrorHandler((error,_request,reply) => {
    const status = isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (isRecord(error) && error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') return reply.code(415).send(apiError('UNSUPPORTED_MEDIA_TYPE','Send the request as application/json.'));
    if (status === 400) return reply.code(400).send(apiError('INVALID_REQUEST','Request body does not match the API schema.'));
    if (status === 413) return reply.code(413).send(apiError('PAYLOAD_TOO_LARGE','Request body exceeds the 32768 byte limit.'));
    if (status === 415) return reply.code(415).send(apiError('UNSUPPORTED_MEDIA_TYPE','Send the request as application/json.'));
    if (isRecord(error) && error.code === 'FST_ERR_HANDLER_TIMEOUT') return reply.code(504).send(apiError('REQUEST_TIMEOUT','Request processing exceeded the 10000 ms limit.'));
    if (status === 429) return reply.code(429).send(apiError('RATE_LIMITED','Rate limit exceeded.'));
    if (status === 503) return reply.code(503).send(apiError('DEPENDENCY_FAILURE','Phone metadata lookup failed.'));
    return reply.code(500).send(apiError('INTERNAL_ERROR','The request could not be completed.'));
  });
  app.setNotFoundHandler((_request,reply)=>reply.code(404).send(apiError('NOT_FOUND','The requested route does not exist.')));

  const routeSchemas = schemas(API_BATCH_LIMIT);
  app.get('/health',{schema:{response:{200:{type:'object',additionalProperties:false,required:['status'],properties:{status:{const:'ok'}}},429:errorSchema}}},async()=>({status:'ok'}));
  const requireJson = async (request: {headers:Record<string,string|string[]|undefined>},reply:{code:(status:number)=>{send:(body:ApiError)=>unknown}}):Promise<unknown> => {
    const header=request.headers['content-type'];
    const contentType=typeof header === 'string' ? header.split(';',1)[0]?.trim().toLowerCase() : '';
    if (contentType !== 'application/json') return reply.code(415).send(apiError('UNSUPPORTED_MEDIA_TYPE','Send the request as application/json.'));
  };
  app.post<{Body:LookupRequest}>('/v1/phone/lookup',{schema:routeSchemas.lookup,handlerTimeout:API_TIMEOUT_MS,preValidation:requireJson},async(request,reply)=>{
    if (activeLookupRequests >= API_LOOKUP_REQUEST_LIMIT) return reply.code(503).send(apiError('LOOKUP_CAPACITY_EXCEEDED','Lookup capacity is busy. Retry the request shortly.'));
    activeLookupRequests += 1;
    try {
      const region = request.body.region ?? 'NG';
      if (!isSupportedRegion(region)) return reply.code(422).send(apiError('INVALID_REGION','Unsupported two-letter ISO region code.'));
      const result = await lookupPhoneNumber(request.body.phoneNumber,region);
      if (!result.ok) return reply.code(result.error.code === 'INVALID_INPUT' ? 422 : 503).send(lookupFailure(result));
      return reply.code(200).send(result);
    } finally { activeLookupRequests -= 1; }
  });
  app.post<{Body:BatchLookupRequest}>('/v1/phone/lookup/batch',{schema:routeSchemas.batch,handlerTimeout:API_TIMEOUT_MS,preValidation:requireJson},async(request,reply)=>{
    if (activeLookupRequests >= API_LOOKUP_REQUEST_LIMIT) return reply.code(503).send(apiError('LOOKUP_CAPACITY_EXCEEDED','Lookup capacity is busy. Retry the request shortly.'));
    activeLookupRequests += 1;
    try {
      const region = request.body.region ?? 'NG';
      if (!isSupportedRegion(region)) return reply.code(422).send(apiError('INVALID_REGION','Unsupported two-letter ISO region code.'));
      const results = await withConcurrency(request.body.phoneNumbers,API_CONCURRENCY_LIMIT,async phoneNumber=>{
        try { return await lookupPhoneNumber(phoneNumber,region); }
        catch { return {ok:false as const,error:{code:'DEPENDENCY_FAILURE' as const,message:'Phone metadata lookup failed.'}}; }
      });
      const summary = summarizeBatch(results.map((result,index)=>({result,identity:result.ok ? phoneIdentity(request.body.phoneNumbers[index] ?? '',region) : null})));
      return reply.code(200).send({results,summary});
    } finally { activeLookupRequests -= 1; }
  });
  return app;
}
