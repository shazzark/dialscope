# Release procedure

This procedure prepares a local package artifact. Publication and deployment require a separate explicit release decision.

## Before packing

1. Confirm `package.json` and the root `package-lock.json` use the intended SemVer version. Add-only CLI flags, root exports, and the `dialscope/api` subpath are minor-release changes; removal or incompatible changes to existing commands, exports, fields, or Node.js support require a major version.
2. Review `CHANGELOG.md`, `README.md`, `THIRD-PARTY-NOTICES.md`, and `docs/openapi.yaml` against the code and tested package contents.
3. From PowerShell, run:

   ```powershell
   npm ci
   npm run typecheck
   npm test
   npm run build
   git diff --check
   ```

4. Make sure `release-local/` contains no previous artifact for this version. It is ignored by Git and reserved for local release files.
5. Pack and verify the exact output file:

   ```powershell
   New-Item -ItemType Directory -Force release-local | Out-Null
   npm pack --pack-destination release-local
   npm run verify:packed -- -- --tarball release-local/dialscope-1.1.0.tgz
   Get-FileHash release-local/dialscope-1.1.0.tgz -Algorithm SHA512
   ```

   The extra separator in the PowerShell command keeps npm from treating `--tarball` as an npm configuration option. This verifies the exact tarball in an isolated consumer and exercises its command, library, declarations, and loopback API. Do not substitute a newly repacked file after recording its digest.

## Before publication

- Review the exact tarball's SHA-512 digest and contents.
- Confirm the intended registry, account, package name, version availability, release notes, and license files.
- Confirm all local checks and the hosted CI run for the release commit.
- Publish only after the project owner explicitly authorizes publication. This repository workflow does not publish automatically.
