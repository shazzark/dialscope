import { describe, expect, it } from 'vitest';
import { getMetadataInfo, lookupPhoneNumberWithProvenance } from '../src/info.js';

describe('metadata provenance', () => {
  it('reports dependency versions separately from unknown metadata freshness', () => {
    expect(getMetadataInfo()).toEqual({
      packageVersion:'1.0.0',
      dependencies:{'libphonenumber-js':'1.12.31','libphonenumber-geo-carrier':'2.0.0',fastify:'5.12.7','@fastify/rate-limit':'11.2.0','@fastify/cors':'11.3.1'},
      bundledMetadataVersion:'unknown',
      bundledMetadataDate:'unknown',
    });
  });

  it('adds lookup execution time outside the existing lookup result shape', async () => {
    const response = await lookupPhoneNumberWithProvenance('08031234567');
    expect(Number.isNaN(Date.parse(response.lookupExecutedAt))).toBe(false);
    expect(response.result).toMatchObject({ok:true,e164:'+2348031234567'});
    expect(response.metadata.packageVersion).toBe('1.0.0');
  });
});
