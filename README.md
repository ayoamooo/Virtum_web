<p align="center">
  <img src="assets/img/virtum-logo.png" alt="Virtum" width="168">
</p>

# Virtum

Virtum is a browser-based wellness tracker with a small Node.js API. Users can record daily measurements, review trends, set goals, and ask the configured assistant for general information.

## Project summary

The repository contains a static HTML, CSS, and JavaScript client plus an Express API backed by SQLite. It is a personal tracking prototype, not a clinically validated decision-support system.

**Keywords:** wellness tracking, web application, SQLite, data visualisation, REST API

## Features

- Dashboard for steps, heart rate, blood pressure, hydration, sleep, and other recorded values
- Metric history and charts
- Account registration, login, verification, and session handling
- Optional Firebase and Auth0 authentication paths
- Optional assistant endpoint configured through an OpenRouter-compatible API

## Run locally

### Requirements

- Node.js 18 or later
- npm

### Start the application

```bash
cd backend
npm ci
cp .env.example .env
# Set a strong local JWT_SECRET and any providers you intend to use.
npm start
```

Open [http://localhost:5001/virtum.html](http://localhost:5001/virtum.html). The API health endpoint is [http://localhost:5001/api/health](http://localhost:5001/api/health). The port can be changed with `PORT` in `backend/.env`.

### Configuration

The backend reads configuration from `backend/.env`. Most integrations are optional. For a local run without email or AI services, leave those provider keys unset and use a development-only `JWT_SECRET`. For deployment, set `NODE_ENV=production`, configure `ALLOWED_ORIGINS` for the deployed domain, and keep credentials in the host's secret store.

SQLite data is stored locally by the backend. The database and `.env` are ignored by Git; `backend/.env.example` lists the supported configuration keys.

## Technical outline

| Layer | Implementation |
| --- | --- |
| Client | HTML, CSS, JavaScript, Bootstrap, Chart.js |
| API | Node.js and Express |
| Persistence | SQLite |
| Optional services | Firebase Auth, Auth0, email provider, OpenRouter-compatible chat endpoint |

## Academic scope and limitations

The app stores and visualises personal measurements. The repository does not establish clinical accuracy, safety, or health outcomes. Assistant responses depend on the selected provider and are not medical advice. Privacy and terms pages are included as project pages; they should be reviewed for the laws and services relevant to any real deployment.

## References

- [Express documentation](https://expressjs.com/)
- [SQLite documentation](https://www.sqlite.org/docs.html)
- [Chart.js documentation](https://www.chartjs.org/docs/latest/)
- [Bootstrap documentation](https://getbootstrap.com/docs/5.3/)

## License

No repository-level license is included. Contact the author before reusing the project.
