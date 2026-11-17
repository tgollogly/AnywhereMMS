# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] — 2026-11-17

### Added

- Sealed, verifiable GitHub Releases: npm pack archive, source zip, `SHA256SUMS.txt`, and Sigstore build provenance attestations.
- CI workflow: install, start server, and run `scripts/smoke-test.sh`.

### Initial release

- Mobile-friendly web UI: snap or upload a photo, compress, and share a private expiring link.
- Express API with optional TextBelt/Twilio SMS, rate limits, and 72-hour TTL.
- Privacy/cookie/terms pages and Render deploy template.