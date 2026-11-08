# Site Updates Overview

I hear you loud and clear. Here is the complete package. Everything has been consolidated into this ZIP to avoid polluting your chat with code blocks.

## How to Apply
1. Drop `apply_updates.py` into the root folder of your local repository (`erikjosephmoyer.github.io`).
2. Open your terminal, navigate to that folder, and run: `python3 apply_updates.py`
3. Review the changes locally.
4. Commit and push:
   ```bash
   git add -A
   git commit -m "Massive sweep: layout, arrows, footers, text, and embedded element fixes"
   git push origin main
   ```

## Direct Answers to Your Prompts:

**1. Install GitHub Copilot via Terminal:**
Run this command in your terminal:
`code --install-extension GitHub.copilot`

**2. Mac Finder WebP Conversion (90% Quality):**
1. Open **Automator** on your Mac and create a new **Quick Action**.
2. Set "Workflow receives current" to **image files** in **Finder**.
3. Add a **Run Shell Script** action. Set "Pass input" to **as arguments**.
4. Paste this script:
   ```bash
   for f in "$@"; do
       /opt/homebrew/bin/cwebp -q 90 "$f" -o "${f%.*}.webp"
   done
   ```
5. Save it as "Convert to WebP". Now you can right-click any image in Finder > Quick Actions > Convert to WebP.

**3. Clear Site Data Shortcut:**
As discussed, the fastest way is using a bookmarklet. Press `Cmd+Shift+B` to show the bookmarks bar, right-click it, select **Add Page**, name it "Clear Site", and paste this exact code into the URL field:
`javascript:(async()=>{localStorage.clear();sessionStorage.clear();if(window.indexedDB){const dbs=await indexedDB.databases();dbs.forEach(db=>indexedDB.deleteDatabase(db.name));}if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();regs.forEach(r=>r.unregister());}location.reload(true);})();`
Clicking it while on your site will instantly wipe everything and hard reload.

**4. Thoughts on Embedded vs. Subpages:**
I recommend moving fully to the embedded approach. It minimizes context switching, keeps users on your primary portfolio, and leverages the swipe/arrow navigation for a seamless gallery experience. You can preserve the subpages purely as direct-link fallbacks or standalone PWA entry points.

All your requested CSS (max-height 70vh, embedded padding), text changes (unitalicizing ALR, Bibliotech rename, email update, PWA headers), JS logic (Bookcaster arrow swap, Audiobooker arrow removal), and layout cleanups (footers) have been baked into `apply_updates.py`. Run it, test it locally, and let me know if any edge cases survived.
