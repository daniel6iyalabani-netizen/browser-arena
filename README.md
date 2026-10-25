# Browser Arena

A first-person browser shooter prototype built with Three.js and a Node.js / Socket.IO server.

## Features
- First-person mouse-look, WASD movement, sprint and pointer lock
- Three selectable fictional weapons: pulse pistol (1), arena rifle (2), burst scatter (3)
- Weapon-specific fire rates, damage, range, spread, magazines and reload times
- Smarter local training bots that pursue, strafe, retreat toward their patrol area and attack on cooldown
- Online player movement, server-checked line-of-sight-style hit rays, shared health, kills/deaths, respawns and TAB scoreboard
- Responsive HUD and menu

## Run locally
Requires Node.js 18 or newer.
```bash
npm install
npm start
```
Open http://localhost:3000 and choose **Train vs Bots**. Click the game to lock the mouse; press Escape to unlock.

## Online multiplayer
The multiplayer server must be running on a public host for friends on different networks. This repository includes `render.yaml` for deployment to Render:
1. Sign in to Render and choose **New + → Blueprint**.
2. Connect this GitHub repository and deploy the blueprint.
3. Wait for the service to finish deploying, then copy its public HTTPS URL (for example, `https://your-service.onrender.com`).
4. Open the game, paste that URL into **Multiplayer Server URL**, choose a map and team mode, then select **Join Online**. Friends use the same URL and must choose the same map and mode to enter the same lobby.
5. If connection fails, open `https://your-service.onrender.com/health` in a browser. A healthy server responds with JSON containing `\"ok\":true`.

You can also use the same server URL from a separately hosted frontend. Set `CLIENT_ORIGIN` to allowed frontend origin(s) for a tighter CORS policy. Local `http://localhost:3000` only makes the game available on your Chromebook unless you deploy the server or configure network access.

## Controls
- WASD move; mouse aim; left click fire
- R reload; Shift sprint; 1/2/3 select weapon
- TAB toggle online scoreboard; Escape release mouse

## Prototype notes
Server-side hit checks validate shot origin against the server-known player position, apply weapon cooldowns, and own damage, eliminations, deaths and respawns. This remains an early prototype: player movement and aim are still client-reported and should receive stronger server-side simulation, collision checks, anti-cheat controls and load testing before public competitive use. Three.js loads from a CDN, so the game needs internet access for the 3D engine.
