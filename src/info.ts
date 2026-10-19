import { readFileSync } from 'node:fs';
import { lookupPhoneNumber, type LookupResult } from './lookup.js';

export interface MetadataInfo {
  readonly packageVersion: string;
  readonly dependencies: Readonly<Record<'libphonenumber-js' | 'libphonenumber-geo-carrier' | 'fastify' | '@fastify/rate-limit' | '@fastify/cors', string>>;
  /** The dependencies do not publish an upstream metadata build date. */
  readonly bundledMetadataVersion: 'unknown';
  readonly bundledMetadataDate: 'unknown';
}

export interface LookupWithProvenance {
  readonly result: LookupResult;
  /** ISO timestamp captured after this lookup completed. */
  readonly lookupExecutedAt: string;
  readonly metadata: MetadataInfo;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Read the installed package manifest; never infer a metadata date from install time. */
export function getMetadataInfo(): MetadataInfo {
  let manifest: unknown;
  try { manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as unknown; }
  catch { manifest = null; }
  const dependencies = isRecord(manifest) && isRecord(manifest.dependencies) ? manifest.dependencies : {};
  const version = (value: unknown): string => typeof value === 'string' ? value : 'unknown';
  return {
    packageVersion: isRecord(manifest) ? version(manifest.version) : 'unknown',
    dependencies: {
      'libphonenumber-js': version(dependencies['libphonenumber-js']),
      'libphonenumber-geo-carrier': version(dependencies['libphonenumber-geo-carrier']),
      fastify: version(dependencies.fastify),
      '@fastify/rate-limit': version(dependencies['@fastify/rate-limit']),
      '@fastify/cors': version(dependencies['@fastify/cors']),
    },
    bundledMetadataVersion: 'unknown',
    bundledMetadataDate: 'unknown',
  };
}

/** Add a per-call execution timestamp without changing the established LookupResult shape. */
export async function lookupPhoneNumberWithProvenance(input: string, region = 'NG'): Promise<LookupWithProvenance> {
  const result = await lookupPhoneNumber(input, region);
  return { result, lookupExecutedAt: new Date().toISOString(), metadata: getMetadataInfo() };
}
