# Repository Guidelines

## Project Structure & Module Organization

Podung (포둥) is currently a planning-stage repository for a family care web platform covering pregnancy through preschool. The only project document is `docs/plans/podung-product-plan.md`, which defines product direction, proposed release stages, and outstanding decisions.

Keep planning documents in `docs/plans/`. No source, test, or asset directories exist yet. When implementation begins, document the chosen structure here. Treat proposed features and timelines as proposals until explicitly confirmed.

## Build, Test, and Development Commands

There is no package manifest, build system, local server, or automated test command yet. Useful review commands are:

- `rg --files`: list project files.
- `git status --short`: inspect new and modified files.
- `git diff --check`: check tracked changes for whitespace errors.
- `git diff -- docs/plans/`: review tracked planning changes; read untracked documents directly.

Add actual setup, development, build, and test commands when tooling is introduced.

## Coding Style & Naming Conventions

Use Markdown headings, short paragraphs, and tables for comparisons. Follow the existing plan's Korean prose and retain English product or technical names where useful. Use lowercase, hyphen-separated document names, such as `family-sharing-plan.md`.

Keep dates in `YYYY-MM-DD` format. Update document version and date metadata when revising the product plan. No code indentation standard, formatter, or linter has been selected; define these with the implementation stack.

## Testing Guidelines

No testing framework or coverage threshold exists. For documentation changes, verify internal consistency, links, release-stage labels, and alignment with confirmed product decisions.

Future implementation should validate Korean and English flows, family access permissions, due-date/birth-date transitions, notification settings, and data deletion. Define test naming and execution commands alongside the chosen framework.

## Commit & Pull Request Guidelines

The repository has no commits, so no historical message convention exists. Use concise, imperative messages, for example `docs: clarify family sharing requirements`.

Pull requests should explain the change, its reason, and validation performed. Link relevant issues when available. Include screenshots for future UI changes and identify unresolved product decisions explicitly.

## Security & Configuration

Keep credentials and real family or child data out of commits and examples. Preserve the plan's distinction between private family records and public community content.
