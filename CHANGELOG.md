# Changelog

## 1.1.0 — prepared, not published (2026-10-19)

This additive release extends the 1.0.0 offline phone metadata CLI and root library API.

- Adds opt-in CSV contact cleaning, extension-aware duplicate removal, and duplicate reports.
- Adds typed batch summaries, `--report`, and metadata/dependency provenance through `--info`.
- Adds the optional Fastify lookup API, its `dialscope/api` ESM/type export, and the `dialscope-api` command.
- Adds cross-platform CI and isolated packed-package checks.
- Preserves the existing root lookup API, `LookupResult`, CLI lookup behavior, package name, and Node.js `>=22` requirement.
- Caller-name and linked-account integrations remain roadmap items pending documented provider coverage, access rights, and supported account evidence.

The `1.1.0` package is prepared as a local tarball only. It has not been published.
