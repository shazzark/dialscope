import { describe, expect, it } from 'vitest';
import { isSupportedRegion, lookupPhoneNumber } from '../src/lookup.js';

describe('phone lookup', () => {
  it('normalizes Nigerian national and international input equally', async () => {
    const national = await lookupPhoneNumber('08031234567');
    const international = await lookupPhoneNumber('+2348031234567');
    expect(national.ok).toBe(true);
    expect(international.ok).toBe(true);
    if (national.ok && international.ok) {
      expect(national.number).toBe(international.number);
      expect(national).toMatchObject({ nationalFormat: '0803 123 4567', internationalFormat: '+234 803 123 4567', e164: '+2348031234567', numberType: 'mobile' });
    }
  });

  it('uses metadata for fixed line and three interchangeable number formats', async () => {
    const result = await lookupPhoneNumber('+442012345678');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.numberType).toBe('fixed-line');
      expect(result.nationalFormat).toBeTruthy();
      expect(result.internationalFormat).toBe(result.number);
      expect(result.e164).toBe('+442012345678');
    }
  });

  it('uses explicit calling code regardless of default region', async () => {
    const result = await lookupPhoneNumber('+14155552671');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.countryCode).toBe('+1');
  });

  it('returns area, carrier and possible timezone metadata when available', async () => {
    const result = await lookupPhoneNumber('+41431234567');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.areaDescription).toBeTruthy();
      expect(result.originalCarrier).toBeNull();
      expect(result.timeZones.length).toBeGreaterThan(0);
    }
  });

  it('returns original carrier metadata for a documented Chinese mobile example', async () => {
    const result = await lookupPhoneNumber('+8619912345678');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.originalCarrier).toBeTruthy();
  });

  it('returns missing metadata as null or an empty list', async () => {
    const result = await lookupPhoneNumber('+14155552671');
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.timeZones)).toBe(true);
  });

  it('rejects malformed input and unsupported regions', async () => {
    expect(await lookupPhoneNumber('abc')).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(await lookupPhoneNumber('08031234567', 'ZZ')).toMatchObject({ ok: false, error: { code: 'INVALID_REGION' } });
    expect(isSupportedRegion('NG')).toBe(true);
  });
});
