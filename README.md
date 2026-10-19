# DialScope

DialScope is an offline Node.js terminal application that validates a phone number and reports national, international, and E.164 formats, metadata-backed number type, and available numbering metadata. It does not contact a lookup service or store entered numbers.

## Requirements and setup

Requires Node.js 22 or newer. From a checkout, install the locked dependencies and run the checks/build:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run verify:packed
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

### Cleaning and deduplicating contacts

Cleaning is explicit. `--clean` preserves every input contact column and adds `row_id`, `normalized_phone`, `extension`, `lookup_status`, `error_code`, and `error_message`. Invalid and empty phone rows stay in this reviewable output with their original input and reason. It does not change names, emails, or other contact fields.

```sh
node dist/cli.js --input contacts.csv --column phone --region NG --output cleaned.csv --clean
node dist/cli.js --input contacts.csv --column phone --region NG --output unique.csv --clean --dedupe --duplicates-output removed-duplicates.csv
node dist/cli.js --input contacts.csv --output results.csv --report
node dist/cli.js --info
```

`--dedupe` retains the first valid occurrence in input order. Identity is the normalized E.164 number plus its extension, so different extensions remain separate contacts. Every later duplicate is written, with its source columns and `duplicate_of_row_id`, to the required `--duplicates-output` file. Invalid rows are never deduplicated away. E.164 values in CSV pass through the existing spreadsheet formula safety escaping, which prefixes a leading apostrophe for cells beginning with `+`; JSON batch exports retain original unescaped input strings.

Numbers beginning with `+` are parsed using their explicit calling code. Other numbers are parsed using `--region`; if omitted, the existing documented batch default is `NG`. DialScope does not infer a region from digits alone. Choose a region that matches the source list before cleaning international or multi-country contacts.

Every output path is checked against the input and every other output, including existing file aliases. Each file is written atomically on its own. With both the cleaned file and duplicate report, the pair is not a single transaction: if writing the second file fails, the first may already have been replaced.

Add `--report` to any CSV batch command to emit a compact JSON `BatchSummary` on stdout. Human progress and diagnostics go to stderr. The summary describes all source data rows, even when deduplication omits rows from the main output; it does not print duplicate groups or contact data.

`totalDataRows` counts rows after the header and CSV blank-line handling. `validCount` and `invalidCount` count all rows according to numbering metadata, and sum to `totalDataRows`. `uniqueValidNumberIdentities` counts distinct valid E.164 identities including extensions; `duplicateRowCount` counts valid rows after the first in each repeated identity; `duplicateGroupCount` counts identities with two or more rows. Country and number-type breakdowns count valid rows, with `Non-geographic` and `Unknown` as explicit categories where applicable. Missing carrier, area, and time-zone counts count valid rows with no corresponding metadata. Empty input with a header produces zero counts and empty breakdowns. Validity and number type reflect numbering metadata; they do not prove that a line is active, reachable, or owned by a person.

### Metadata and dependency provenance

`dialscope --info` emits JSON with the DialScope package version, the pinned `libphonenumber-js` parsing/validation dependency version, the `libphonenumber-geo-carrier` enrichment dependency version, the Fastify API framework/plugin versions, and bundled metadata version/date. The upstream metadata build version and date are currently `unknown`; dependency release versions are not claimed to be metadata build dates. Use `lookupPhoneNumberWithProvenance(number, region)` from the library when a caller also needs an ISO `lookupExecutedAt` timestamp alongside the unchanged `LookupResult`.

To refresh dependencies reproducibly, review the weekly Dependabot pull request or update the exact dependency versions in `package.json` and lockfile together, then run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and packed-package consumer checks. Review metadata-sensitive regression examples and `THIRD-PARTY-NOTICES.md` before merging an update. Lookups continue to use bundled local data and do not fetch updates at runtime.

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

## Fastify API

The separate API process uses the same offline lookup and summary core. Start it explicitly from a checkout:

```sh
npm run start:api
```

It binds to `127.0.0.1:3000`. `GET /health` returns `{ "status": "ok" }`; `POST /v1/phone/lookup` accepts `{ "phoneNumber": "+14155552671", "region": "US" }`; and `POST /v1/phone/lookup/batch` accepts an ordered `phoneNumbers` array and returns each result plus a `BatchSummary`.

The API caps JSON bodies at 32 KiB, each batch at 100 numbers, each number string at 64 characters, processing concurrency at 4, and request/handler timeouts at 10 seconds. `DIALSCOPE_RATE_LIMIT_MAX` defaults to 100 requests per IP per `DIALSCOPE_RATE_LIMIT_WINDOW_MS` (default 60000 ms); the built-in limiter is in-memory per process. Set `DIALSCOPE_HOST` and `DIALSCOPE_PORT` to configure the bind address (defaults `127.0.0.1` and `3000`). CORS is disabled by default; set `DIALSCOPE_CORS_ORIGINS` to a comma-separated list of exact HTTP/HTTPS origins to enable it. CORS does not authenticate callers.

Request errors use `{ "error": { "code": "...", "message": "..." } }`. Statuses are 400 for malformed/schema-invalid requests, 413 for bodies over the limit, 422 for invalid numbers or unsupported regions, 429 for rate limiting, 500 for unexpected failures, 503 for metadata/dependency failures, and 504 for handler timeout. A completed batch returns 200 with per-row `LookupResult` errors for invalid numbers; its order matches the request.

The public OpenAPI contract and examples are in [docs/openapi.yaml](docs/openapi.yaml). `createApiApp` is also available from the `dialscope/api` ESM subpath for injection or embedding; importing it does not listen on a port. The standalone `dialscope-api` executable and `npm run start:api` start a server explicitly. The API does not log request bodies or phone/contact values. Public deployment requires deliberate authentication, shared rate limiting and abuse controls, and deployment-specific network/security configuration; none is included or deployed by this project.

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

Caller-name lookup and linked-account discovery remain explicit roadmap features, but neither is implemented. Phase 16 research found no provider with confirmed Nigerian `+234` caller-name coverage and terms for an open-source CLI adapter, and no supported universal route to discover services registered to a phone number. See [caller-name and linked-account feasibility](docs/caller-name-feasibility.md). Current lookup stays offline and does not send numbers to a lookup service.

## Privacy

Single and batch lookups run locally using installed package data. DialScope makes no network lookup requests, does not automatically save or log entered numbers, and collects no analytics. Batch output is written only to the output path explicitly requested by the user. Installing dependencies or a package tarball uses npm as usual, but number lookup itself is offline.

## Python comparison status

Python parity verification was not executed because Python was unavailable in the environment. No Python comparison tooling or Python runtime dependency is included. No parity result is claimed.

## License

DialScope's code is licensed under the MIT License. See [LICENSE](LICENSE) and the third-party notices for dependency and metadata licensing.
