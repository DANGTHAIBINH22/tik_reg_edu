# tiktok-reg-edu

Register TikTok accounts through Google OAuth on GoLogin profiles. Split out of the `facebook-clone` repo from `reg_edu_new.js` + `clone_edu_new.js`.

## Setup
```bash
npm install
cp .env.example .env   # fill in GOLOGIN_API_TOKEN, X_TOKEN, ...
```
GoLogin app must be installed (local API on `localhost:36912`).

## Run
```bash
node reg_edu_run.js <os> <profiles> <alias> <cron> <maxConcurrent> <isStopUsername> <finishAtUsername>
node reg_edu_run.js mac 5 VN 1 30 false false
```

## Layout
| Path | Role |
|---|---|
| `reg_edu_run.js` | Entry: args, proxies, worker pools |
| `reg_edu_flow/` | Flow modules (profile pool, Google login, OAuth popup, signup state machine) |
| `reg_edu_flow/ua_version.js` | Chrome major version state (`reg_edu_ua_major.txt`, starts at 147; bumped on `/login/download-app`) |
| `helper.pup.js`, `utils.js`, `create_go.js`, ... | Shared helpers copied from the parent repo |
| `pexels/` | Avatar images |

## Notes
- Chrome < 147 is upgraded to 154 by `create_go.js`, which breaks the arxlabs proxy; use 147–150.
- Proxy credentials are hard-coded in `reg_edu_run.js` (parity with the original) — move them to `.env` before sharing the repo.
