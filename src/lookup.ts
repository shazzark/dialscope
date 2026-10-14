import { carrier, geocoder, timezones } from 'libphonenumber-geo-carrier';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode, type PhoneNumber } from 'libphonenumber-js/max';

export type LookupErrorCode = 'INVALID_INPUT' | 'INVALID_REGION' | 'METADATA_UNAVAILABLE' | 'DEPENDENCY_FAILURE';
export type NumberType = 'mobile' | 'fixed-line' | 'fixed-line-or-mobile' | 'voip' | 'toll-free' | 'shared-cost' | 'personal-number' | 'pager' | 'universal-access-number' | 'voicemail' | 'premium-rate';
export type LookupResult =
  | { readonly ok: true; readonly number: string; readonly nationalFormat: string; readonly internationalFormat: string; readonly e164: string; readonly numberType: NumberType | null; readonly countryCode: string; readonly countryName: string; readonly areaDescription: string | null; readonly originalCarrier: string | null; readonly timeZones: readonly string[] }
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

function normalizedNumberType(value: string | undefined): NumberType | null {
  switch (value) {
    case 'MOBILE': return 'mobile';
    case 'FIXED_LINE': return 'fixed-line';
    case 'FIXED_LINE_OR_MOBILE': return 'fixed-line-or-mobile';
    case 'VOIP': return 'voip';
    case 'TOLL_FREE': return 'toll-free';
    case 'SHARED_COST': return 'shared-cost';
    case 'PERSONAL_NUMBER': return 'personal-number';
    case 'PAGER': return 'pager';
    case 'UAN': return 'universal-access-number';
    case 'VOICEMAIL': return 'voicemail';
    case 'PREMIUM_RATE': return 'premium-rate';
    default: return null;
  }
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
      nationalFormat: phone.formatNational(),
      internationalFormat: phone.formatInternational(),
      e164: phone.number,
      numberType: normalizedNumberType(phone.getType()),
      countryCode: `+${countryCallingCode}`,
      countryName: countryName ?? 'Unknown',
      areaDescription: metadataText(area),
      originalCarrier: metadataText(assignedCarrier),
      timeZones: Array.isArray(zones)
        ? zones.map(metadataText).filter((zone): zone is string => zone !== null)
        : [],
    };
  } catch {
    return failure('DEPENDENCY_FAILURE', 'Phone metadata lookup failed. Check the installation and try again.');
  }
}
