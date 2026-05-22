# NetAcad Assistant

NetAcad Assistant is a browser extension that quietly surfaces the correct answer for Cisco NetAcad quiz questions. It walks the quiz's Shadow-DOM tree, looks the question up against a bundled answer database and the public itexamanswers.net archive, and falls back to Google Gemini only when those miss. The suggested option is rendered in-place as a faint highlight on the relevant choice (or as a small inline label for matching / fill-in / object-matching questions) — not as a separate block — and clears automatically once you select it.

## Supported Question Types

| Component                                  | Detection                                                     | Resolution path                             |
| ------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------- |
| `mcq-view` (single/multi MCQ)              | shadow walk → `.mcq__item-label.js-item-label`                | local DB → itexamanswers.net → Gemini       |
| `matching-view` (dropdowns)                | `<matching-dropdown-view>` rows with custom `.dropdown__list` | Gemini matching call (`getAiMatching`)      |
| `fillblanks-view` (inline blanks)          | `<fillblanks-dropdown-view>` per blank                        | Gemini fill-blanks call (`getAiFillBlanks`) |
| `object-matching-view` (drag-line pairing) | matching `data-id` between category & option buttons          | purely local — answer is in the DOM         |

Object-matching answers cost nothing (no AI / network); MCQ answers usually come from the bundled DB or itexamanswers.net before Gemini is consulted.

## How Resolution Works

1. **Local DB** — [answers.js](answers.js) ships with 131 multiple-choice answers extracted from the Network Security 1.0 final exam (itexamanswers.net). Instant lookup, no network. Hits log `Q1 ✓ local DB`.
2. **itexamanswers.net online lookup** — when the bundled DB misses, the background service worker:
   - Fetches a fresh nonce from `https://itexamanswers.net/questions-list`.
   - Calls the `dwqa-auto-suggest-search-result` AJAX endpoint, retrying with a truncated query if the full one finds no good match.
   - Scores candidates by token-overlap coverage; only accepts exact matches or coverage ≥ 0.6 (≥ 0.4 if a single candidate).
   - Fetches the matched question page and parses the correct answers from either `<li class="correct_answer">` or `<li>` containing inline red color styling (the site uses both patterns).
   - Caches the resolved answers per question text.
3. **Gemini API** — final fallback for unknowns. Uses a single batch call for the visible MCQs and one-shot calls for matching / fill-blanks. Model is configurable in [api.js:1](api.js#L1).

Every question logs `→ … ✓` (resolved) or `✗ → falling back to AI` in the page console, so you can see which tier handled each.

## Subtle In-Place Highlighting

There's no separate "AI Assistant" panel. Instead:

- **MCQ** options the AI/DB suggests get a barely-visible green tint plus a 1px inset accent. Selecting an option clears that option's highlight.
- **Matching / Fill-blanks** rows get a faint italic `→ <answer>` appended next to the row title or after the dropdown. Picking the suggested option from that row's dropdown clears that row's hint only — picking a different option leaves the hint alone.
- **Object-matching** options get a faint `→ A`/`→ B`/`→ C`/`→ D` letter showing which category they pair with.

All clear-on-interact handlers are scoped per-row, so other questions and other rows are unaffected.

## Technologies Used

- JavaScript (ES6+), Chrome Extensions Manifest V3
- Shadow DOM traversal across nested custom elements (`app-root` → `page-view` → `article-view` → `block-view` → question component)
- MutationObserver on `page-view`'s shadow root for SPA navigation
- Background service worker for cross-origin fetches to itexamanswers.net (declared in `host_permissions`)
- Google Gemini API (`generativelanguage.googleapis.com/v1beta`)

## Install & Use

1. **Clone** this repository.
2. **Get a Gemini API key** at [Google AI Studio](https://aistudio.google.com/app/apikey). Required only for fallback — local DB and itexamanswers.net hits work without one.
3. **Load the extension** in Chrome: `chrome://extensions/` → enable Developer mode → "Load unpacked" → select the project folder.
4. **Set the API key** via the extension popup. The key is stored in `chrome.storage.sync` and only sent to Google's Gemini endpoint.
5. **Use on NetAcad**: open any quiz page. Auto-run processes the visible question on load and on every SPA navigation. Press **Alt+Shift+Q** (Mac: **Option+Shift+Q**) to force a re-process.

The extension only runs on `*://*.netacad.com/*`; cross-origin fetches to `itexamanswers.net` go through the background worker under that origin's `host_permissions`.

## Test Harness

[test/mock-netacad.html](test/mock-netacad.html) is a self-contained mock that reproduces the real NetAcad Shadow-DOM chain and renders one question at a time with prev/next navigation. It includes 4 matching questions and 137 multiple-choice questions sourced from the Network Security 1.0 exam.

To run it locally:

1. Add a `localhost` matcher to [manifest.json](manifest.json) content_scripts:
   ```json
   "matches": [
     "*://*.netacad.com/*",
     "http://localhost/*",
     "http://127.0.0.1/*"
   ]
   ```
2. Reload the unpacked extension.
3. Serve from the repo root and open the mock:
   ```bash
   python3 -m http.server 8000
   ```
   then visit `http://localhost:8000/test/mock-netacad.html`.

The console logs each resolution tier as you click through questions.

## How It Walks the Page

- **Content scripts** ([content.js](content.js), [scraper.js](scraper.js), [ui.js](ui.js)) load on every NetAcad frame.
- **scrapeData()** walks `app-root → page-view → article-view → block-view` across nested shadow roots, collecting every `mcq-view`, `matching-view`, `fillblanks-view`, and `object-matching-view` it finds.
- **Visibility filter** drops elements whose bounding rect (or any ancestor across shadow boundaries) is zero, so only the currently rendered question is processed. Hidden questions still in the DOM (NetAcad keeps them loaded) are skipped to avoid wasting API quota.
- **MutationObserver** on `page-view`'s shadow root re-triggers scraping when NetAcad swaps in a new question.

## Privacy

- The Gemini API key is stored locally in `chrome.storage.sync` and sent only to Google's Gemini endpoint.
- itexamanswers.net lookups are POSTed from the background worker without cookies (`credentials: "omit"`).
- No telemetry. No third party other than the Gemini API and itexamanswers.net's public AJAX search receives any data.

## Contributing

Pull requests welcome. Useful additions:

- More question types (drag-and-drop, ordering, code/CLI input).
- Larger bundled answer DB covering other NetAcad courses.
- Detection for more itexamanswers.net answer markup variants (the site has at least two and likely more).
- Mock-page coverage for question types not yet represented.

## License

MIT License. See [LICENSE](LICENSE) for details.
