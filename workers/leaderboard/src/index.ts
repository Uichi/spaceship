type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  all: <T = unknown>() => Promise<{ results?: T[] }>;
  run: () => Promise<unknown>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement;
};

type Env = {
  DB: D1DatabaseLike;
};

type LeaderboardEntry = {
  name: string;
  score: number;
  achievedAt: number;
};

const MAX_NAME_LENGTH = 12;
const MAX_SCORE = 10_000_000;
const MAX_LEADERBOARD_RETURN = 20;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== "string") {
    return "PLAYER";
  }

  const cleaned = raw.trim().slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : "PLAYER";
}

function normalizeScore(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }

  const score = Math.floor(raw);
  if (score < 0 || score > MAX_SCORE) {
    return null;
  }

  return score;
}

async function handleGetLeaderboard(env: Env, url: URL): Promise<Response> {
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(MAX_LEADERBOARD_RETURN, requestedLimit))
    : 10;

  const result = await env.DB.prepare(
    `SELECT player_name, score, achieved_at
     FROM leaderboard_entries
     ORDER BY score DESC, achieved_at ASC
     LIMIT ?`,
  )
    .bind(limit)
    .all<{ player_name: string; score: number; achieved_at: number }>();

  const leaderboard: LeaderboardEntry[] = (result.results ?? []).map((row: { player_name: string; score: number; achieved_at: number }) => ({
    name: normalizeName(row.player_name),
    score: Math.max(0, Math.floor(row.score)),
    achievedAt: Math.max(0, Math.floor(row.achieved_at)),
  }));

  return jsonResponse(leaderboard);
}

async function handleSubmitLeaderboard(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  const payload = body as { name?: unknown; score?: unknown };
  const name = normalizeName(payload.name);
  const score = normalizeScore(payload.score);

  if (score === null) {
    return jsonResponse({ error: "score must be a valid integer" }, 400);
  }

  const achievedAt = Date.now();

  await env.DB.prepare(
    `INSERT INTO leaderboard_entries(player_name, score, achieved_at)
     VALUES (?, ?, ?)`,
  )
    .bind(name, score, achievedAt)
    .run();

  // Keep table compact: retain top 200 only.
  await env.DB.prepare(
    `DELETE FROM leaderboard_entries
     WHERE id NOT IN (
       SELECT id FROM leaderboard_entries
       ORDER BY score DESC, achieved_at ASC
       LIMIT 200
     )`,
  ).run();

  return jsonResponse({ ok: true, name, score, achievedAt }, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return jsonResponse({ ok: true }, 204);
    }

    if (request.method === "GET" && url.pathname === "/api/leaderboard") {
      return handleGetLeaderboard(env, url);
    }

    if (request.method === "POST" && url.pathname === "/api/leaderboard/submit") {
      return handleSubmitLeaderboard(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
