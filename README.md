# MuaazMed GEMP1 EYE (2026)

An independent Wits GEMP1 end-of-year revision platform on GitHub Pages.

## Included and working for guests

- 66 conditions verified from the **red-coloured text** in the user-supplied Wits core list (pp. 5–7).
- Every note includes presenting features, mechanism, findings, investigations, safety, differentials, exam memory hook and VSAQ.
- **219 clinical clusters / 1,877 questions** in total. This includes 68 new challenge clusters (544 questions), 10 integrated multisystem cases and the existing student-contributed/original material. Every one of the 66 red-listed core conditions has **at least three linked clinical clusters**.
- **Practice-first interface:** timed mock pages are removed from navigation and old mock URLs redirect to Practice Questions. Historical local mock data is left intact for compatibility.
- Four-option SBAs reveal correct/incorrect and expected answer immediately; authored distractor rationales explain each option. VSAQs show the expected 1–3-word answer on submission, followed by self-marking.
- Saved learning status, personal performance, bookmarks and local JSON export.
- Guest mode with no login wall. Legacy Renal/GIT/Past Papers and the MSK platform remain accessible.
- 72 user-provided Google Drive lecture reference links; original PDFs are not republished.

**Academic source labels:** Wits official guide defines exam format; the question bank is student-contributed and new questions are original practice, NOT Wits past-paper questions. No grade can be guaranteed.


## Proper active-recall flashcards (NEW)

- **1,254 flip-to-reveal cards**, nineteen for each of the 66 GEMP1 red-listed core conditions.
- Each disease deck covers: several clinical recognition prompts, mechanisms, examination clues, investigations, interpretation of data, red flags/next steps, mimics, memory hooks and multiple VSAQs.
- An individual condition's notes page has a **Study all flashcards** action with no six-card limit.
- Dedicated **flashcards.html** page plus in-note flashcards: all-system review, system-specific review, individual disease decks, and search.
- **Due**, **New**, **Missed** and **All** session modes. Review 10/20/40/80/160 cards or a full available deck.
- **Again / Hard / Good / Easy** self-ratings with a simple progressive review schedule; Again cards are repeated once in the same session.
- The review engine saves per-card scheduling and personal progress in the same guest-mode storage as the rest of MuaazMed. The existing optional account progress snapshot also includes flashcard review records once the external backend is configured.
- Keyboard shortcuts: Space flips; 1–4 rate recall; Escape returns to the deck overview.
- These are curated original educational recall cards built from the supplied red-listed curriculum, not official Wits cards. Correctness and difficulty require regular academic review.

## Deploy

Host this repository through GitHub Pages using the main branch/root. Keep the existing CNAME for muaazmed.com. The new homepage is index.html and all assets/data paths are relative. Individual files stay below GitHub's browser upload threshold.

## Setup guide for accounts and AI

**[Follow the step-by-step browser and CLI setup guide](SETUP_BACKEND.md)**. Guest practice requires no backend; cloud accounts and AI remain inactive until the project is configured.

## Activate optional accounts and cloud progress sync

Accounts and cloud sync remain inactive until you connect an external backend. Guest mode, mistake review, practice history and personal progress work without accounts. The old mock-based community leaderboard is not displayed in the practice-first UI.

1. Create a Supabase project and run supabase/schema.sql in its SQL Editor.
2. Enable email-password authentication and confirmation; set Site URL to https://muaazmed.com. Add the correct allowed redirects.
3. Edit backend-config.js and set the Supabase URL and PUBLISHABLE key only. This key may be public when Row Level Security is correctly configured.
4. Deploy the site. Users can then create an optional account and sync learning progress.
5. Cloud progress can then store personal study state. Public practice ranking would require a separately designed, consent-based and tamper-resistant backend, not the old mock-results leaderboard.

**Limitations:** Cloud sync is last-write oriented, not conflict-safe for concurrent devices. Browser-graded practice marks and VSAQ self-marks are motivational rather than anti-cheat secure.

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
- data/extra-part-a.js through extra-part-d.js and data/extra-clusters-2.js — new original cases
- backend-config.js — blank, public backend configuration
- supabase/schema.sql — RLS, progress storage, optional scoreboard and AI quota
- supabase/functions/ask-ai/index.ts — authenticated AI proxy
- legacy.html and msk.html — preserved existing content

## Content, medical and copyright note

