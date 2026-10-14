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
npm run dev -- "+41431234567" --json
npm run dev -- --help
```

The interactive form prompts for a number. With a positional number, surrounding whitespace is trimmed. National-format input defaults to region `NG`; `--region` selects another supported ISO region. A number beginning with `+` uses its explicit calling code, independently of the default region. Unsupported regions and invalid numbers produce clear errors and a nonzero exit code. `--json` emits only JSON, including structured errors. Missing area or carrier metadata is `null` and missing time zones is an empty array. Help lists the available options.

Human-readable output accepts `--format national`, `--format international` (the default), or `--format e164`. JSON remains compatible with the existing `number` field (international format) and includes `nationalFormat`, `internationalFormat`, `e164`, and `numberType`. Number type comes from numbering metadata; `fixed-line-or-mobile` stays ambiguous, and unavailable or unrecognized metadata is `null`.

CSV batch lookup is available with `node dist/cli.js --input numbers.csv --column phone --output results.csv` (the column defaults to `phone`). Use `--output-format json` for JSON export and `--region NG` to choose parsing region. See [examples/numbers.csv](examples/numbers.csv). Batch output preserves input order and duplicates and reports invalid/empty phone cells per row. It requires a header and is limited to 10 MiB and 10,000 data rows. CSV output columns are `row_id,input,lookup_status,number,national_format,international_format,e164,country_code,country_name,area_description,original_carrier,number_type,time_zones,error_code,error_message`; `time_zones` is a JSON array string. CSV string cells whose first non-space/control character is `=`, `+`, `-`, or `@` get a leading apostrophe to reduce spreadsheet formula execution; JSON preserves original text. Exit codes: `0` all rows completed, `3` output completed with row errors, `1` fatal file/CSV/option error. Existing output requires `--overwrite`; input and output cannot refer to the same file. Output is written atomically.

PowerShell's `npm` shim may consume `--help` before forwarding it. In PowerShell, use `npm.cmd run dev -- --help`. The compiled CLI accepts the same arguments directly:

```sh
node dist/cli.js "+14155552671"
node dist/cli.js "+41431234567" --json
node dist/cli.js --help
```

Example human output:

```text
International number: +1 415-555-2671
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

Missing metadata is reported as “Unknown” in human output and as `null` or `[]` in JSON. A valid number is not proof that it is active, reachable, or assigned to a person.

DialScope does not provide live caller-name lookup. Additional official products reviewed for Phase 6A offer reverse-name lookup or caller-ID MCP, but none confirms Nigerian `+234` name coverage and terms for an open-source CLI adapter. See [caller-name feasibility](docs/caller-name-feasibility.md). DialScope remains offline and does not send numbers to a lookup service.

## Remaining approved work

Progress is tracked in [task.md](task.md). CSV batch lookup/export and reusable JavaScript/TypeScript package exports are still in progress. Caller-name lookup remains pending provider confirmation.

## Privacy

All lookups run locally using installed package data. DialScope does not save or log the entered phone number, make network lookup requests, or collect analytics.

## Python comparison status

Python parity verification was not executed because Python was unavailable in the environment. No Python comparison tooling or Python runtime dependency is included. No parity result is claimed.

## License

DialScope's code is licensed under the MIT License. See [LICENSE](LICENSE) and the third-party notices for dependency and metadata licensing.
