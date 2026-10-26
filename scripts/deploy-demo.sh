#!/usr/bin/env bash
# Demo deployment: Firebase Hosting + Cloud Run API + Firestore. SYNTHETIC DATA ONLY.
# Needs: Firebase project on the Blaze plan (billing on; the demo stays inside free tiers),
#        gcloud and firebase CLIs logged in. Usage: PROJECT_ID=my-project ./scripts/deploy-demo.sh
set -euo pipefail
: "${PROJECT_ID:?Set PROJECT_ID, e.g. PROJECT_ID=sa-sight-demo ./scripts/deploy-demo.sh}"
REGION="${REGION:-europe-west1}"   # demo only; production moves to AWS Cape Town
SA="sa-sight-api"; SA_EMAIL="${SA}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com firestore.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com firebasehosting.googleapis.com

gcloud firestore databases create --location="$REGION" 2>/dev/null || echo "Firestore database already exists"

# Dedicated identity for the API: Firestore access only, no key file anywhere.
gcloud iam service-accounts create "$SA" 2>/dev/null || echo "Service account already exists"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA_EMAIL}" \
  --role=roles/datastore.user --condition=None >/dev/null

# Deny-all database rules: only the API (Admin SDK) can read or write.
firebase deploy --only firestore:rules --project "$PROJECT_ID"

# Demo staff token lives in Secret Manager, never in the repository.
if ! gcloud secrets describe demo-staff-token >/dev/null 2>&1; then
  openssl rand -hex 24 | tr -d '\n' | gcloud secrets create demo-staff-token --data-file=-
fi
gcloud secrets add-iam-policy-binding demo-staff-token --member="serviceAccount:${SA_EMAIL}" \
  --role=roles/secretmanager.secretAccessor >/dev/null

gcloud run deploy sa-sight-api --source . --region "$REGION" --service-account "$SA_EMAIL" \
  --set-env-vars DEMO=1,STORE=firestore,TRUST_PROXY=1,DEMO_AUTO_VERIFY_SECONDS=15 --set-secrets DEMO_STAFF_TOKEN=demo-staff-token:latest \
  --max-instances 1 --allow-unauthenticated

# Point Firebase Hosting's /api/** at the Cloud Run service in the same region.
sed -i.bak "s/\"region\": \"[^\"]*\"/\"region\": \"${REGION}\"/" firebase.json && rm -f firebase.json.bak
firebase deploy --only hosting --project "$PROJECT_ID"

echo
echo "App API address (use in the mobile app): https://${PROJECT_ID}.web.app"
echo "Test:  curl https://${PROJECT_ID}.web.app/api/saps-public-key"
echo "Demo staff token (for the verify step): $(gcloud secrets versions access latest --secret=demo-staff-token)"
