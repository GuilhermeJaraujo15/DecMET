// Opt in only successful public responses. Browser freshness stays at zero.
export function disableResponseCache(res) {
  res.set("Cache-Control", "no-store");
  res.set("CDN-Cache-Control", "no-store");
  res.set("Vercel-CDN-Cache-Control", "no-store");
}

export function cachePublicResponse(res, ttlSeconds) {
  const ttl = Math.floor(ttlSeconds);
  if (!Number.isFinite(ttl) || ttl < 1 || res.statusCode !== 200) {
    disableResponseCache(res);
    return;
  }

  res.set("Cache-Control", "public, max-age=0, must-revalidate");
  // Other CDNs should revalidate; only Vercel receives shared freshness.
  res.set("CDN-Cache-Control", "public, max-age=0, must-revalidate");
  res.set("Vercel-CDN-Cache-Control", `public, s-maxage=${ttl}, must-revalidate`);
}
