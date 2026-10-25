# Browser Arena

A first-person 3D browser shooter prototype built with Three.js and a Node.js / Socket.IO server.

## Features

- First-person mouse-look, WASD movement, sprint, and pointer-lock controls
- Stylized fictional rifle model with recoil, muzzle flash, ammo, and reload timing
- Training arena with cover, bot movement, bot health, respawns, and player health
- Optional Socket.IO online player presence and movement synchronization
- Responsive HUD and menu

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
``

Open [http://localhost:3000](http://localhost:3000). Choose **Train vs Bots** for offline practice. Click inside the game to lock the mouse; press Escape to unlock it.

## Online multiplayer

Deploy the Node server to a host that supports persistent WebSocket connections (for example, a Node-compatible app host). Set its `PORT` environment variable if required. Open the game page and enter the deployed server's base URL in **Multiplayer Server URL**, then choose **Join Online**.

For a separate static frontend host, the page must be served over HTTP(S), and `/socket.io/socket.io.js` will not exist on that static host. In that setup, update the frontend to load the Socket.IO client from the deployed server URL and configure the server's `CLIENT_ORIGIN` environment variable to your frontend origin(s).

## Controls

- **W / A / S / D** — move
- **Mouse** — aim
- **Left click** — fire
- **R** — reload
- **Shift** — sprint
- **Escape** — release mouse

## Current prototype limitations

This is an early playable prototype, not a production competitive shooter. Multiplayer currently synchronizes player positions and visual shot events. Damage and eliminations are not authoritative on the server yet, and bots are local to each browser. Add server-side movement validation, authoritative hit detection, room management, rate limiting, and persistence before public competitive deployment. Three.js is loaded from a CDN, so an internet connection is needed to load the 3D engine.
