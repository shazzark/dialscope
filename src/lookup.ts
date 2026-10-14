import { carrier, geocoder, timezones } from 'libphonenumber-geo-carrier';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode, type PhoneNumber } from 'libphonenumber-js/max';

export type LookupErrorCode = 'INVALID_INPUT' | 'INVALID_REGION' | 'METADATA_UNAVAILABLE' | 'DEPENDENCY_FAILURE';
export type LookupResult =
  | { readonly ok: true; readonly number: string; readonly countryCode: string; readonly countryName: string; readonly areaDescription: string | null; readonly originalCarrier: string | null; readonly timeZones: readonly string[] }
  | { readonly ok: false; readonly error: { readonly code: LookupErrorCode; readonly message: string } };

const regions = new Set<string>(getCountries());
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const failure = (code: LookupErrorCode, message: string): LookupResult => ({ ok: false, error: { code, message } });

export function isSupportedRegion(region: string): region is CountryCode {
  return regions.has(region.toUpperCase());
}

function metadataText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /^(?:unknown|undefined|null|n\/a)$/i.test(normalized)) return null;
  return normalized;
}

export async function lookupPhoneNumber(input: string, region = 'NG'): Promise<LookupResult> {
  const trimmed = input.trim();
  const normalizedRegion = region.toUpperCase();
  if (!isSupportedRegion(normalizedRegion)) return failure('INVALID_REGION', `Unsupported region "${region}". Use a supported two-letter ISO region code.`);
  if (!trimmed) return failure('INVALID_INPUT', 'Enter a phone number.');
  let phone: PhoneNumber | undefined;
  try {
    phone = parsePhoneNumberFromString(trimmed, normalizedRegion);
    if (!phone || !phone.isValid()) return failure('INVALID_INPUT', 'The phone number is malformed or invalid for its numbering region.');
  } catch {
    return failure('INVALID_INPUT', 'The phone number is malformed or invalid for its numbering region.');
  }
  try {
    const [area, assignedCarrier, zones] = await Promise.all([
      geocoder(phone, 'en'), carrier(phone, 'en'), timezones(phone),
    ]);
    const country = phone.country;
    const countryCallingCode = country ? getCountryCallingCode(country) : phone.countryCallingCode;
    const countryName = country ? countryNames.of(country) : 'Non-geographic';
    return {
      ok: true,
      number: phone.formatInternational(),
      countryCode: `+${countryCallingCode}`,
      countryName: countryName ?? 'Unknown',
      areaDescription: metadataText(area),
      originalCarrier: metadataText(assignedCarrier),
      timeZones: Array.isArray(zones) ? zones.filter((zone): zone is string => typeof zone === 'string' && zone.length > 0) : [],
    };
  } catch {
    return failure('DEPENDENCY_FAILURE', 'Phone metadata lookup failed. Check the installation and try again.');
  }
}
