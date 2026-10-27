const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

let server;
let baseUrl;
let serverOutput = '';

before(async () => {
  const port = 41000 + Math.floor(Math.random() * 15000);
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_ANON_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.setEncoding('utf8').on('data', chunk => { serverOutput += chunk; });
  server.stderr.setEncoding('utf8').on('data', chunk => { serverOutput += chunk; });

  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become healthy.\n${serverOutput}`);
});

after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
  if (server.exitCode === null) server.kill('SIGKILL');
});

test('health and status endpoints report a running game server', async () => {
  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { ok: true, players: 0 });

  const statusResponse = await fetch(`${baseUrl}/api/status`);
  assert.equal(statusResponse.status, 200);
  assert.deepEqual(await statusResponse.json(), { game: 'Browser Arena', players: 0, maxPlayers: 24 });
});

test('leaderboard accepts a score and returns it in ranked results', async () => {
  const name = 'CI Test Player';
  const submit = await fetch(`${baseUrl}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score: 42, kills: 2, wins: 4 })
  });
  assert.equal(submit.status, 200);
  const submitted = await submit.json();
  assert.equal(submitted.ok, true);
  assert.equal(submitted.persistent, false);
  assert.equal(submitted.entries[0].name, name);
  assert.equal(submitted.entries[0].score, 42);
  assert.equal(submitted.entries[0].rank, 1);

  const read = await fetch(`${baseUrl}/api/leaderboard`);
  assert.equal(read.status, 200);
  const data = await read.json();
  assert.equal(data.entries.some(entry => entry.name === name && entry.score === 42), true);
});
