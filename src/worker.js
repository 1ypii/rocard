function json(data, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}

async function lookup(request, env, ctx, url) {
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return json({ error: "that is not a valid roblox username" }, 400);

  const cacheKey = new Request(`${url.origin}/api/user?name=${name.toLowerCase()}&v=2`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const { success } = await env.LOOKUP_LIMITER.limit({ key: ip });
  if (!success) return json({ error: "too many lookups, try again in a minute" }, 429);

  const found = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ usernames: [name], excludeBannedUsers: false }),
  });
  if (found.status === 429) return json({ error: "roblox is rate limiting lookups, try again in a minute" }, 429);
  if (!found.ok) return json({ error: "roblox lookup failed" }, 502);

  const user = (await found.json()).data?.[0];
  if (!user) return json({ error: "no roblox user with that name" }, 404);

  const [profileRes, thumbRes] = await Promise.all([
    fetch(`https://users.roblox.com/v1/users/${user.id}`),
    fetch("https://thumbnails.roblox.com/v1/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { requestId: "head", targetId: user.id, type: "AvatarHeadShot", size: "420x420", format: "png", isCircular: false },
        { requestId: "bust", targetId: user.id, type: "AvatarBust", size: "420x420", format: "png", isCircular: false },
        { requestId: "full", targetId: user.id, type: "Avatar", size: "720x720", format: "png", isCircular: false },
      ]),
    }),
  ]);

  let created = null;
  if (profileRes.ok) created = (await profileRes.json()).created ?? null;

  const avatars = { head: null, bust: null, full: null };
  if (thumbRes.ok) {
    for (const thumb of (await thumbRes.json()).data ?? []) {
      if (thumb.state === "Completed" && thumb.requestId in avatars) avatars[thumb.requestId] = thumb.imageUrl;
    }
  }

  const ready = Boolean(created && avatars.head && avatars.bust && avatars.full);
  const res = json({ id: user.id, name: user.name, displayName: user.displayName, created, avatars }, 200, ready ? 600 : 0);
  if (ready) ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/user") return json({ error: "not found" }, 404);
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
    return lookup(request, env, ctx, url);
  },
};
