# MuaazMed GEMP1 EYE (2026)

An independent Wits GEMP1 end-of-year revision platform on GitHub Pages.

## Included and working for guests

- 66 conditions verified from the **red-coloured text** in the user-supplied Wits core list (pp. 5–7).
- Every note includes presenting features, mechanism, findings, investigations, safety, differentials, exam memory hook and VSAQ.
- 50 clinical case clusters and 550 questions: 31 student-bank clusters (417 questions) plus 19 new author-created clusters (133).
- Two separate timed mock papers: 120 questions and 180 minutes each, about 18 clusters per paper.
- Four-option SBAs, data interpretation, short VSAQs, answer review and self-marking.
- Saved learning status, personal performance, bookmarks and local JSON export.
- Guest mode with no login wall. Legacy Renal/GIT/Past Papers and the MSK platform remain accessible.
- 72 user-provided Google Drive lecture reference links; original PDFs are not republished.

**Academic source labels:** Wits official guide defines exam format; the question bank is student-contributed and new questions are original practice, NOT Wits past-paper questions. No grade can be guaranteed.

## Deploy

Host this repository through GitHub Pages using the main branch/root. Keep the existing CNAME for muaazmed.com. The new homepage is index.html and all assets/data paths are relative. Individual files stay below GitHub's browser upload threshold.

## Activate optional accounts, progress sync and community scoreboard

Accounts and online scoreboard are NOT active until you connect an external backend. Guest mode works immediately.

1. Create a Supabase project and run supabase/schema.sql in its SQL Editor.
2. Enable email-password authentication and confirmation; set Site URL to https://muaazmed.com. Add the correct allowed redirects.
3. Edit backend-config.js and set the Supabase URL and PUBLISHABLE key only. This key may be public when Row Level Security is correctly configured.
4. Deploy the site. Users can then create an optional account and sync learning progress.
5. Public leaderboard participation must be opted into; the SQL function exposes nicknames and mock best scores only.

**Limitations:** Cloud sync is last-write oriented, not conflict-safe for concurrent devices. Client-submitted mock scores are not cheat-resistant, so the scoreboard is for personal motivation, not formal academic ranking.

## Activate the AI tutor

GitHub Pages is static; it cannot securely store an OpenAI API secret or itself run an AI API. The secure backend implementation is supplied under supabase/functions/ask-ai/index.ts, but you must deploy it and provide credentials.

From a repository checkout with Supabase CLI connected to your project:

    supabase link --project-ref YOUR_PROJECT_REF
    supabase functions deploy ask-ai
    supabase secrets set OPENAI_API_KEY="YOUR_SECRET"
    supabase secrets set OPENAI_MODEL="gpt-6-luna"
    supabase secrets set AI_ALLOWED_ORIGINS="https://muaazmed.com,https://www.muaazmed.com"

The function checks signed-in users, rate-limits requests in the database and calls the OpenAI Responses API. If the model is not available in your account, choose an accessible model. NEVER publish an OpenAI API key, Supabase service_role key, or other secret in browser JavaScript, GitHub Pages, README or public config.

The site includes on-question authored explanations immediately even without AI. AI answers may err; verify against course materials and supervised clinical teaching.

## File map

- index.html — redesigned public entry page
- assets/main.css and assets/app.js — UI and interactions
- data/core-part-a.js, core-part-b.js, core-part-c.js — 66 exam-focused summaries
- data/bank.js — student-bank cases and lecture links
- data/extra-part-a.js, extra-part-b.js — new original cases
- backend-config.js — blank, public backend configuration
- supabase/schema.sql — RLS, progress storage, optional scoreboard and AI quota
- supabase/functions/ask-ai/index.ts — authenticated AI proxy
- legacy.html and msk.html — preserved existing content

## Content, medical and copyright note

The 66 summaries are original syntheses of the user-provided scope and medical study material, NOT exhaustive verified lecture transcripts. The 417 student-authored question-bank items may require permission before public redistribution. Do not publish or redistribute private friends' notes or lecturer PDFs without permission. A 90%+ result requires active study and review, not any site guarantee.

Test by running: python -m http.server 8000
Then open localhost:8000. JavaScript syntax: node --check assets/app.js