The 66 summaries are original syntheses of the user-provided scope and medical study material, NOT exhaustive verified lecture transcripts. The 417 student-authored question-bank items may require permission before public redistribution. Do not publish or redistribute private friends' notes or lecturer PDFs without permission. A 90%+ result requires active study and review, not any site guarantee.

Test by running: python -m http.server 8000
Then open localhost:8000. JavaScript syntax: node --check assets/app.js

## Clinical cluster expansion (Nov 2026)

- 66 new, alternate clinical cases authored for the 66 red-listed GEMP1 core conditions. All include five 4-option SBAs, one interpretation SBA and two short VSAQs (eight questions each).
- The additional cases are **original practice modelled on the Wits example format**, not copied Wits examination questions and not guaranteed to have official difficulty.
- Each condition now links to at least two cases, and the core study notes link to its deep flashcards.
- Two timed 120-mark/180-minute mock papers are preserved and continue drawing separate clusters from the core pool.
- Review clinical accuracy of new material before relying on it for high-stakes assessment.

## Core-condition study grouping (2026 GEMP1)

The site now presents core notes, flashcard decks and case-cluster filters under exactly seven subject headings:

- **Study Paper 1:** BCMH (14), CVS (12), Respiratory (12)
- **Study Paper 2:** Renal (10), GIT (20), MSK (11), Haem/Onc (12)

These are 91 subject placements covering **66 unique red-highlighted core conditions**; overlapping conditions are shown in multiple study subjects. Bone Tumour (Osteosarcoma) appears in both MSK and Haem/Onc because it bridges the two topics. This categorisation is derived from the user-supplied `GEMP1_Core_Conditions_by_Paper-3 2.pdf`, with MSK and Haem/Onc divided for navigation. **The official Wits student information guide does not guarantee which subject is tested in which paper.** The mock papers remain independent, mixed practice selections.

The Flashcards section no longer depends on browser 3D back-face rendering: revealing an answer displays a high-contrast white card with large dark text. Cards still flip conceptually (question → answer), accept Again/Hard/Good/Easy ratings and retain existing review scheduling. This change does not reset guest or account progress.

## Practice Questions redesign (November 2026)

- Main **EXAM PREP → Practice Questions** navigation, replacing the timed Mock Exam Centre.
- Questions and cases grouped by your Paper 1 (BCMH/CVS/Respiratory) and Paper 2 (Renal/GIT/MSK/Haem-Onc) study split, then by core condition in expandable sections. The official guide does **not** guarantee a fixed paper-specific distribution.
- The **Integrated clinical cases** section contains 10 original multisystem clinical presentations (80 questions: 60 four-option SBAs including data interpretation, plus 20 VSAQs) inspired by the format of the supplied *3. Example IEYA questions.pdf*, not copied from an official paper.
- SBAs reveal the expected answer and a rationale immediately after selection; the newly authored integrated cases additionally explain individual distractors. VSAQs show the short answer on submission and are self-marked for equivalent wording.
- Practice history, answer accuracy, persistent mistake review and per-case restart are available. Retrying does not erase the previous attempt history.
- The original and student-contributed cases remain available, but vary in review quality. **Challenge** items intentionally use competing diagnoses and mechanisms; their answer keys are original educational material, not Wits-validated. No question bank can guarantee 90% or an A. Verify important clinical facts against your teaching materials.

## Harder SBA expansion by core condition (November 2026)

- 66 newly authored **Advanced reasoning** clusters, one for each red-listed GEMP1 core condition, plus two distinct additional clusters to give Aplastic Anaemia and Peptic Ulcer Disease a minimum of three cases each.
- 68 new case clusters × 8 linked questions = **544 additional questions:** 408 four-option SBAs (including one data-interpretation question per cluster) and 136 VSAQs.
- The Advanced questions target close clinical alternatives, disease mechanisms, evidence-based discrimination, investigation priorities, safety and interpretation of numerical/laboratory findings. Expected VSAQs are brief 1–3-word answers in most cases.
- **Challenge** appears as a filter in Practice Questions, and challenge cases are listed first inside each Paper → Subject → Core Condition section and the relevant note's linked cases.
- Students continue to see the expected answer, an explanation and option feedback immediately after answering, then can self-review, retry and track mistakes.
- Answer options are balanced across A/B/C/D; tests checked unique IDs, complete answer sets, missing-condition coverage, VSAQ lengths and basic website interactions.
- These are independent *Wits-style* questions, **not Wits past-paper questions or faculty-validated difficulty**. Clinical precision needs continued editorial review; do not rely on any single generated question without checking source lectures where uncertain.
