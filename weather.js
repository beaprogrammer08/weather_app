const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestBuckets = new Map();

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "unknown";
  return ip.slice(0, 80);
}

function isRateLimited(key) {
  const now = Date.now();
  const bucket = requestBuckets.get(key);

  if (!bucket || now - bucket.start >= WINDOW_MS) {
    requestBuckets.set(key, { start: now, count: 1 });
    // Keep the simple in-memory map bounded in this serverless instance.
    if (requestBuckets.size > 1000) {
      for (const [id, item] of requestBuckets) {
        if (now - item.start >= WINDOW_MS) requestBuckets.delete(id);
      }
    }
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed. Use GET." });
  }

  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  if (!city) return sendJson(res, 400, { error: "Enter a city name to search." });
  if (city.length > 100 || /[\u0000-\u001F\u007F]/.test(city)) {
    return sendJson(res, 400, { error: "City name is too long or contains invalid characters." });
  }

  if (isRateLimited(getClientKey(req))) {
    return sendJson(res, 429, { error: "Too many searches in a short time. Please wait a minute and try again." });
  }

  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "Weather service is not configured. Add WEATHERAPI_KEY in the Vercel project settings." });
  }

  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", city);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    const body = await upstream.text();

    // Forward the API response body and status, but never forward upstream headers
    // that could reveal request details or introduce unsafe browser behavior.
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(body);
  } catch (error) {
    if (error && error.name === "AbortError") {
      return sendJson(res, 504, { error: "The weather service took too long to respond. Please try again." });
    }
    return sendJson(res, 502, { error: "Could not reach the weather service. Check your connection and try again." });
  } finally {
    clearTimeout(timeout);
  }
};
