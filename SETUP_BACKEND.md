# MuaazMed — turn on accounts, scoreboard and AI explanations

The public website is **GitHub Pages**. It can show notes, flashcards and mock exams without a login, but GitHub Pages does **not** run a database or securely store an AI API key. Accounts and AI therefore need a separate **Supabase** project.

## Part A — Create the database and user accounts (browser only)

1. Visit **https://supabase.com/dashboard** and create a project. Pick a project name, a strong database password and the region you prefer. Keep that database password private.
2. In the project dashboard, open **SQL Editor → New query**.
3. Open the file [supabase/schema.sql](supabase/schema.sql) in the MuaazMed GitHub repository. Copy the SQL into the editor, review it, and click **Run**. It creates:
   - `profiles`: a display name and opt-in leaderboard setting.
   - `progress`: each user's personal saved study data.
   - `mock_results`: completed self-marked practice-paper scores.
   - Row-Level Security (RLS) policies so students can access only their own personal data.
   - An opt-in leaderboard function and an AI question-rate limiter.
4. Open **Authentication → Providers → Email**. Enable sign-up and email/password authentication. Keep **Confirm email** enabled.
5. Open **Authentication → URL Configuration**:
   - **Site URL:** `https://muaazmed.com`
   - **Redirect URLs:** allow `https://muaazmed.com/**` and, if you actively use www, `https://www.muaazmed.com/**`.
6. Under **Project Settings / API Keys**, copy the **Project URL** (`https://YOURREF.supabase.co`) and the **publishable key** (`sb_publishable_...`). Both are public client configuration values **when the SQL security rules are active**.
7. In your GitHub repo at **https://github.com/MuAaZy7/muaazmed**, open `backend-config.js`, click the pencil/edit icon and set:

```js
window.MED_BACKEND = {
  url: "https://YOURREF.supabase.co",
  publishableKey: "sb_publishable_YOUR_PUBLIC_KEY"
};
```

8. Commit the change to `main`. GitHub Pages serves the new site once deployment finishes.

**Test:** Open MuaazMed in a private window. The study sections should work immediately as a guest. Open the account menu, create an account, confirm its email, sign in, revise a core condition or rate a flashcard, then sign in on a different device to check that progress can sync. Students must opt in before their nickname appears on the community leaderboard.

**Never put a Supabase SECRET key, service_role key, database password or OpenAI API key into `backend-config.js`, HTML/JavaScript, a GitHub commit or this chat.** Use only the public publishable key on the frontend.

## Part B — Connect the AI tutor to OpenAI (server only)

The code already lives in [supabase/functions/ask-ai/index.ts](supabase/functions/ask-ai/index.ts). It is designed to validate the logged-in Supabase session, impose per-user rate limits, send a question and its source explanation to OpenAI, then return a study-oriented response. It will not respond until deployed with your own credentials.

**First**, create an OpenAI API project at **https://platform.openai.com/**. Enable billing/usage limits, then create a secret key under **https://platform.openai.com/api-keys**. Keep the key private.

**Recommended option (Supabase CLI):**

- Install the Supabase CLI; on macOS, `brew install supabase/tap/supabase`. See https://supabase.com/docs/guides/local-development/cli/getting-started.
- Clone or download the repository locally, then open a terminal inside the repository directory.
- Sign in and link the Supabase project:

```sh
supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
```

- Set the secret directly in **Supabase → Edge Functions → Secrets** under the name `OPENAI_API_KEY`. This avoids pasting it into a shell history. You may also set optional `OPENAI_MODEL` to `gpt-6-luna` and `AI_ALLOWED_ORIGINS` to `https://muaazmed.com,https://www.muaazmed.com`.
- Deploy the existing function:

```sh
supabase functions deploy ask-ai
```

Alternative: Supabase supports creating and deploying functions through its dashboard editor. Paste the repository's `ask-ai/index.ts` there and deploy; configure the function's JWT/authentication setting to require authenticated requests. The repository includes `supabase/config.toml` with `verify_jwt = true`.

**Then test:** Sign in to MuaazMed, answer a case question, open **Ask AI tutor** and type **"Explain why my answer was incorrect."** You should receive a case-specific explanation. If you see a 401 error, check email confirmation, the authenticated session and the JWT settings; if you see a 503, check the Edge Function environment keys; if you see a 502, check the OpenAI key, model availability and billing.

### Which values go where?

| Value | Where it goes | Public? |
| --- | --- | --- |
| Supabase **project URL** | `backend-config.js` | Yes |
| Supabase **publishable** key | `backend-config.js` | Yes, with RLS |
| Supabase **secret/service_role** key | Server-only Supabase environment (normally injected) | **No** |
| **OPENAI_API_KEY** | Supabase Edge Function secrets | **No** |
| **OPENAI_MODEL** | Supabase Edge Function secrets (optional) | Not sensitive |
| `AI_ALLOWED_ORIGINS` | Supabase Edge Function secrets (optional) | Not sensitive |

### What remains unavailable until connected?

- **Without Supabase:** guest notes, independent flashcards, review scheduling, case questions, timed mocks, locally saved progress and score history work.
- **With Supabase connected:** email/password accounts and cloud progress sync become available. The leaderboard shows only opt-in display names and mock best scores.
- **With the deployed Edge Function and valid OpenAI API key:** signed-in students can ask follow-up AI questions after attempting case questions.

### Operational limitations

- The current cloud progress snapshot uses a last-write approach. Avoid simultaneous practice on multiple devices until conflict resolution is added.
- Scores are calculated from the browser and VSAQs are self-marked. The scoreboard is **motivational, not cheating-resistant**.
- AI replies can be wrong. They are for student education and are not medical advice or Wits-official answers.
- The practice bank combines student-contributed material and original example-style questions. Review clinical accuracy and obtain redistribution permission before public use.
- Protect personal data, use a privacy policy for public accounts and review costs and usage caps before enabling broad signup.

Documentation: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) · [Edge Function deployment](https://supabase.com/docs/guides/functions/deploy) · [Secrets](https://supabase.com/docs/guides/functions/secrets) · [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [OpenAI API](https://developers.openai.com/api/docs).
