# Third-party notices

DialScope depends on the following packages and their bundled numbering metadata. Versions are locked in `package-lock.json`.

## libphonenumber-js 1.12.31

The package declares the MIT license for its JavaScript implementation. Its distribution includes the MIT license and an Apache License 2.0 text for the upstream Google libphonenumber metadata/source; copies from the installed distribution are included in `licenses/`. The project describes itself and its upstream relationship at [github.com/catamphetamine/libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js).

## libphonenumber-geo-carrier 2.0.0

The package metadata declares the MIT license and credits Martin Mende. The published package does not include a standalone license text; its source and license declaration are available at [github.com/mmende/libphonenumber-geo-carrier](https://github.com/mmende/libphonenumber-geo-carrier). Its geocoding, carrier, and time-zone mappings are bundled offline data derived from the Google libphonenumber mapping resources. Those upstream resources are under Apache License 2.0. The Apache license text shipped with `libphonenumber-js` is included in `licenses/` for the upstream metadata. This notice records the package's declared license and metadata provenance; it does not assert a separate metadata version beyond the package version.

## Node.js, TypeScript, Vitest, and transitive packages

These are build/test/runtime dependencies declared through npm. Their package license declarations and notices are distributed in the npm packages installed by `npm ci`; their resolved versions are recorded in `package-lock.json`. No dependency is bundled or vendored into DialScope's source tree.

## Fastify 5.12.7, @fastify/rate-limit 11.2.0, and @fastify/cors 11.3.1

These API adapter dependencies declare the MIT license. Their license files are distributed in the installed npm packages, with exact versions and integrity hashes recorded in `package-lock.json`. The API uses Fastify's documented JSON schema validation and the official plugins for in-memory IP-based rate limits and explicitly configured CORS. No framework or plugin code is vendored into DialScope's source tree.

## csv-parse 7.0.3 and csv-stringify 6.9.0

These CSV parsing and serialization packages declare the MIT license. Their package notices are distributed with the installed packages; exact versions and integrity hashes are recorded in `package-lock.json`. DialScope uses their documented synchronous APIs only with bounded input sizes.
