# Deploy MediSync AI to Render

Repository: https://github.com/taanushree06/MEDISYNC-AI

The Dockerfile builds the React frontend and runs FastAPI with one worker. FastAPI serves the built UI, REST endpoints, and WebSocket feed from the same HTTPS origin. No frontend API URL needs to be hardcoded. The server listens on Render's assigned `PORT` at `0.0.0.0`.

## Cloud database

Render cannot access MongoDB on your laptop. Use a MongoDB Atlas database or another reachable persistent MongoDB deployment. Create a dedicated database user with access to the intended application database, and allow the Render service's documented outbound addresses in Atlas Network Access. Enter the connection string directly in Render as the secret `MONGODB_URI`; never commit it or add it to frontend environment variables.

The Blueprint selects `medisync_ai` as the database. Change `MONGODB_DATABASE` if your existing cloud data is in another database. Local data is preserved and is not uploaded automatically; moving existing records requires a separate, explicit migration. Startup only inserts missing demo hospitals and ordinary shutdown preserves records. Mock storage is disabled.

## Deployment

1. Push the project and `render.yaml` to the repository's `master` branch.
2. Open https://dashboard.render.com/blueprint/new?repo=https://github.com/taanushree06/MEDISYNC-AI and connect the GitHub repository if prompted.
3. Enter `MONGODB_URI` in the Blueprint's secret prompt and apply the Blueprint. The service uses the free plan.
4. After deployment is live, open its URL and confirm `/api/health` reports `status=ok`, `mongodb=true`, `storage_mode=mongodb`, `persistent=true`.
5. In Render's service environment settings, view the generated `DEMO_OPERATOR_TOKEN`. Enter it using **Operator access** in the dashboard to use simulation and resource controls. The token stays in that browser tab's session storage and is sent in a request header. It is not embedded in the compiled frontend.
6. Verify the six hospitals, start the simulation, check forecasts and recommendations, and confirm the LIVE indicator. Do not use Reset on data you need to retain.

Gemini is optional: set `GEMINI_API_KEY` as a Render secret to enable the external explanation service; otherwise the existing deterministic explanation fallback is used.

The free web service can spin down when inactive. The simulation loop stops when its backend process stops; database records persist in Atlas. Keep one service instance and one worker for this simulation prototype.

GitHub Actions verifies backend tests, frontend build/lint, and the Linux Docker build on pushes. Docker is not installed on this local Windows workspace, so a successful local frontend build is not proof that the container has built or that Render is live.

Official references: https://render.com/docs/docker, https://render.com/docs/blueprint-spec, https://render.com/docs/free, https://www.mongodb.com/docs/atlas/security/ip-access-list/
