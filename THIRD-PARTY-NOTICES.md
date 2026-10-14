# Third-party notices

DialScope depends on the following packages and their bundled numbering metadata. Versions are locked in `package-lock.json`.

## libphonenumber-js 1.12.31

The package declares the MIT license for its JavaScript implementation. Its distribution includes the MIT license and an Apache License 2.0 text for the upstream Google libphonenumber metadata/source; copies from the installed distribution are included in `licenses/`. The project describes itself and its upstream relationship at [github.com/catamphetamine/libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js).

## libphonenumber-geo-carrier 2.0.0

The package metadata declares the MIT license and credits Martin Mende. The published package does not include a standalone license text; its source and license declaration are available at [github.com/mmende/libphonenumber-geo-carrier](https://github.com/mmende/libphonenumber-geo-carrier). Its geocoding, carrier, and time-zone mappings are bundled offline data derived from the Google libphonenumber mapping resources. Those upstream resources are under Apache License 2.0. The Apache license text shipped with `libphonenumber-js` is included in `licenses/` for the upstream metadata. This notice records the package's declared license and metadata provenance; it does not assert a separate metadata version beyond the package version.

## Node.js, TypeScript, Vitest, and transitive packages

These are build/test/runtime dependencies declared through npm. Their package license declarations and notices are distributed in the npm packages installed by `npm ci`; their resolved versions are recorded in `package-lock.json`. No dependency is bundled or vendored into DialScope's source tree.
