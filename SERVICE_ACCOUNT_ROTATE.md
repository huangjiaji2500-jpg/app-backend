Service Account Key Rotation & Cleanup

Immediate steps (recommended):

1) Revoke the exposed key in GCP
- Go to Google Cloud Console → IAM & Admin → Service accounts
- Find the service account `firebase-adminsdk-...` used by your project
- Under "Keys" find the leaked key (match `private_key_id`) and Delete it (this revokes the key)

2) Create a new key
- Click "Add Key" → "Create new key" → JSON
- Download the new JSON key file and store it securely (do NOT commit to git)

3) Update Vercel environment variable
- Base64-encode the JSON file contents, e.g. (on Windows PowerShell):
  $json = Get-Content -Raw .\\new-service-account.json; $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
- In Vercel dashboard, update the project Environment Variable `FIREBASE_SERVICE_ACCOUNT` with the base64 string, then redeploy.

4) Remove local/workspace secret files from repo and CI
- Ensure `serviceAccountKey.json` and any JSON key files are added to `.gitignore` (done)
- If the key file was previously committed to Git history and pushed, rotate keys (step 1) AND consider cleaning Git history using `git filter-repo` or `bfg`.
  Example using `bfg` (run locally, **careful**):
  - Install BFG (https://rtyley.github.io/bfg-repo-cleaner/)
  - Create a file `sensitive-files.txt` containing `serviceAccountKey.json`
  - Run: `bfg --delete-files sensitive-files.txt --no-blob-protection`
  - Then run: `git reflog expire --expire=now --all && git gc --prune=now --aggressive`
  - Push forced: `git push --force`

  Note: force-pushing rewrites history and affects collaborators — coordinate before doing it.

5) Test after rotation
- Confirm your app can read the `FIREBASE_SERVICE_ACCOUNT` env var in Vercel and initialize Firebase.
- Check admin endpoints and sync flows to ensure Firestore access works.

6) Audit
- Rotate any other keys that may have been exposed (JWT_SECRET, ADMIN_PANEL_SECRET, SYNC_SECRET) — replace them and update Vercel envs.
- Review commit history for other leaked secrets.

If you want, I can:
- Generate the exact PowerShell commands to base64-encode the new JSON and update Vercel via CLI.
- Walk you through cleaning Git history with `bfg` (I can prepare the commands but will not run forced pushes without your explicit confirmation).

Security note: Revoke the exposed key immediately. Even if you remove the file from the repo now, the key can still be used if anyone has the JSON or if it was pushed to a remote — revocation is critical.
