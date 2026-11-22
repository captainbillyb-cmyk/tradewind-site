#!/usr/bin/env node
/*
 * Trade Wind Timepieces — site builder.
 *
 * Reads the editable content in /content/*.json, renders one static
 * index.html, and copies /public (images etc.) into /dist.
 * No dependencies: runs on any Node 18+. Cloudflare Pages runs it on
 * every commit:  build command `node build.js`, output directory `dist`.
 *
 *   node build.js            production build (draft listings hidden)
 *   node build.js --drafts   preview build (draft listings shown, marked)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const SHOW_DRAFTS = process.argv.includes('--drafts');

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
const site = read('site.json');
const gallery = read('gallery.json');
const reviews = read('reviews.json');
const listings = read('listings.json');
const instagram = read('instagram.json');

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paras = (s) => String(s ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
const num = (i) => String(i + 1).padStart(2, '0');
const img = (src) => esc(String(src || '').replace(/^\/+/, '')); // relative paths work on any host / preview
const mailto = (subject) => `mailto:${site.business.email}?subject=${encodeURIComponent(subject)}`;

// Image dimensions (for layout stability) read straight from the files.
function dims(src) {
  const file = path.join(ROOT, 'public', String(src).replace(/^\/+/, ''));
  try {
    const b = fs.readFileSync(file);
    if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const kind = b.toString('ascii', 12, 16);
      if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { /* missing image: no dimensions */ }
  return null;
}
const wh = (src) => { const d = dims(src); return d ? ` width="${d[0]}" height="${d[1]}"` : ''; };
const missing = [];
const check = (src) => { if (src && !dims(src) && !fs.existsSync(path.join(ROOT, 'public', String(src).replace(/^\/+/, '')))) missing.push(src); };

// ---------- sections ----------
const visibleWatches = (listings.watches || []).filter((w) => w.status !== 'hidden' && (w.status !== 'draft' || SHOW_DRAFTS));
const hasListings = visibleWatches.length > 0;
const reels = (instagram.reels || []).filter((r) => r && r.url);
const hasReels = reels.length > 0;

const nav = [
  ['about', 'About'],
  ['services', 'Services'],
  ...(hasListings ? [['watches', 'Watches']] : []),
  ['gallery', 'Gallery'],
  ['contact', 'Contact'],
].map(([id, label]) => `<a href="#${id}">${label}</a>`).join('');

