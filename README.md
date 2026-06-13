# Nebula Monorepo

A monorepo powered by Turbo and pnpm.

## Structure

```
nebula/
├── apps/
│   └── web/          # Web application
├── packages/
│   └── shared/       # Shared utilities and types
├── turbo.json        # Turbo configuration
└── pnpm-workspace.yaml
```

## Getting Started

Install dependencies:
```bash
pnpm install
```

Run development servers:
```bash
pnpm dev
```

Build all packages:
```bash
pnpm build
```

## Commands

- `pnpm build` - Build all packages
- `pnpm dev` - Run development servers
- `pnpm lint` - Lint all packages
- `pnpm test` - Run tests
- `pnpm clean` - Clean build artifacts
