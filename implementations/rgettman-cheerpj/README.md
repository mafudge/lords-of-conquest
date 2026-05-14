# rgettman-cheerpj

This folder contains the Randy Gettman Java implementation of Lords of Conquest, packaged as `loc.jar`, with a CheerpJ browser embed in `index.html`.

## What this implementation is

- Original Java applet-era implementation by Randy Gettman.
- Runs in modern browsers through CheerpJ.
- Useful as a behavior/reference baseline for newer ports.

## Run

From this folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ in your browser.

## Files

- `index.html`: CheerpJ host page.
- `loc.jar`: Java game archive.
