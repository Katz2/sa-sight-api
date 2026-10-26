# FNB AOTY submission checklist (deadline Mon 26 Oct 2026, 23:59 SAST)

Rules: no code files are submitted; judges do not compile code, so they need an installable APK or a hosted URL.

| Requirement | How we meet it |
|---|---|
| Lean Business Canvas | Fill in on the portal (answers drafted in chat) |
| SSDLC (Security) | Fill in on the portal (five phases drafted in chat, see docs/SECURITY.md) |
| Deck (PDF) with overview, screenshots, architecture, user journey | The SA Sight deck: export as PDF. Add phone screenshots |
| APK or URL in the slides | EAS "demo" build (APK) with an install link on the "Try it" slide; it talks to the hosted API |
| Demo video, under 90 s, Drive link | Record on the phone (docs/DEMO_VIDEO.md); upload to Drive; set sharing to "anyone with the link"; paste the link on the "Try it" slide |
| Demo account and login details on slides | No account or login exists, by design. The "Try it" slide says so, and explains the demo build verifies tips automatically after about 15 seconds so judges can claim a voucher |

## Build the APK for judges (after the Firebase deploy works)
1. `cd mobile`
2. In `eas.json` replace `REPLACE-WITH-YOUR-PROJECT-ID` with your Firebase project ID (the API address is `https://<project-id>.web.app`).
3. `npx eas-cli login` (free Expo account), then `npx eas-cli init`, then `npx eas-cli build -p android --profile demo`.
4. When the build finishes, open the build page on expo.dev, copy the install/download link, and test it on your phone.
The demo build has screen recording allowed (so you can record the video). A production build keeps screenshots blocked.

## Order of work
Firebase deploy, APK build, install and test on phone, record video, add screenshots and links to the deck, export PDF, fill in the portal, submit.
