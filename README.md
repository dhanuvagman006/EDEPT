# Participants Viewer

## Prerequisites
- Node.js 18+ (you already have Node installed)

## 1) Fetch latest data
This writes `response.json`.

```powershell
npm run fetch
```

Fetch teams (writes `teams.json`):

```powershell
npm run fetch:teams
```

Teams fetch now requires auth via environment variables (optional):

```powershell
$env:ENVISIONSIT_BEARER_TOKEN = "..."
# OR
$env:ENVISIONSIT_COOKIE = "..."
npm run fetch:teams
```

## 2) Start the local website

```powershell
npm start
```

Open:
- http://localhost:3000/site/

Use the top buttons to switch between Participants and Teams.

## Department login (only shows students)
Open:
- http://localhost:3000/site/department.html

API endpoints:
- `GET /api/departments`
- `GET /api/departments/<deptKey>/participants`

## Notes
- The server auto-refreshes `response.json` and `teams.json` on startup, and then every 10 minutes.
- Teams auto-refresh runs only if `FETCH_TEAMS=1` or teams auth env vars are set.
- To disable auto-refresh:

```powershell
$env:AUTO_REFRESH = 0
npm start
```

- To change refresh interval (minutes):

```powershell
$env:REFRESH_INTERVAL_MINUTES = 2
npm start
```

- If port `3000` is busy, run:

```powershell
$env:PORT = 3001
npm start
```
