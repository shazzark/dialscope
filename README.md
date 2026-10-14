# DialScope

An offline Node.js terminal utility for validating and formatting international phone numbers and retrieving available numbering metadata.

Requires Node.js 22 or newer. Install dependencies with `npm install`; run `npm run typecheck`, `npm test`, and `npm run build` to check the project.

The project uses `libphonenumber-js/max` for parsing, validation and formatting, plus `libphonenumber-geo-carrier` for geocoding, original carrier and possible time-zone metadata. Lookups are local. Metadata can be missing or stale; carrier records do not identify a current network after porting, and numbering-area descriptions are not live locations.
