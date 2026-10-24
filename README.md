# Atmos — Weather Mood Dashboard

A minimal, responsive weather dashboard built with HTML, CSS, vanilla JavaScript, and a Node.js Vercel serverless function.

## Requirements

- Node.js 18 or newer
- A WeatherAPI account and API key
- A GitHub account
- A Vercel account

## Project structure

```text
weather-dashboard/
├── api/
│   └── weather.js       # Server-side WeatherAPI proxy
├── public/
│   ├── index.html       # Page structure
│   ├── styles.css       # Responsive styling
│   └── app.js           # Search, UI, mood engine, JSON inspector
├── .env.example         # Safe template; contains no real secret
├── .gitignore
├── package.json
└── vercel.json
```

## Deploy on Vercel (beginner-friendly)

1. Create a GitHub repository named `weather-dashboard`.
2. Upload these project files to that repository. Do not upload a real `.env` file or any API key.
3. Sign in to Vercel using GitHub and choose **Add New → Project**.
4. Import the `weather-dashboard` repository.
5. In the project configuration, add an Environment Variable:
   - Name: `WEATHERAPI_KEY`
   - Value: your current WeatherAPI key (enter it directly in Vercel; don't paste it into source code).
   - Enable it for Production and Preview as appropriate.
6. Click **Deploy**.
7. Open the deployment URL and test all ten chips, an arbitrary city, an invalid city, both JSON tabs, and Copy JSON.
8. If you change environment variables, redeploy for the changes to apply.

Vercel should detect the `/api` serverless function automatically. The static site is served from `public/`.

## Local development (optional)

Install Node.js 18+. Then, from this project folder:

```bash
npm install
npx vercel login
npx vercel dev
```

When prompted, link to a Vercel project or create a local project. Add `WEATHERAPI_KEY` to a local `.env` file (never commit it), then visit the local URL shown in your terminal. Delete the local `.env` file before sharing the project folder.

## Security notes

- The browser calls `/api/weather`; it never calls WeatherAPI directly.
- The serverless function reads `WEATHERAPI_KEY` from `process.env`.
- The included in-memory request limiter is best-effort only: Vercel can run multiple isolated instances, so it is not a global abuse-prevention system. For a high-traffic public app, use a shared rate limiter or edge firewall.
- Never commit `.env`, tokens, or API keys.
- The raw JSON inspector displays the body returned by the proxy. The WeatherAPI key is not part of that response.

## Mood priority

1. Scorching: temperature ≥ 38°C
2. Freezing: temperature ≤ 5°C
3. Muggy: humidity ≥ 80% and temperature ≥ 28°C
4. Windy: wind speed ≥ 30 km/h
5. Pleasant: temperature 20–30°C, humidity ≤ 60%, wind ≤ 20 km/h
6. Comfortable: temperature 15–30°C, humidity ≤ 75%, wind ≤ 30 km/h
7. Mixed: all other combinations

The order is deliberate, so higher-priority conditions win when thresholds overlap.
