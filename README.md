# Trade Wind Timepieces — website

Source for **tradewindtimepieces.com**. A single static page built from
plain content files. There's no framework and nothing to install, and it
hosts free on Cloudflare Pages.

## Where things live

| What | File |
|---|---|
| Watches for sale | `content/listings.json` |
| Photo gallery | `content/gallery.json` |
| Instagram reels | `content/instagram.json` |
| Google reviews | `content/reviews.json` |
| All other page text, phone, email | `content/site.json` |
| Images | `public/assets/` (new uploads go in `public/assets/uploads/`) |
| Look and layout | `src/styles.css` |
| Page builder | `build.js` |

## Everyday editing (no code)

1. Go to **https://app.pagescms.org** and sign in with GitHub.
2. Open this repository. You'll see editors for *Watches for sale*, *Photo
   gallery*, *Instagram reels*, *Google reviews* and *Page text*.
3. Make your change and press **Save**. The live site updates about a
   minute later.

**Watch listing status:**
- `available`: shown on the site.
- `on-hold`: shown with an "On hold" badge.
- `sold`: shown as sold, with no inquire button.
- `draft`: only shown in preview builds, never on the live site.
- `hidden`: not shown anywhere.

If the price is left blank, the listing shows "Inquire for price".
The Watches section and its menu link disappear automatically when there
are no listings.

**Instagram:** paste a reel's link, such as
`https://www.instagram.com/reel/XXXX/`, into *Instagram reels*.

## Hosting (Cloudflare Pages)

- Framework preset: **None**
- Build command: `node build.js`
- Build output directory: `dist`

## Build locally (optional)

```
node build.js            # production build → dist/
node build.js --drafts   # also show draft listings
```
