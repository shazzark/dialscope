# DialScope implementation status

## Scope

Offline Node.js/strict TypeScript terminal application for phone number validation, international formatting and available country/area, original carrier and possible-time-zone metadata. No web app, server, database, paid API, analytics, or persistence of entered phone numbers.

## Phase status

- [x] Phase 1 — strict project foundation and dependency/API review
- [ ] Phase 2 — typed lookup service and unit coverage (dependency-backed checks blocked)
- [ ] Phase 3 — CLI and subprocess coverage (dependency-backed checks blocked)
- [ ] Phase 4 — Python reference parity (run locally when Python's `phonenumbers` is available; differences to be recorded below)
- [ ] Phase 5 — open-source readiness, clean-checkout verification and final review

## Dependency findings

`libphonenumber-geo-carrier` 2.0.0 documents and types `geocoder(PhoneNumber, locale?)`, `carrier(PhoneNumber, locale?)`, and `timezones(PhoneNumber)`, all returning promises. Package metadata declares MIT and Node-only operation. Its package bundles mapping data and reports fallback to English when a requested locale is unavailable. `libphonenumber-js/max` provides full validation metadata and formatting; package metadata declares MIT. Google's upstream libphonenumber source is Apache-2.0 licensed. Exact dependency versions are pinned in `package.json` and `package-lock.json`. Data is upstream snapshot metadata and may lag source updates. The real runtime API was verified using a Swiss fixed line (+41 43 123 45 67), returning Zurich and Europe/Zurich, and a documented China Telecom mobile example returning carrier metadata.

## Verification evidence

Phase 1 `npm run typecheck` and `npm run build` passed on Node.js 22.13.0. A real package-backed lookup returned area and time-zone metadata. Subsequent phase checks are recorded below as completed. Python launcher reports that no Python is installed, so Python parity remains incomplete.

## Python parity

Not verified: the npm registry install is unavailable in this environment, and Python `phonenumbers` has not been installed/run. `scripts/python-reference.py` lists representative cases and emits versioned Python reference output. Do not interpret library examples as parity evidence. No exact parity claim is made until both implementations run with recorded versions.
