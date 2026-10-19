import type { LookupResult } from './lookup.js';

/** One source row and its normalized identity, when phone validation succeeded. */
export interface BatchSummaryRecord {
  readonly result: LookupResult;
  /** E.164 plus extension; null for invalid rows. */
  readonly identity: string | null;
}

/** Reconciled counts for a batch. Duplicate groups are counted, not included as row lists. */
export interface BatchSummary {
  readonly totalDataRows: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly uniqueValidNumberIdentities: number;
  readonly duplicateRowCount: number;
  readonly duplicateGroupCount: number;
  readonly countryBreakdown: Readonly<Record<string, number>>;
  readonly numberTypeBreakdown: Readonly<Record<string, number>>;
  readonly missingCarrierCount: number;
  readonly missingAreaCount: number;
  readonly missingTimeZoneCount: number;
}

/** Count parsed data rows, including invalid and duplicate rows. */
export function summarizeBatch(records: readonly BatchSummaryRecord[]): BatchSummary {
  const identities = new Map<string, number>();
  const countries: Record<string, number> = {};
  const numberTypes: Record<string, number> = {};
  let validCount = 0;
  let invalidCount = 0;
  let missingCarrierCount = 0;
  let missingAreaCount = 0;
  let missingTimeZoneCount = 0;

  for (const { result, identity } of records) {
    if (!result.ok) {
      invalidCount += 1;
      continue;
    }
    validCount += 1;
    const country = result.countryName || 'Unknown';
    countries[country] = (countries[country] ?? 0) + 1;
    const type = result.numberType ?? 'Unknown';
    numberTypes[type] = (numberTypes[type] ?? 0) + 1;
    if (result.originalCarrier === null) missingCarrierCount += 1;
    if (result.areaDescription === null) missingAreaCount += 1;
    if (result.timeZones.length === 0) missingTimeZoneCount += 1;
    if (identity !== null) identities.set(identity, (identities.get(identity) ?? 0) + 1);
  }

  const duplicateGroups = [...identities.values()].filter(count => count > 1);
  const duplicateRowCount = duplicateGroups.reduce((total, count) => total + count - 1, 0);
  return {
    totalDataRows: records.length,
    validCount,
    invalidCount,
    uniqueValidNumberIdentities: identities.size,
    duplicateRowCount,
    duplicateGroupCount: duplicateGroups.length,
    countryBreakdown: countries,
    numberTypeBreakdown: numberTypes,
    missingCarrierCount,
    missingAreaCount,
    missingTimeZoneCount,
  };
}
