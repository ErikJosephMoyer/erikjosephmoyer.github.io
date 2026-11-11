# erikjosephmoyer.github.io

Source for [erikjosephmoyer.com](https://erikjosephmoyer.com), the personal site of Erik Moyer: a creative-writing portfolio, a technical portfolio, and a set of browser-based media tools. It is a static site with no build step, served by GitHub Pages from the `main` branch.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Home: music, books, poetry, fiction, nonfiction, humor, scholarship, readings, gizmos, contact |
| `/tech/` | Technical portfolio: experience, education, apps, analyses, publications, contact |
| `/app/` | The Bibliotecher, an installable web app that bundles the tools below |
| `/suite/` | The Alphomegenator, every tool on one page as collapsible bars |
| `/audiobooker/` | The Jibberjabberer: audiobook player |
| `/reader/` | The Bookcaster: e-book and audiobook reader |
| `/converter/` | The Transmogrifier: file converter (documents, data, images) |
| `/dictator/` | The Textualizer: speech-to-text |
| `/narrator/` | The Rhetoricizer: text-to-speech |
| `/scanner/` | The Decipherer: OCR for images and PDFs |
| `/translator/` | The Linguifier: translator |
| `/musicker/` | The Tonalizer: music decoder |
| `/typesetter/` | The Prettifier: typesetter that outputs PDFs |

## Features

- **Embedded features.** On the home, tech, Alphomegenator and Bibliotecher pages, the text link of an entry opens the feature inline (poem image, music player, video, or tool) while the thumbnail links out to the original page.
- **Navigation between features.** While a feature is open, Left and Right arrow keys, on-screen arrow buttons, and horizontal swipes on touch screens move to the previous or next feature. Arrows sit beside the page body on wide screens and overlay the feature on narrow ones. Tools that use the arrow keys themselves (Audiobooker, Reader, Narrator) keep them while a file is open.
- **Shared state.** Tools store files and progress in the browser, so a file opened in an embedded tool is already loaded on that tool's own page.
- **Installable.** `manifest.json` and `sw.js` make the site installable as a web app. Pages and images are fetched network-first, so edits show up on the next load.
- **Consistent controls.** Every dropdown uses the same custom control, font pickers preview each font, and text areas resize vertically only.

## Repository layout

```
index.html            home page
tech/                 technical portfolio
app/ suite/           Bibliotecher and Alphomegenator
audiobooker/ converter/ dictator/ musicker/ narrator/ reader/ scanner/ translator/ typesetter/
site.css  site.js     shared styles and behaviour (link bars, dropdowns, embed mode, install helper)
embed.css embed.js    inline embedding and previous/next navigation
sw.js manifest.json   service worker and web app manifest
sync.js               small cross-page storage helper
icons/                app icons (PNG)
images/               site images (WebP)
analyses/             PDFs linked from the tech page
```

## Embedding a tool

Any page can be embedded by loading it with `?embed=1`. In that mode the logo, headings, and footer links are hidden, the page reports its height to the parent, and unhandled Left/Right keys and swipes are forwarded to the parent so it can step to the next feature. A tool that should keep the arrow keys while a file is open defines `window.hasActiveFile()`; a tool with audio defines `window.emPause()`.

## Running locally

```
python3 -m http.server 8000
```

then open http://localhost:8000. The service worker works on `localhost`.

## Deploying

Commit to `main` and push. GitHub Pages publishes the result in a minute or two. Images are WebP at quality 90; convert new images with `tools/to-webp.sh photo.png`.

## Contact

[erik@erikjosephmoyer.com](mailto:erik@erikjosephmoyer.com) | [LinkedIn](https://linkedin.com/in/erikmoyer/) | [GitHub](https://github.com/ErikJosephMoyer)
