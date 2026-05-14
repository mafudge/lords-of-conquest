# typescript-js

This folder contains the TypeScript/JavaScript clean-room implementation of Lords of Conquest.

## What this implementation is

- Active LOC port in TypeScript.
- Includes game engine logic, UI/runtime code, CLI helpers, and automated tests.
- Main implementation source is under `src/`.

## Setup

From this folder:

```bash
npm install
```

## Common commands

```bash
npm test
npm run typecheck
npm run dev
npm run build
npm run e2e
```

## Map CLI examples

```bash
npm run gen-map -- --help
npm run gen-map -- --seed 42 --players 4 --territories 30 --islands some --shapes irregular
npm run gen-map -- --seed 42 --format text
```

## Structure

- `src/`: game engine, UI, platform, and CLI code.
- `tests/`: unit/integration coverage.
- `tests-e2e/`: Playwright end-to-end scenarios.
- `docs/`: design specs and implementation plans.
