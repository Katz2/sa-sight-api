# Demo video: script and recording guide (about 90 seconds)

**Use fake data only.** Do not record real tips, real locations or real people.

## Before recording
1. Start the app with `EXPO_PUBLIC_DEMO_MODE=1` (Mac: `EXPO_PUBLIC_DEMO_MODE=1 EXPO_PUBLIC_API_URL=http://<laptop address>:8080 npx expo start -c`). Without it the app blocks screen recording, which is why recordings come out black. **Never ship a release with this set.**
2. Run the API in demo mode with `DEMO=1`, `STORE=firestore` and a long random `DEMO_STAFF_TOKEN` (32+ characters, set at deploy time, never committed).
3. Clear the app's data (or reinstall) so the first-launch guide plays.
4. Record the phone with its built-in screen recorder. Use a laptop terminal for the officer step. Add voiceover afterwards.

## Shot list
| Time | On screen | Voiceover |
|---|---|---|
| 0:00 to 0:10 | Title card: SA Sight | "People see crime but stay silent, because a tip can be traced back to them." |
| 0:10 to 0:30 | First-launch guide, scenes 1 to 3, then tap Next through the rest | "SA Sight is anonymous: no account, encrypted on the phone, only a rough area shared." |
| 0:30 to 0:50 | Report: pick a category, type a fake message, tap Encrypt and send | "The message is sealed on the phone before it is sent. Only SAPS can open it." |
| 0:50 to 1:00 | Receipt screen showing the claim code (fake tip only) | "The tipster gets one short claim code, shown once." |
| 1:00 to 1:15 | Check a tip shows Assigned; terminal: officer verifies with `curl -X POST <API>/api/tips/<staff reference shown on the receipt screen>/verify -H "Authorization: Bearer $DEMO_STAFF_TOKEN"` (hide the token) | "The tip was matched to a case. A SAPS officer verifies it." |
| 1:15 to 1:30 | Claim a reward: voucher code appears; then Quick exit | "Verified tips earn a one-time voucher, with no name needed. Safe, verifiable, rewarded." |

## Why the guide shows only once
The app stores one harmless flag after the guide is seen. To show it again for a recording, clear the app's data or reinstall.
