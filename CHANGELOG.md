# Changelog

All notable changes to Runtao Academy will be documented in this file.

The format loosely follows Keep a Changelog, with sections grouped by release.

## [Unreleased]

### Added

- Dual user mode support: standalone library users and integrated library users
- Fine-grained permission system with category scope authorization
- AI batch generation modes: speed review, practice, teaching
- AI single-question polishing with preview and editable write-back
- Tag governance: normalization, aliases, health check, batch operations
- Database switching wizard with SQLite and MySQL profiles
- Full backup export and restore
- Browser-level regression tests with Playwright
- GitHub issue templates, PR template, CODEOWNERS, and CI workflow

### Changed

- Rebranded product name to `润涛题苑 / Runtao Academy`
- Unified repository defaults, database naming, and container naming
- Refreshed README and contribution workflow for public release

### Fixed

- Improved Markdown rendering for headings, tables, separators, and AI output cleanup
- Fixed multiple permission boundary issues in question access flows
- Fixed several backend unused-code issues found during strict TypeScript cleanup

## [1.0.0] - 2026-03-12

### Added

- Initial public-ready release of Runtao Academy
- Question management, learning modes, bookmarks, AI assistant, AI generation, AI polishing
- User management, permission management, database management, backup and restore
