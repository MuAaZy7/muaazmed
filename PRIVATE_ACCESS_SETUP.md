# Activate invitation-only MuaazMed (email/password, no Google)

The code is ready, but the database, email sender and private hosting require owner setup.
**Do not treat the existing public GitHub Pages deployment as private.** Login is optional there, because the underlying files are publicly accessible. The Worker blocks all study pages AND asset URLs, not just the home page, once deployed.

## 1. Supabase
1. Create a project at https://supabase.com/dashboard. Keep the database password private.
2. SQL Editor: execute `supabase/install.sql` (contains both `supabase/schema.sql` and `supabase/invite-membership.sql` in order). The second file adds invitation membership, private tables, atomic redemption and member-only row-level policies.
3. Authentication: enable email/password and email confirmation; configure Site URL `https://muaazmed.com`, allow the exact callback `https://muaazmed.com/account.html` (and staging worker URL while testing). Configure custom SMTP for student verification/reset emails. Built-in SMTP only sends to project team members.
4. Use the project URL and public publishable key (NOT the service role/secret key) in `backend-config.js` for preview, and in `wrangler.jsonc` vars for protected hosting. Do not paste secrets in GitHub.
5. Register your own owner account with email, confirm it, then bootstrap its admin membership in SQL Editor using the commented query at the bottom of `supabase/invite-membership.sql`. The verified owner account gets admin controls without an invitation. The signup form requires a nonempty code field; for owner bootstrap use a placeholder and ignore activation until SQL bootstrap is complete. Do not create a default public admin password or code.
6. Sign in at `/account.html`, create a single-use invitation, test with a second confirmed email. Students may create a pending auth identity before redeeming a code, but cannot activate membership or use member-only APIs without it.

## 2. Private hosting (Cloudflare Worker)
1. From a local checkout, set the public project URL/key in `wrangler.jsonc`. Run `node hosting/build.mjs`, then `npx wrangler login` and `npx wrangler deploy`. Use HTTPS. The Worker uses run_worker_first=true to check membership on every request, including direct JS/HTML requests. The login page and its own assets are public; all other assets require active membership. JWT cookies are HttpOnly, Secure, SameSite=Lax. Expired sessions require re-establishing the cookie through the account page; no refresh token is stored in the cookie.
2. Test the temporary Worker URL: logged-out requests to /, /data/bank.js, /legacy.html and /flashcards.html must fail or redirect; invalid/expired/revoked codes must fail; authorized students must be able to load study materials. Test suspension and restoration. Add the staging URL to Supabase allowed redirects if necessary.
3. Before calling the platform private: stop GitHub Pages deployment, make the source repository private (and remove any other public copies or mirrors you control), and connect muaazmed.com to the Worker using a custom domain. Verify direct GitHub Pages URLs no longer serve the bank. DNS and GitHub visibility changes are owner actions. Existing public copies/caches/forks cannot be retroactively recalled. Keep a backup; verify staging before switching the production domain. Review Cloudflare usage limits; per-asset membership checks consume requests and database calls.
4. Verify that no study files are available from old hosting or an alternate subdomain. Auth cannot prevent authorized members from copying downloaded content.

## 3. Study leaderboard
The two Paper 2 120-question mock study sets automatically submit completed results for signed-in active members. A unique attempt ID prevents duplicate uploads of the same browser session. Skipped/incomplete attempts do not qualify. Students choose an opt-in nickname on the account page; email addresses are not exposed on the leaderboard. The board filters by mock A/B or both. These scores are client-reported and self-marked, so **not anti-cheat secure**; no formal assessment claims. Additional weekly/streak/accuracy rankings are not implemented.

## 4. Checks before activation
- Confirm invalid/revoked/expired/exhausted codes cannot activate accounts; concurrent redemption cannot exceed max uses; an ordinary member cannot create/revoke invites or list member emails.
- Confirm anonymous, pending and suspended users cannot access private pages or progress/score APIs.
- Confirm one account cannot access another account's progress, and that opt-out/suspension removes leaderboard listing.
- Confirm email verification, password reset, sign-out, mobile use, and full mock submission. Review privacy notice and source-material redistribution permissions before sharing.
- Existing legacy/local progress is not automatically migrated into a new account; local device data may remain. Do not share devices without clearing local study data.

Docs: https://supabase.com/docs/guides/auth/passwords · https://supabase.com/docs/guides/auth/auth-smtp · https://developers.cloudflare.com/workers/static-assets/binding/
