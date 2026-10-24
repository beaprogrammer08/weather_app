(() => {
  "use strict";

  const CITIES = ["New Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Patna", "Jaipur", "London"];
  const $ = (selector) => document.querySelector(selector);
  const form = $("#search-form");
  const input = $("#city-input");
  const searchButton = $("#search-button");
  const chipsContainer = $("#city-chips");
  const dashboard = $("#weather-dashboard");
  const statusMessage = $("#status-message");
  const rawTab = $("#raw-tab");
  const formattedTab = $("#formatted-tab");
  const jsonView = $("#json-view");
  const jsonContent = $("#json-content");
  const copyButton = $("#copy-button");
  const responseLabel = $("#response-label");

  let latestRequestId = 0;
  let currentRawBody = "";
  let currentParsed = null;
  let currentMode = "raw";
  let selectedCity = "";

  function setStatus(message, kind = "") {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${kind}`.trim();
  }

  function setLoading(isLoading) {
    dashboard.setAttribute("aria-busy", String(isLoading));
    searchButton.disabled = isLoading;
    searchButton.innerHTML = isLoading ? "<span>Loading…</span><span aria-hidden=\"true\">↻</span>" : "<span>Explore</span><span aria-hidden=\"true\">↗</span>";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function moodFor(current) {
    const temp = Number(current.temp_c);
    const humidity = Number(current.humidity);
    const wind = Number(current.wind_kph);

    // Priority order is intentional: extreme temperature wins, then muggy,
    // then strong wind, then the two comfortable ranges, then Mixed.
    if (temp >= 38) return { name: "Scorching", icon: "☀", explanation: "The heat is intense. Seek shade, drink water, and take it slow." };
    if (temp <= 5) return { name: "Freezing", icon: "❄", explanation: "A serious chill is in the air. Layer up before heading out." };
    if (humidity >= 80 && temp >= 28) return { name: "Muggy", icon: "≋", explanation: "Warm air and high humidity can feel sticky and heavy." };
    if (wind >= 30) return { name: "Windy", icon: "↝", explanation: "Strong breezes are part of the picture. Secure loose items outdoors." };
    if (temp >= 20 && temp <= 30 && humidity <= 60 && wind <= 20) return { name: "Pleasant", icon: "✳", explanation: "A lovely balance of warmth, moisture, and breeze. Enjoy being outside." };
    if (temp >= 15 && temp <= 30 && humidity <= 75 && wind <= 30) return { name: "Comfortable", icon: "◌", explanation: "Conditions look fairly balanced for everyday plans." };
    return { name: "Mixed", icon: "◒", explanation: "A few conditions are pulling in different directions. Check the details before planning." };
  }

  function renderDashboard(data) {
    const location = data.location || {};
    const current = data.current || {};
    const mood = moodFor(current);
    const condition = current.condition || {};
    const iconUrl = condition.icon ? `https:${condition.icon}` : "";
    const localTime = location.localtime || "Local time unavailable";
    const placeParts = [location.name, location.region, location.country].filter(Boolean);
    const place = placeParts.length ? placeParts.join(", ") : "Unknown location";

    dashboard.innerHTML = `
      <div class="weather-layout">
        <article class="weather-main">
          <div class="location-line"><span class="location-pin" aria-hidden="true">⌖</span><strong>${escapeHtml(location.name || "Unknown city")}</strong><span class="location-sub">${escapeHtml([location.region, location.country].filter(Boolean).join(" · "))}</span></div>
          <div class="local-time">${escapeHtml(localTime)} LOCAL TIME</div>
          <div class="temperature-row">
            <div class="temperature">${Number.isFinite(Number(current.temp_c)) ? Math.round(Number(current.temp_c)) : "—"}<span style="font-size:.48em;vertical-align:top;letter-spacing:-.04em">°C</span></div>
            ${iconUrl ? `<img class="condition-icon" src="${escapeHtml(iconUrl)}" alt="${escapeHtml(condition.text || "Weather condition")}" width="84" height="84">` : ""}
          </div>
          <div class="condition-text">${escapeHtml(condition.text || "Condition unavailable")}</div>
          <div class="feels-like">Feels like ${Number.isFinite(Number(current.feelslike_c)) ? `${Number(current.feelslike_c).toFixed(1)}°C` : "—"} · Updated ${escapeHtml(current.last_updated || "time unavailable")}</div>
        </article>
        <article class="mood-card" data-mood="${escapeHtml(mood.name)}">
          <div class="mood-label">THE ATMOS MOOD</div>
          <div>
            <div class="mood-icon" aria-hidden="true">${mood.icon}</div>
            <h3 class="mood-title">${escapeHtml(mood.name)}</h3>
            <p class="mood-description">${escapeHtml(mood.explanation)}</p>
            <div class="mood-accent"></div>
          </div>
        </article>
      </div>
      <div class="metrics-grid">
        <article class="metric-card"><div class="metric-label">HUMIDITY</div><div class="metric-value">${Number.isFinite(Number(current.humidity)) ? escapeHtml(current.humidity) : "—"}<span class="metric-unit"> %</span></div></article>
        <article class="metric-card"><div class="metric-label">WIND SPEED</div><div class="metric-value">${Number.isFinite(Number(current.wind_kph)) ? Number(current.wind_kph).toFixed(1) : "—"}<span class="metric-unit"> km/h</span></div></article>
        <article class="metric-card"><div class="metric-label">UV INDEX</div><div class="metric-value">${current.uv !== undefined ? escapeHtml(current.uv) : "—"}</div></article>
        <article class="metric-card"><div class="metric-label">CLOUD COVER</div><div class="metric-value">${current.cloud !== undefined ? escapeHtml(current.cloud) : "—"}<span class="metric-unit"> %</span></div></article>
      </div>`;
    setStatus(`Showing current conditions for ${place}.`, "success");
  }

  function syntaxHighlight(json) {
    const escaped = escapeHtml(json);
    return escaped.replace(/("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\\s*:)|("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")|\\b(true|false)\\b|\\b(null)\\b|(-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)/g,
      (match, key, string, bool, nil, number) => {
        if (key) return `<span class="json-key">${key}</span>`;
        if (string) return `<span class="json-string">${string}</span>`;
        if (bool) return `<span class="json-boolean">${bool}</span>`;
        if (nil) return `<span class="json-null">${nil}</span>`;
        if (number) return `<span class="json-number">${number}</span>`;
        return match;
      });
  }

  function updateInspector() {
    const rawTabActive = currentMode === "raw";
    rawTab.classList.toggle("active", rawTabActive);
    formattedTab.classList.toggle("active", !rawTabActive);
    rawTab.setAttribute("aria-selected", String(rawTabActive));
    formattedTab.setAttribute("aria-selected", String(!rawTabActive));
    jsonView.setAttribute("aria-labelledby", rawTabActive ? "raw-tab" : "formatted-tab");

    if (!currentRawBody) {
      jsonContent.textContent = "Search for a city to inspect the response.";
      responseLabel.textContent = "WAITING FOR REQUEST";
      copyButton.disabled = true;
      return;
    }

    responseLabel.textContent = currentParsed && currentParsed.location ? "WEATHER RESPONSE" : "API RESPONSE";
    copyButton.disabled = false;
    if (currentMode === "raw") {
      // Keep the exact response text from the proxy in raw mode.
      jsonContent.textContent = currentRawBody;
    } else {
      const formatted = currentParsed ? JSON.stringify(currentParsed, null, 2) : currentRawBody;
      jsonContent.innerHTML = syntaxHighlight(formatted);
    }
  }

  async function searchCity(city) {
    const query = String(city || "").trim();
    if (!query) {
      setStatus("Please enter a city name.", "error");
      input.focus();
      return;
    }
    if (query.length > 100) {
      setStatus("Please use a city name shorter than 100 characters.", "error");
      return;
    }

    const requestId = ++latestRequestId;
    selectedCity = query;
    input.value = query;
    renderChips();
    setLoading(true);
    setStatus(`Looking up ${query}…`);
    dashboard.innerHTML = `<div class="empty-state"><div class="empty-orbit"><span>↻</span></div><p class="eyebrow">CHECKING THE SKY</p><p>Fetching current conditions for ${escapeHtml(query)}.</p></div>`;

    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      const body = await response.text();

      // Ignore any result that belongs to an older search.
      if (requestId !== latestRequestId) return;

      currentRawBody = body;
      try {
        currentParsed = JSON.parse(body);
      } catch {
        currentParsed = null;
      }
      updateInspector();

      if (!response.ok) {
        const apiMessage = currentParsed?.error?.message || currentParsed?.error || currentParsed?.message;
        const fallback = response.status === 429 ? "Too many requests. Please wait and retry." :
          response.status >= 500 ? "The weather service is temporarily unavailable. Please retry." :
          "We couldn't find that city. Check the spelling and try again.";
        dashboard.innerHTML = `<div class="empty-state"><div class="empty-orbit"><span>!</span></div><p class="eyebrow">WEATHER UNAVAILABLE</p><p>${escapeHtml(typeof apiMessage === "string" ? apiMessage : fallback)}</p></div>`;
        setStatus(`Request failed (${response.status}). You can correct the city or retry.`, "error");
        return;
      }

      if (!currentParsed || !currentParsed.location || !currentParsed.current) {
        dashboard.innerHTML = `<div class="empty-state"><div class="empty-orbit"><span>!</span></div><p class="eyebrow">UNEXPECTED RESPONSE</p><p>The service returned data we couldn't recognize. Please retry.</p></div>`;
        setStatus("The API response was not in the expected format.", "error");
        return;
      }

      renderDashboard(currentParsed);
    } catch {
      if (requestId !== latestRequestId) return;
      currentRawBody = JSON.stringify({ error: "Network request failed. Check your connection and try again." }, null, 2);
      currentParsed = JSON.parse(currentRawBody);
      updateInspector();
      dashboard.innerHTML = `<div class="empty-state"><div class="empty-orbit"><span>↯</span></div><p class="eyebrow">CONNECTION INTERRUPTED</p><p>Check your connection and try searching again.</p></div>`;
      setStatus("Network error. Please check your connection and retry.", "error");
    } finally {
      if (requestId === latestRequestId) setLoading(false);
    }
  }

  function renderChips() {
    chipsContainer.innerHTML = CITIES.map((city, index) => `
      <button type="button" class="city-chip" data-city="${escapeHtml(city)}" aria-pressed="${selectedCity.toLowerCase() === city.toLowerCase()}">
        <span style="opacity:.45;font-family:'DM Mono',monospace;font-size:9px;margin-right:5px">${String(index + 1).padStart(2, "0")}</span>${escapeHtml(city)}
      </button>`).join("");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchCity(input.value);
  });

  chipsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-city]");
    if (button) searchCity(button.dataset.city);
  });

  rawTab.addEventListener("click", () => { currentMode = "raw"; updateInspector(); });
  formattedTab.addEventListener("click", () => { currentMode = "formatted"; updateInspector(); });

  copyButton.addEventListener("click", async () => {
    if (!currentRawBody) return;
    try {
      await navigator.clipboard.writeText(currentRawBody);
      copyButton.innerHTML = "<span aria-hidden=\"true\">✓</span> Copied";
      window.setTimeout(() => { copyButton.innerHTML = "<span aria-hidden=\"true\">▢</span> Copy JSON"; }, 1400);
    } catch {
      setStatus("Clipboard access was blocked by your browser. Select the JSON and copy it manually.", "error");
    }
  });

  renderChips();
  updateInspector();
})();
