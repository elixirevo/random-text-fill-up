## Random Text Fill Up

A lightweight web tool to mask parts of your text randomly and let users fill the blanks. Correct inputs are highlighted in blue, incorrect ones in red.

### Features

- **Random masking**: Mask characters at a configurable percentage
- **Real-time grading**: Immediate correct/incorrect feedback per character
- **IME & paste support**: Works with Korean IME; paste accepts one character
- **Shortcuts**: Arrow Left/Right to move between blanks; Backspace to clear value
- **Buttons**: Generate, Reveal All, Reset

### Project Structure

```
random-text/
├─ index.html
├─ styles.css
└─ main.js
```

### Run

#### A. Open the file directly (no server)

1. Double-click `index.html` in Finder (or open it in your browser).
2. Use the local script setting in `index.html`.

The file contains two script options:

```html
<!-- When running on a web server -->
<script type="module" src="./main.js"></script>
<!-- When opening as a local file -->
<!-- <script defer src="./main.js"></script> -->
```

- For `file://` usage, comment out the `type="module"` line and uncomment the `defer` line.
- If the browser caches things and you still see errors, try a hard refresh (Shift+Reload).

#### B. Run with a local web server (recommended)

Using a local server avoids CORS issues and allows ES modules as-is.

- Python built-in server:

```bash
python3 -m http.server 5173
```

Open `http://localhost:5173` in your browser.

- If you have Node:

```bash
npx serve -l 5173
# or
npx http-server -p 5173
```

### Usage

1. Enter your text in the “Source Text” area.
2. Adjust the “Mask Ratio” slider.
3. Choose the “Mask Unit”: `Character` or `Word`.
4. Click “Generate” to create blanks.
5. Type into blanks to get instant feedback.
   - Blue = correct, Red = incorrect
6. Click “Reveal All” to fill all answers at once.
7. Click “Reset” to start over.

### Shortcuts & Input Tips

- Arrow Left/Right: Move to previous/next blank
- Backspace: Clear current value (keeps focus)
- Korean IME supported (grading happens after composition ends)
- Paste accepts one character

### Troubleshooting

- Getting a script CORS error on `file://`?

  - Switch to the `defer` script option in `index.html`.
  - Or, run with a local server as shown above.

- Port 5173 already in use?

```bash
# macOS: kill processes using port 5173
PIDS=$(lsof -ti tcp:5173); if [ -n "$PIDS" ]; then kill $PIDS; sleep 0.5; PIDS=$(lsof -ti tcp:5173); if [ -n "$PIDS" ]; then kill -9 $PIDS; fi; fi
```

### Browser Support

- Targeting latest Chrome/Edge/Firefox/Safari.
- Masks general letters and digits by default; whitespace/some special characters are not masked.

### License

Feel free to use this for personal learning and demos.
