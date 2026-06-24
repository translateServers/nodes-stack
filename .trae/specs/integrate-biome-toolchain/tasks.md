# Tasks
- [x] Task 1: Inspect existing tooling configuration and workspace scripts.
  - [x] SubTask 1.1: Review root package scripts, workspace layout, and current Prettier/ESLint settings.
  - [x] SubTask 1.2: Review `.trae/rules/project_rules.md` and identify rules that must mention Biome.
  - [x] SubTask 1.3: Identify files/directories that Biome should include or ignore.
- [x] Task 2: Install and configure Biome.
  - [x] SubTask 2.1: Add Biome as a root development dependency using pnpm.
  - [x] SubTask 2.2: Create a root Biome configuration matching project formatting standards.
  - [x] SubTask 2.3: Configure Biome linting and ignore patterns for generated/build artifacts.
- [x] Task 3: Add Biome commands and automation.
  - [x] SubTask 3.1: Add root scripts for Biome check and Biome auto-fix.
  - [x] SubTask 3.2: Add pre-commit automation that runs Biome checks before commit.
- [x] Task 4: Update project rules for Biome.
  - [x] SubTask 4.1: Update `.trae/rules/project_rules.md` with Biome formatting, linting, and validation guidance.
  - [x] SubTask 4.2: Clarify that Biome complements existing TypeScript and ESLint checks unless a future migration explicitly changes that.
- [x] Task 5: Run Biome checks and resolve reported issues.
  - [x] SubTask 5.1: Run the configured Biome check command.
  - [x] SubTask 5.2: Apply required Biome-safe fixes to existing files.
  - [x] SubTask 5.3: Re-run Biome check until it passes.
- [x] Task 6: Verify TypeScript and existing lint compatibility.
  - [x] SubTask 6.1: Run TypeScript type checking.
  - [x] SubTask 6.2: Run existing ESLint checks if Biome-related changes affect linted files.

# Task Dependencies
- Task 2 depends on Task 1.
- Task 3 depends on Task 2.
- Task 4 depends on Task 3.
- Task 5 depends on Task 4.
- Task 6 depends on Task 5.
