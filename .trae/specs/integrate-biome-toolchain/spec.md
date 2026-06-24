# Biome Toolchain Integration Spec

## Why
The project currently relies on separate formatting and linting tooling, which can increase configuration overhead and make quality checks less consistent across the monorepo. Integrating Biome provides a fast, unified toolchain for formatting, linting, and code quality checks while preserving existing TypeScript strictness requirements and project-specific development rules.

## What Changes
- Add Biome as a workspace-level development dependency.
- Add a root Biome configuration tailored to the existing project style: single quotes, semicolons, 2-space indentation, 100-character line width, and TypeScript/React-aware linting.
- Add package scripts for running Biome checks and safe auto-fixes.
- Add pre-commit automation that runs Biome checks before commits.
- Update `.trae/rules/project_rules.md` so future project guidance includes Biome usage, validation expectations, and its relationship with TypeScript/ESLint/Prettier.
- Verify existing code with Biome and resolve reported issues without weakening TypeScript or ESLint standards.

## Impact
- Affected specs: developer tooling, code formatting, linting, quality assurance, Git workflow, workspace rules.
- Affected code: root package configuration, workspace lockfile, Biome config, Git hook configuration, `.trae/rules/project_rules.md`, existing source files only if Biome reports required fixes.

## ADDED Requirements
### Requirement: Workspace Biome Toolchain
The system SHALL provide a workspace-level Biome setup for formatting, linting, and quality checks across the monorepo.

#### Scenario: Run Biome check manually
- **WHEN** a developer runs the configured Biome check script
- **THEN** Biome checks supported project files using the root configuration and exits non-zero on violations.

### Requirement: Biome Formatting Configuration
The system SHALL configure Biome formatting to match the existing project style requirements.

#### Scenario: Format supported files
- **WHEN** Biome formats supported files
- **THEN** output uses single quotes, semicolons, 2-space indentation, 100-character line width, and project-compatible trailing comma behavior.

### Requirement: Biome Linting Configuration
The system SHALL enable Biome linting rules appropriate for a strict TypeScript React/NestJS monorepo without replacing TypeScript type checking.

#### Scenario: Lint supported files
- **WHEN** Biome linting runs
- **THEN** it reports actionable quality issues while TypeScript strict type checking remains handled by the existing typecheck scripts.

### Requirement: Pre-commit Biome Enforcement
The system SHALL run Biome checks automatically before commits.

#### Scenario: Commit with Biome violations
- **WHEN** a developer attempts to commit files with Biome violations
- **THEN** the pre-commit process fails and reports the violations.

### Requirement: Project Rules Alignment
The system SHALL update `.trae/rules/project_rules.md` to document Biome-related development rules.

#### Scenario: Future code generation guidance
- **WHEN** future development follows project rules
- **THEN** the rules explain when to use Biome, how Biome relates to existing TypeScript/ESLint/Prettier checks, and which Biome commands are expected for validation.

### Requirement: Existing Code Compliance
The system SHALL ensure existing supported code passes the configured Biome checks after integration.

#### Scenario: Validate existing codebase
- **WHEN** Biome check runs after setup
- **THEN** it completes successfully, or required fixes are applied and verified.

## MODIFIED Requirements
### Requirement: Existing Quality Commands
The project quality workflow SHALL include Biome commands alongside existing ESLint and TypeScript checks, without removing strict TypeScript or existing ESLint validation unless explicitly requested.

### Requirement: Project Development Rules
The project development rules SHALL include Biome as part of the code quality toolchain while preserving existing TypeScript strictness, ESLint requirements, and formatting expectations.

## REMOVED Requirements
### Requirement: None
**Reason**: This change adds Biome integration without removing existing quality gates.
**Migration**: No migration is required beyond installing dependencies, updating project rules, and using the new scripts/hooks.
