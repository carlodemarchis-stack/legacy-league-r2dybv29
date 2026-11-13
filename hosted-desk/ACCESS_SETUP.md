# Content Studio sign-in with Cloudflare Access

**Status on the demo account (13 Nov 2026): on.**
- Team: `broad-mouse-18a9.cloudflareaccess.com`, Zero Trust Free.
- Application: "Content Studio", covering `<key>/editor` and `<key>/photo` only.
- Sign-in: a code sent by email ("Email code" method).
- Policy: "Content Studio editors", allowing the listed emails.
- The team address and AUD tag are in `wrangler.jsonc` → `vars`.
- Claude manages it through the Cloudflare API, with an account token limited to Access, kept in
  `~/.config/legacy-league/cf-access-token` (never in the repo). To add or remove an editor, ask Claude, or edit the
  policy in Zero Trust → Access → Policies.

The Desk is ready for it, from Content Studio 0.19.0. Until the two settings in step 6 are on the Worker, nothing changes:
editors type a name as before.

Once they are set:

- The Studio and the photo upload pages need a Cloudflare Access sign-in.
- The Worker checks the Access token itself: its signature, that it is for this application, that it comes from this
  team, and that it has not expired.
- The editor is the token's email. A typed name is ignored, and the €10 weekly AI allowance follows the email.
- The Claude connector (`/<key>/mcp`) is **not** behind Access and keeps working on its secret link. Moving it to
  per-person sign-in is the next step.

## Steps (Cloudflare dashboard, about 15 minutes)

1. **Zero Trust → get started.**
   - Pick a team name. It gives `https://<team>.cloudflareaccess.com`.
   - Pick the Free plan (up to 50 users). The dashboard may ask for a payment card.
2. **Settings → Authentication.** "One-time PIN" (a code sent by email) works with no setup. Google or Microsoft can be
   added here later.
3. **Access → Applications → Add an application → Self-hosted.**
   - Name: `Content Studio`.
   - Session duration: 24 hours, or 1 week if you prefer fewer sign-ins.
   - Two destinations, both on domain `legacy-league-desk.legacy-league-demo.workers.dev`:
     - path `<key>/editor`
     - path `<key>/photo`
   - `<key>` is the part of the address in `EDITOR_URL.txt` between the domain and `/editor`.
   - **Do not protect the whole domain:** `/<key>/mcp` must stay reachable for the Claude connector.
4. **Policy:**
   - Action: **Allow**.
   - Include: **Emails**, then add each editor's address.
5. Save. Then open the application's **Overview** and copy the **Application Audience (AUD) tag**.
6. Give Claude the team domain and the AUD tag. Neither is a secret. They go on the Worker as:
   - `ACCESS_TEAM_DOMAIN` = `https://<team>.cloudflareaccess.com`
   - `ACCESS_AUD` = the tag

   Then redeploy.
7. **Test:**
   - Open the Studio. Cloudflare's sign-in page should appear.
   - Enter an allowed email and type the code you receive.
   - The Studio should show the email top right. Clicking it offers Sign out.

If the dashboard will not take the `workers.dev` address as a destination, the alternatives are:

- the Worker's own Cloudflare Access switch, under *Settings → Domains & Routes*, plus an Access **Bypass** application
  for the paths `<key>/mcp`, `.well-known`, `register`, `authorize` and `token`;
- a custom domain for the Desk on a zone in the account.

## Adding or removing an editor

Edit the policy's email list (step 4). Removing an address takes effect at that person's next sign-in, at most one
session length later. To cut them off at once: *Zero Trust → My Team → Users → Revoke sessions*.

## Production

This is set up on the demo's Cloudflare account. On the league's own account, repeat steps 1–6 there.
