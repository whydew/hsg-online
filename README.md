# HSG Online club

Plain static leaderboard, player history and scorecards. No build step or third-party assets.

Edit the API origin on the single `window.HSG_API_BASE` line in `config.js`; the default is the private local Worker at `http://127.0.0.1:8787`. Open `index.html` directly or serve this directory from any static host. The API must include the Stage-6 read routes. CORS supports local file origins.

After user approval, copy this directory to the root of a separate public repository and enable GitHub Pages from main / (root). Use the deployed HTTPS Worker origin in config.js. Hash links work under a repository subpath; no rewrites or secrets are needed.

History filters return that player's public matches in newest-first pages. Leaderboard offsets are capped at 1,000 to bound D1 costs. Results can be cached for 60 seconds. Refresh retries after errors and labels retained results stale.
