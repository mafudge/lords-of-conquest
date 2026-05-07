# Lords of Conquest — Web Port

A modern, browser-based port of Randy Gettman's 2003 Java applet imitation of the 1986 Electronic Arts strategy game.

## Status

Two artifacts live in this repo:

- **CheerpJ embed** — `index.html` + `loc.jar`. Open `http://localhost:8000/` (after `python3 -m http.server 8000`) to play the original applet running in WebAssembly. Credits to Randy Gettman.
- **TypeScript port** — in progress under `src/`. Currently shipping: map generation. See `docs/superpowers/specs/2026-05-06-clean-room-port-design.md` for the full design and `docs/superpowers/plans/` for active implementation plans.

## Development

```bash
npm install
npm test                # vitest
npm run typecheck       # tsc --noEmit
npm run gen-map -- --seed 12345    # CLI map generator
```

### Map CLI

```
npm run gen-map -- --help
npm run gen-map -- --seed 42 --players 4 --territories 30 --islands some --shapes irregular
npm run gen-map -- --seed 42 --format text     # Gettman text encoding
```
