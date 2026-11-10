# WINGFALL - put it online

## Test on your computer
1. Install Node.js 18+ (nodejs.org)
2. In this folder: `npm install ws` then `npm start`
3. Open http://localhost:3000 in two browser tabs - you will see each other online.

## Make it public (free) - Render.com
1. Sign up at render.com with GitHub.
2. New -> Web Service -> pick the `wingfall` repo.
3. Build command: `npm install ws`   Start command: `node server.js`
4. Deploy. Share the https://....onrender.com link - anyone can play.
(Railway.app and Fly.io work the same way. Free tiers sleep when idle.)

## Steam later
Put your live link in main.js (GAME_URL), then `npm install` and `npm run dist`.
