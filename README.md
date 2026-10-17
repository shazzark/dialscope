# DialScope

DialScope is an offline Node.js terminal application that validates a phone number and reports national, international, and E.164 formats, metadata-backed number type, and available numbering metadata. It does not contact a lookup service or store entered numbers.

## Requirements and setup

Requires Node.js 22 or newer. From a checkout, install the locked dependencies and run the checks/build:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Run the CLI during development:

```sh
npm run dev
npm run dev -- "+14155552671"
npm run dev -- "08031234567" --region NG
npm run dev -- "08031234567" --format national
npm run dev -- "+41431234567" --json
npm run dev -- --help
```

The interactive form prompts for a number. With a positional number, surrounding whitespace is trimmed. National-format input defaults to region `NG`; `--region` selects another supported ISO region. A number beginning with `+` uses its explicit calling code, independently of the default region. Unsupported regions and invalid numbers produce clear errors and a nonzero exit code. `--json` emits only JSON, including structured errors. Missing area or carrier metadata is `null` and missing time zones is an empty array. `node dist/cli.js --help` lists both single-number and CSV batch command forms.

Human-readable output accepts `--format national`, `--format international` (the default), or `--format e164`. JSON remains compatible with the existing `number` field (international format) and includes `nationalFormat`, `internationalFormat`, `e164`, and `numberType`. Number type comes from numbering metadata; `fixed-line-or-mobile` stays ambiguous, and unavailable or unrecognized metadata is `null`.

CSV batch lookup supports CSV and JSON export:

```sh
node dist/cli.js --input examples/numbers.csv --column phone --output results.csv
node dist/cli.js --input examples/numbers.csv --column phone --output results.json --output-format json
node dist/cli.js --input numbers.csv --region NG --output results.csv --overwrite
```

The header row is required and `--column` defaults to `phone`. `--region` defaults to `NG`; explicit international numbers use their calling code. Input order and duplicate rows are preserved. Every data row gets a result; invalid and empty phone cells do not stop other rows. Empty input files, malformed CSV, missing columns, and file errors are fatal. UTF-8 BOM, CRLF, quoted cells, and commas inside quoted cells are supported. Input is limited to 10 MiB and 10,000 data rows. The example is [examples/numbers.csv](examples/numbers.csv).

The stable CSV header is `row_id,input,lookup_status,number,national_format,international_format,e164,country_code,country_name,area_description,original_carrier,number_type,time_zones,error_code,error_message`. `row_id` is a 1-based data-row index. `lookup_status` is `success` or `error`; format/country/metadata columns are empty for row errors, with `error_code` and `error_message` populated. `time_zones` is serialized as a JSON array string. CSV string cells whose first non-space/control character is `=`, `+`, `-`, or `@` receive a leading apostrophe for spreadsheet safety, including the original input cell. JSON output preserves original strings without that escaping.

Exit codes are `0` for all successful rows, `3` when output completed with one or more row errors, and `1` for fatal option, CSV, size, or file errors. Existing output is refused unless `--overwrite` is supplied. Input and output cannot refer to the same file, including path aliases. Results are written atomically; temporary output is removed after a failed write. Batch mode stores no phone data except in the output file explicitly requested by the user. `--json` and `--format` single-number options cannot be combined with batch mode.

## Node.js library

After building or installing a local package tarball, import the side-effect-free lookup API:

```js
import { lookupPhoneNumber } from 'dialscope';

const result = await lookupPhoneNumber('08031234567', 'NG');
if (result.ok) console.log(result.e164, result.numberType);
```

`LookupResult`, `LookupErrorCode`, and `NumberType` are exported TypeScript types. `NumberType` includes mobile, fixed line, fixed line or mobile, VoIP, toll-free, shared-cost, personal-number, pager, universal-access-number, voicemail, and premium-rate. `fixed-line-or-mobile` means metadata cannot distinguish those types; `null` means no recognized type metadata is available. Importing the package root does not start the CLI. The executable remains available separately as `dialscope`.

The first npm release is being prepared; it has not been published yet. After release, install the CLI/library package with:

```sh
npm install dialscope
npx dialscope --help
npx dialscope "+14155552671" --json
```

The package exposes the same lookup API and declarations shown above. In a consuming TypeScript project:

```ts
import { lookupPhoneNumber } from 'dialscope';
import type { LookupResult, NumberType } from 'dialscope';

const result: LookupResult = await lookupPhoneNumber('08031234567', 'NG');
const kind: NumberType | null | undefined = result.ok ? result.numberType : undefined;
```

To build and install a local tarball before publication:

```sh
npm ci
npm pack
npm install ./dialscope-1.0.0.tgz
```

The package requires Node.js 22 or newer. Parsing and metadata lookup run offline; live caller-name lookup is not implemented, metadata may be incomplete or stale, and Python parity has not been verified. See [Metadata and limitations](#metadata-and-limitations) and [Python comparison status](#python-comparison-status).

PowerShell's `npm` shim may consume `--help` before forwarding it. In PowerShell, use `npm.cmd run dev -- --help`. The compiled CLI accepts the same arguments directly:

```sh
node dist/cli.js "+14155552671"
node dist/cli.js "+41431234567" --json
node dist/cli.js --help
```

Example human output:

```text
International number: +1 415-555-2671
Number type: fixed-line-or-mobile
Country calling code: 1
Country: United States
Area: San Francisco, CA
Original carrier: Unknown
Possible time zones: America/Los_Angeles
```

Exact spacing and metadata can vary with the bundled library metadata version.

## Metadata and limitations

Parsing, validity, number type and international formatting use `libphonenumber-js/max`. Area descriptions, original assigned carrier and possible time zones use the offline metadata in `libphonenumber-geo-carrier`. The dependencies and their data licenses are described in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). The data is a bundled snapshot and may be incomplete or lag current numbering changes.

Area descriptions describe numbering-plan allocation areas where available; they do not identify a caller's live location. Carrier information is the original assignment recorded in the metadata, not necessarily the current network after number portability. Time zones are possible zones associated with the number's numbering metadata and do not reveal a person's live location. DialScope never substitutes the computer's local time zone.

Missing metadata is reported as `Unknown` in human output and as `null` or `[]` in JSON. A valid number is not proof that it is active, reachable, or assigned to a person.

DialScope does not provide live caller-name lookup. Additional official products reviewed for Phase 6A offer reverse-name lookup or caller-ID MCP, but none confirms Nigerian `+234` name coverage and terms for an open-source CLI adapter. See [caller-name feasibility](docs/caller-name-feasibility.md). DialScope remains offline and does not send numbers to a lookup service.

## Privacy

Single and batch lookups run locally using installed package data. DialScope makes no network lookup requests, does not automatically save or log entered numbers, and collects no analytics. Batch output is written only to the output path explicitly requested by the user. Installing dependencies or a package tarball uses npm as usual, but number lookup itself is offline.

## Python comparison status

Python parity verification was not executed because Python was unavailable in the environment. No Python comparison tooling or Python runtime dependency is included. No parity result is claimed.

## License

DialScope's code is licensed under the MIT License. See [LICENSE](LICENSE) and the third-party notices for dependency and metadata licensing.