const services = `
    <section class="services" id="services"><div class="shell"><div class="eyebrow">${esc(site.services.eyebrow)}</div><h2>${esc(site.services.heading)}</h2><div class="service-grid">${
      site.services.items.map((s) => `<div class="service"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('')
    }</div>${site.services.values ? `<p class="values">${esc(site.services.values)}${site.services.values_note ? `<span>${esc(site.services.values_note)}</span>` : ''}</p>` : ''}</div></section>`;

const approach = `
    <section class="process" id="approach"><div class="shell"><div class="eyebrow">${esc(site.approach.eyebrow)}</div><h2>${esc(site.approach.heading)}</h2><div class="steps">${
      site.approach.steps.map((s, i) => `<div class="step"><div class="num">${num(i)}</div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('')
    }</div></div></section>`;

function listingCard(w) {
  const photos = (w.photos || []).filter(Boolean);
  photos.forEach(check);
  const title = [w.brand, w.model].filter(Boolean).join(' ');
  const refLine = [w.reference && `Ref. ${w.reference}`, w.year].filter(Boolean).join(' · ');
  const details = [['Condition', w.condition], ['Box & papers', w.box_papers]].filter(([, v]) => v);
  const sold = w.status === 'sold';
  const badge = { sold: 'Sold', 'on-hold': 'On hold', draft: 'Draft — not public' }[w.status];
  const price = w.price ? `<span class="price">${esc(w.price)}</span>` : `<span class="price inquire">Inquire for price</span>`;
  const subject = `Inquiry: ${[title, w.reference].filter(Boolean).join(' ')}`;
  return `<article class="listing${sold ? ' is-sold' : ''}">
        <div class="listing-photos" data-photos>${badge ? `<span class="badge ${esc(w.status)}">${badge}</span>` : ''}${
          photos.map((p, i) => `<img src="${img(p)}" alt="${esc(title)}${photos.length > 1 ? `, photo ${i + 1}` : ''}"${wh(p)} loading="lazy" decoding="async"${i === 0 ? ' class="active"' : ''}>`).join('')
        }${photos.length > 1 ? `<div class="photo-nav">${photos.map((_, i) => `<button type="button" aria-label="Show photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}</div>` : ''}</div>
        <div class="listing-body"><div class="listing-brand">${esc(w.brand)}</div><h3>${esc(w.model)}</h3>${refLine ? `<p class="listing-ref">${esc(refLine)}</p>` : ''}${
          details.length ? `<dl>${details.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''
        }${w.description ? `<p class="listing-desc">${esc(w.description)}</p>` : ''}
          <div class="listing-foot">${sold ? '<span class="price inquire">Sold</span>' : price}${sold ? '' : `<a class="button" href="${esc(mailto(subject))}">Inquire</a>`}</div></div>
      </article>`;
}

const listingsSection = hasListings ? `
    <section class="listings" id="watches"><div class="shell"><div class="eyebrow">${esc(listings.eyebrow)}</div><h2>${esc(listings.heading)}</h2>${listings.intro ? `<p class="section-intro">${esc(listings.intro)}</p>` : ''}<div class="listing-grid">
      ${visibleWatches.map(listingCard).join('\n      ')}
    </div></div></section>` : '';

const gallerySection = `
    <section class="watch-gallery" id="gallery"><div class="shell"><div class="eyebrow">${esc(gallery.eyebrow)}</div><h2>${esc(gallery.heading)}</h2><div class="gallery-grid">${
      gallery.images.filter((g) => g.image).map((g) => {
        check(g.image);
        const cls = [g.watermark && g.watermark !== 'none' ? `wm-${g.watermark}` : '', g.watermark_position && g.watermark_position !== 'standard' ? `wm-${g.watermark_position}` : ''].filter(Boolean).join(' ');
        return `<figure${cls ? ` class="${cls}"` : ''}><img src="${img(g.image)}" alt="${esc(g.alt)}"${wh(g.image)} loading="lazy" decoding="async"${g.fit === 'cover' ? ' class="fit-cover"' : ''}></figure>`;
      }).join('')
    }</div></div></section>`;

const instagramSection = hasReels ? `
    <section class="instagram" id="instagram"><div class="shell"><div class="eyebrow">${esc(instagram.eyebrow)}</div><h2>${esc(instagram.heading)}</h2><div class="reel-grid">${
      reels.map((r) => `<div class="reel"><blockquote class="instagram-media" data-instgrm-permalink="${esc(r.url)}" data-instgrm-version="14"><a class="reel-fallback" href="${esc(r.url)}" target="_blank" rel="noopener">View on Instagram</a></blockquote></div>`).join('')
    }</div>${instagram.profile_url ? `<p class="ig-follow"><a class="button" href="${esc(instagram.profile_url)}" target="_blank" rel="noopener">Follow ${esc(instagram.handle || 'on Instagram')}</a></p>` : ''}</div></section>` : '';

const reviewsSection = `
    <section class="reviews" id="reviews"><div class="shell"><div class="eyebrow">${esc(reviews.eyebrow)}</div><h2>${esc(reviews.heading)}</h2><p class="review-summary"><strong>${esc(reviews.rating)} out of 5</strong> · ${esc(reviews.count)} Google reviews <span>As of ${esc(reviews.as_of)}</span></p><div class="review-grid">${
      reviews.reviews.map((r) => {
        const n = Math.max(0, Math.min(5, Number(r.stars) || 5));
        return `<figure class="review-card"><div class="review-stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}</div><blockquote>${paras(r.text)}</blockquote><figcaption><strong>${esc(r.name)}</strong><span>Google review</span></figcaption></figure>`;
      }).join('')
    }</div></div></section>`;

const b = site.business;
const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%23081626'/%3E%3Ccircle cx='32' cy='32' r='21' fill='none' stroke='%23b9a783' stroke-width='2'/%3E%3Cpath d='M11 32h42M32 11c-10 11-10 31 0 42M32 11c10 11 10 31 0 42' fill='none' stroke='%23b9a783' stroke-width='2'/%3E%3C/svg%3E";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#081626">
  <meta name="description" content="${esc(site.seo.description)}">
  <title>${esc(site.seo.title)}</title>
  <meta property="og:title" content="${esc(site.seo.title)}">
  <meta property="og:description" content="${esc(site.seo.description)}">
  <meta property="og:type" content="website">
  <link rel="icon" type="image/svg+xml" href="${favicon}">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header"><div class="shell headrow"><a class="brand" href="#top" aria-label="Trade Wind Timepieces home"><img src="assets/trade-wind-logo.png" alt="Trade Wind Timepieces" width="140" height="140"></a><nav class="nav" aria-label="Main navigation">${nav}</nav></div></header>
  <main id="top">
    <div class="hero"><img class="hero-logo" src="assets/trade-wind-logo.png" alt="Gold globe and flowing ocean waves, Trade Wind Timepieces" width="600" height="600"><div class="shell hero-inner"><div class="eyebrow">${esc(site.hero.eyebrow)}</div><h1>${esc(site.hero.headline)}<br><em>${esc(site.hero.headline_italic)}</em></h1><p>${esc(site.hero.intro)}</p></div><div class="hero-bottom"><div class="shell">${esc(b.name)} &nbsp; / &nbsp; ${esc(b.location)}</div></div></div>
    <section class="intro" id="about"><div class="shell grid"><div><div class="eyebrow">${esc(site.about.eyebrow)}</div><h2>${esc(site.about.heading)}</h2></div><div class="copy">${paras(site.about.body)}<div class="rule"></div><div class="fine">${esc(site.about.brands)}</div></div></div></section>
    ${services}
    ${approach}
    ${listingsSection}
    ${gallerySection}
    ${instagramSection}
    ${reviewsSection}
    <section class="closing" id="contact"><div class="shell"><div class="eyebrow" style="justify-content:center">${esc(site.contact.eyebrow)}</div><h2>${esc(site.contact.heading)}</h2><p>${esc(site.contact.text)}</p><p><a href="tel:${esc(b.phone)}" style="color:var(--gold);font-size:1.5rem;text-underline-offset:5px">${esc(b.phone_display)}</a></p><a class="button" href="${esc(mailto(b.email_subject))}">${esc(site.contact.button)}</a></div></section>
  </main>
  <footer class="footer"><div class="shell footrow"><strong>${esc(b.name)}</strong><a href="mailto:${esc(b.email)}">${esc(b.email)}</a><span>${esc(site.footer.disclaimer)}</span></div></footer>
  ${hasListings ? `<script>
  document.querySelectorAll('[data-photos]').forEach(function(box){
    var imgs=box.querySelectorAll('img'), dots=box.querySelectorAll('.photo-nav button');
    dots.forEach(function(d,i){d.addEventListener('click',function(){
      imgs.forEach(function(im,j){im.classList.toggle('active',i===j)});
      dots.forEach(function(x,j){x.setAttribute('aria-current',i===j?'true':'false')});
    })});
  });
  </script>` : ''}
  ${hasReels ? '<script async src="https://www.instagram.com/embed.js"></script>' : ''}
</body>
</html>
`;

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'styles.css'), path.join(OUT, 'styles.css'));
fs.writeFileSync(path.join(OUT, 'index.html'), html);

console.log(`Built dist/index.html — ${visibleWatches.length} listing(s), ${gallery.images.length} gallery photo(s), ${reels.length} reel(s)${SHOW_DRAFTS ? ', drafts shown' : ''}.`);
if (missing.length) console.warn(`WARNING: ${missing.length} image(s) not found in /public:\n  ${[...new Set(missing)].join('\n  ')}`);
