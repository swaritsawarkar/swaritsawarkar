import { mkdir, writeFile } from "node:fs/promises";

const owner = process.env.PROFILE_OWNER || "swaritsawarkar";
const token = process.env.GH_TOKEN || "";
const apiRoot = "https://api.github.com";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-lab-telemetry",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function getJson(path) {
  const response = await fetch(`${apiRoot}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${path}`);
  }
  return response.json();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shortDate(value) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

const languageColors = {
  TypeScript: "#3178c6",
  Python: "#3776ab",
  GDScript: "#478cbf",
  Java: "#b07219",
  JavaScript: "#f1e05a",
  CSS: "#663399",
  HTML: "#e34c26",
  PLpgSQL: "#336791",
  OpenSCAD: "#e5cd45",
  Batchfile: "#c1f12e",
};

const [user, allRepos] = await Promise.all([
  getJson(`/users/${owner}`),
  getJson(`/users/${owner}/repos?per_page=100&type=owner&sort=pushed`),
]);

const repos = allRepos.filter(
  (repo) =>
    !repo.fork &&
    !repo.archived &&
    repo.size > 0 &&
    repo.name.toLowerCase() !== owner.toLowerCase(),
);

const languageMaps = await Promise.all(
  repos.map((repo) => getJson(`/repos/${owner}/${repo.name}/languages`)),
);

const languageTotals = new Map();
for (const map of languageMaps) {
  for (const [language, bytes] of Object.entries(map)) {
    languageTotals.set(language, (languageTotals.get(language) || 0) + bytes);
  }
}

const totalBytes = [...languageTotals.values()].reduce((sum, bytes) => sum + bytes, 0);
const languages = [...languageTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, bytes]) => ({
    name,
    bytes,
    percent: totalBytes ? (bytes / totalBytes) * 100 : 0,
    color: languageColors[name] || "#94a3b8",
  }));

const recent = repos
  .slice()
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, 4);

const lastPush = recent[0]?.pushed_at || user.updated_at;
const updated = new Date().toISOString().slice(0, 10);

const bars = languages
  .map((language, index) => {
    const y = 258 + index * 42;
    const width = Math.max(4, Math.round(430 * (language.percent / 100)));
    return `
      <text x="60" y="${y}" class="label">${escapeXml(language.name)}</text>
      <text x="470" y="${y}" class="value" text-anchor="end">${language.percent.toFixed(1)}%</text>
      <rect x="60" y="${y + 10}" width="410" height="8" rx="4" fill="#17243a"/>
      <rect x="60" y="${y + 10}" width="${width}" height="8" rx="4" fill="${language.color}"/>
    `;
  })
  .join("");

const recentRows = recent
  .map((repo, index) => {
    const y = 258 + index * 54;
    const language = repo.language || "mixed";
    return `
      <circle cx="666" cy="${y - 5}" r="4" fill="${languageColors[language] || "#38bdf8"}"/>
      <text x="682" y="${y}" class="repo">${escapeXml(repo.name)}</text>
      <text x="1110" y="${y}" class="date" text-anchor="end">${escapeXml(shortDate(repo.pushed_at))}</text>
      <text x="682" y="${y + 22}" class="meta">${escapeXml(language)}</text>
    `;
  })
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="510" viewBox="0 0 1200 510" role="img" aria-labelledby="title desc">
  <title id="title">Public lab telemetry for ${escapeXml(owner)}</title>
  <desc id="desc">Current eligible public source repository count, language percentages by bytes, and recently pushed repositories.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07111f"/><stop offset="1" stop-color="#0b1727"/></linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#a3e635"/></linearGradient>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#7dd3fc" stroke-opacity="0.05"/></pattern>
    <style>
      .mono{font-family:Consolas,ui-monospace,monospace}.title{font:700 25px Consolas,ui-monospace,monospace;fill:#f8fafc;letter-spacing:2px}.kicker{font:14px Consolas,ui-monospace,monospace;fill:#7dd3fc;letter-spacing:2px}.stat{font:700 27px Consolas,ui-monospace,monospace;fill:#f8fafc}.statlabel{font:12px Consolas,ui-monospace,monospace;fill:#64748b;letter-spacing:1px}.section{font:700 14px Consolas,ui-monospace,monospace;fill:#a3e635;letter-spacing:2px}.label{font:15px Consolas,ui-monospace,monospace;fill:#cbd5e1}.value{font:14px Consolas,ui-monospace,monospace;fill:#94a3b8}.repo{font:700 16px Consolas,ui-monospace,monospace;fill:#e2e8f0}.meta,.date{font:13px Consolas,ui-monospace,monospace;fill:#64748b}.foot{font:12px Consolas,ui-monospace,monospace;fill:#475569}
    </style>
  </defs>
  <rect width="1200" height="510" rx="20" fill="url(#bg)"/><rect x="1" y="1" width="1198" height="508" rx="19" fill="none" stroke="#1e3a5f"/><rect width="1200" height="510" rx="20" fill="url(#grid)"/>
  <text x="50" y="48" class="kicker">PUBLIC LAB TELEMETRY // ${updated}</text>
  <text x="50" y="84" class="title">REPOSITORY SIGNAL</text>
  <rect x="50" y="100" width="1100" height="3" rx="2" fill="url(#line)"/>

  <g transform="translate(600 0)">
    <rect x="-550" y="119" width="208" height="72" rx="12" fill="#0c192b" stroke="#1e3a5f"/>
    <text x="-530" y="151" class="stat">${repos.length}</text><text x="-530" y="174" class="statlabel">SOURCE REPOS</text>
    <rect x="-328" y="119" width="208" height="72" rx="12" fill="#0c192b" stroke="#1e3a5f"/>
    <text x="-308" y="151" class="stat">${languageTotals.size}</text><text x="-308" y="174" class="statlabel">LANGUAGES DETECTED</text>
    <rect x="-106" y="119" width="256" height="72" rx="12" fill="#0c192b" stroke="#1e3a5f"/>
    <text x="-86" y="151" class="stat">${escapeXml(shortDate(lastPush))}</text><text x="-86" y="174" class="statlabel">LATEST PROJECT PUSH</text>
  </g>

  <text x="60" y="223" class="section">LANGUAGE SIGNAL // BYTES</text>
  <text x="650" y="223" class="section">RECENTLY PUSHED</text>
  ${bars}
  ${recentRows}
  <line x1="600" y1="218" x2="600" y2="459" stroke="#1e3a5f"/>
  <text x="50" y="486" class="foot">public source only • forks, archived repos, empty repos, and profile repo excluded • refreshed weekly</text>
</svg>
`;

await mkdir("assets", { recursive: true });
await writeFile("assets/public-metrics.svg", svg, "utf8");
console.log(`Rendered assets/public-metrics.svg for ${repos.length} public source repositories.`);
