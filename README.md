# Lords of Conquest Implementations

This repository is organized as a collection of Lords of Conquest (LOC) implementations.

## Live Site

GitHub Pages: https://mafudge.github.io/lords-of-conquest/

## Implementations

- `implementations/rgettman-cheerpj/`
	- Randy Gettman Java applet build (`loc.jar`) with a CheerpJ web embed (`index.html`).
	- Credits to Randy Gettman for the Java implementation.
	- Folder guide: `implementations/rgettman-cheerpj/README.md`

- `implementations/typescript-js/`
	- The TypeScript/JavaScript clean-room LOC port.
	- Source code: `src/`
	- Tests: `tests/`, `tests-e2e/`
	- Design/docs: `docs/superpowers/specs/`, `docs/superpowers/plans/`
	- Folder guide: `implementations/typescript-js/README.md`

Future implementations (for example Flutter and Unity) should be added as sibling folders under `implementations/`.

## Running Each Implementation

### rgettman-cheerpj

From the repo root:

```bash
cd implementations/rgettman-cheerpj
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

### typescript-js

From the repo root:

```bash
cd implementations/typescript-js
npm install
npm test
npm run typecheck
npm run gen-map -- --seed 12345
```

Map CLI examples:

```bash
npm run gen-map -- --help
npm run gen-map -- --seed 42 --players 4 --territories 30 --islands some --shapes irregular
npm run gen-map -- --seed 42 --format text
```
