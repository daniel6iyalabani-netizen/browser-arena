# Global leaderboard database setup

The leaderboard API works across all players connected to the same Browser Arena server immediately. Without a database, the server keeps rankings in memory, so they reset when the server restarts.

For rankings that survive restarts, use a Supabase project:

1. In Supabase, open **SQL Editor** and run the SQL below.
2. In your Render service, add environment variables \`SUPABASE_URL\` (the project URL) and \`SUPABASE_SERVICE_ROLE_KEY\` (the server-only service role key).
3. Redeploy/restart the service. Never put the service role key in browser code or commit it to Git.

\`\`\`sql
create table if not exists public.browser_arena_leaderboard (
  name text primary key,
  score integer not null default 0 check (score >= 0),
  kills integer not null default 0 check (kills >= 0),
  wins integer not null default 0 check (wins >= 0),
  updated_at timestamptz not null default now()
);

alter table public.browser_arena_leaderboard enable row level security;

create or replace function public.keep_best_browser_arena_stats()
returns trigger language plpgsql as $$
begin
  new.score := greatest(coalesce(old.score, 0), coalesce(new.score, 0));
  new.kills := greatest(coalesce(old.kills, 0), coalesce(new.kills, 0));
  new.wins := greatest(coalesce(old.wins, 0), coalesce(new.wins, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists browser_arena_keep_best on public.browser_arena_leaderboard;
create trigger browser_arena_keep_best
before update on public.browser_arena_leaderboard
for each row execute function public.keep_best_browser_arena_stats();
\`\`\`

The API accesses this table from the server using the service role key. The browser only calls the game's leaderboard endpoints. The leaderboard stores each player's best reported score, kills and wins under their callsign; callsigns are not account verification, so this prototype should not be treated as cheat-proof competitive ranking.

## Optional player accounts and season challenges

For email/password accounts, add the Supabase project's **anon/public key** as a third Render environment variable named `SUPABASE_ANON_KEY`. This key is intended for client-facing use; keep `SUPABASE_SERVICE_ROLE_KEY` private and server-only. Enable Email sign-in in Supabase Authentication. If email confirmation is enabled, players must confirm their email before signing in.

The account UI calls the server's `/api/auth/signup`, `/api/auth/login`, and `/api/auth/me` endpoints. Online Socket.IO connections include the current access token, and the server verifies it with Supabase Auth. Guest access remains enabled. Account verification identifies the player but does not make every gameplay action cheat-proof.

The season challenge panel tracks local challenge progress and cosmetic unlocks on the player's device. These are prototype progression rewards, not server-verified competitive entitlements. Ranked divisions are progression labels and should not be advertised as secure competitive ratings until match results and rating changes are computed and stored server-side.
