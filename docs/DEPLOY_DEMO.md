# Demo deployment on Firebase (synthetic data only)

Backend = **Cloud Run** (the API, run as a container) behind **Firebase Hosting** (`https://<project>.web.app/api/...`), data in **Firestore** (locked: only the API can read or write). This is Firebase's standard way to host a custom backend.

## One-time setup (about 15 minutes)
1. In the Firebase console create a project (e.g. `sa-sight-demo`) and **upgrade to the Blaze plan**. Cloud Run needs billing on; a demo stays inside the free tiers. Set a budget alert (Billing, Budgets) for peace of mind.
2. Install the Firebase CLI (`npm i -g firebase-tools`) and the Google Cloud CLI, then run `firebase login` and `gcloud auth login`.
3. In the repo root run `firebase use <project-id>`.

## Deploy
`PROJECT_ID=<project-id> ./scripts/deploy-demo.sh`

It enables the services, creates the database and a restricted service account, deploys the deny-all rules, stores a random demo staff token in Secret Manager, deploys the API and then Firebase Hosting. At the end it prints the app address and the staff token.

## Use it
- Mobile app: start Expo with `EXPO_PUBLIC_API_URL=https://<project-id>.web.app`. (https works, no same-Wi-Fi trouble.)
- Verify a tip: `curl -X POST https://<project-id>.web.app/api/tips/<staff reference>/verify -H "Authorization: Bearer <printed token>"`

## Judges
The deploy sets `DEMO_AUTO_VERIFY_SECONDS=15`: a tip is verified by the system about 15 seconds after submission (the audit log records `system:demo-auto-verify`), so judges can claim a voucher without a staff login. Never enable this in production.

## Limits of this demo
- The audit log is held in memory (lost on restart), hence `--max-instances 1`.
- No rate limiting, no scanning of uploaded photos, no staff login. Production moves to AWS Cape Town with all of these.
- Photos are stored inside the tip document (about 1 MiB limit, so 3 small photos); production uses encrypted object storage.
- The Dockerfile build and the deploy script have not been run by us; expect to fix small issues on the first run.
