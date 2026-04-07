# Changelog

All notable changes to Runtao Academy will be documented in this file.

The format loosely follows Keep a Changelog, with sections grouped by release.

## [Unreleased]

### Added

- Nothing yet.

## [1.1.0] - 2026-04-07

### Added

- `AI答案` workflow for generating answer-only drafts, explanations, and tag suggestions without changing question stem, title, or difficulty
- `AI润色` mode split with `轻润色 / 深润色`, preview-first editing, and selectable tags before save
- AI batch tag generation and tag recommendation workflows for question maintenance
- Shared `AIAnswerDraftModal` component and richer AI text formatting helpers
- Dedicated documentation set under `docs/`, including deployment, operations, development, permissions, AI guide, and user guide

### Changed

- Promoted HttpOnly cookie based authentication flow, with frontend session restore and session-scoped storage fallback
- Reworked README into a full project landing document with product, workflow, operations, and documentation navigation
- Refined AI answer generation to support `速记版 / 练习版 / 教学版` with answer quality, tag selection, and manual tag input
- Improved AI output rendering and formatting for Markdown, numbered lists, and bullet lists
- Updated system settings visibility so backup operations are treated as administrator-only functionality

### Fixed

- Fixed AI route permission boundaries so integrated users cannot bypass category scopes through AI endpoints
- Fixed custom AI provider runtime handling so admins and normal users can use existing safe custom providers correctly
- Fixed AI batch generation parsing to tolerate more model JSON response shapes
- Fixed login throttling behavior so `/auth/me` probing no longer consumes login rate-limit capacity
- Fixed login IP handling to use trusted proxy aware request IPs instead of blindly trusting forwarded headers
- Fixed AI specific rate limiting by mounting the dedicated limiter on `/api/ai`
- Fixed Markdown emphasis parsing so `* ` bullet lists no longer lose list semantics during rendering

## [1.0.0] - 2026-03-12

### Added

- Initial public-ready release of Runtao Academy
- Question management, learning modes, bookmarks, AI assistant, AI generation, AI polishing
- User management, permission management, database management, backup and restore
