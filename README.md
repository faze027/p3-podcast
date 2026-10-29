# P3 Podcast

F1 prediction game for Fayez and Leona. Sealed picks, automatic scoring and a season leaderboard for the last five races of 2026. Picks sync live between your devices through Firebase's free tier.

## Files

| File | What it is |
|---|---|
| `index.html` | The page and its styles |
| `app.js` | Game logic |
| `firebase-config.js` | The Firebase project's web config. These values are public by design. |
| `firebase-app-compat.js`, `firebase-firestore-compat.js` | Firebase SDK 12.19.0, bundled so the site loads no outside scripts |
| `logo.svg` | Logo and browser-tab icon |

## Put it on GitHub Pages

1. Create a repository named `p3-podcast`. Public is fine; nothing secret is in these files.
2. Upload every file from this folder to the root of the repo (**Add file → Upload files**), then commit.
3. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. About a minute later the site is at `https://<your-username>.github.io/p3-podcast/`.

## Opening the game

The board only opens from the private link, which ends in `#` followed by the game code. The code lives in `SETUP-PRIVATE.txt`, which is deliberately not part of this repo. The part after `#` never leaves the browser, so GitHub never sees it.

Each person taps their own name at the top right once per device. Pick, lock in, and after the race either of you enters the real results and taps **Finalize & score**.

## How it's protected

- The Firestore security rules only allow the one private game. A wrong or guessed code can't read or write anything.
- Every save is checked by Firebase: real driver codes only, known races only, no extra fields, short text only.
- Nothing can be deleted.
- Picks lock at lights out and results open at lights out. Firebase enforces this, not just the page.
- The page escapes everything it displays, cleans up whatever it reads, and its Content Security Policy only allows its own scripts.
- The project is on the free Spark plan, which has no billing, so it can never charge you.

Keep it that way:

- Never commit `SETUP-PRIVATE.txt` or paste the game code anywhere public.
- Lock the API key to your site. In Google Cloud console, go to **APIs & Services → Credentials → Browser key (auto created by Firebase) → Application restrictions → Websites** and add `https://<your-username>.github.io/*`.
- Don't add a payment method to the Firebase project.
- Turn on 2-step verification for the Google account that owns the project and for GitHub.

## Changing races or drivers

Edit `RACES` or `DRIVERS` in `app.js`, then make the same change in the Firestore rules (race lock times and the driver list) and publish them.
