# Internship Radar

A free internship discovery and application-tracking dashboard. Deployed via GitHub Pages. The site is public, but application status stays in browser storage and is not synchronized.

Do not commit resumes, application backups, credentials, or personal schedules.

## Navigation and interaction design

The standalone site uses principles from [OpenAI's Plugin UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines) as a **design reference**, not as an Apps SDK implementation.

- **Home** (default) contains only today's mission, three actionable next-step shortcuts, and a compact preview of recently discovered internships.
- **Top 10 matches**, **Latest jobs**, **Explore internships**, **My pipeline**, **Stats & Insights**, and **Resume Studio** remain separate, task-focused views.
- **Stats & Insights** is the dedicated destination for date-range comparisons, interactive charts, pipeline status details, and trends. Home links there rather than duplicating the analytics dashboard.
- Navigation updates the URL fragment, preserves direct links (including `#pipeline` from Resume Studio), updates `aria-current`, and respects browser Back.
- The design uses the existing system font, consistent spacing, limited accent colors, keyboard-focus styles, responsive layouts, and honest empty-state messaging.

## Personalized Daily 10 and focused apply mode

- **Home** is still the default tab; the **Daily 10** tab is a purpose-built workflow next to Home and Top 10 Matches.
- Set a preferred technical role (software, cloud/platform, AI/data, or all), location priority (DMV, Virginia, remote, or nationwide), and up to eight comma-separated skills. They are saved **only in this browser**.
- Recommendations are ranked using explainable signals: preferred role and region, job description keywords, recently discovered listings, saved jobs, and whether the lead comes from a direct employer feed. The ranking is deterministic and does **not** predict hiring success.
- The shortlist only includes leads with HTTPS job URLs and excludes existing submitted or skipped applications, including a manual submission with the same normalized application link.
- Select a job to view matching reasons, source and eligibility caveats, a job-description excerpt, the actual application link, and a role-specific Resume Studio handoff. Review every employer listing yourself.
- Click **Next recommendation** to inspect another role without losing progress, or **Save** to bookmark it. You may be shown fewer than ten jobs if fewer valid leads are available.
- **Mark as applied** remains disabled until you explicitly confirm that you have already submitted through the employer's site. The app does **not** autofill, submit, or verify applications automatically. Completed applications immediately disappear from the recommendation queue and update your daily goal.
- Rankings can shift as the live feed refreshes or you change your preferences, so this is a refreshed shortlist rather than a fixed promise of ten independently verified openings.

## Nationwide internship discovery

Internship Radar searches **across the United States**, while giving Virginia/DMV
opportunities a relevance boost. **Nationwide** is the default Explore and Latest
Jobs view for new installations; existing saved filters are respected. Daily 10
continues to treat the chosen city/region as a ranking preference, **not an
exclusion**: a strong internship in Seattle, Boston, Chicago, or anywhere else
in the U.S. can appear.

The pipeline combines:
- **52 configured official ATS employer boards** (Greenhouse, Lever, Ashby and
  bounded public Workday search), subject to availability and per-site limits.
- **14 public technical internship discovery sources**, including the original
  11 and three additional public national catalogs: Trakker US Internships,
  Big Tech Internship Tracker, and Jobbie US Listings.
- Direct HTTPS employer application links from the added catalogs. No third-party
  auto-apply or signup links are ingested. Each third-party feed remains a
  discovery lead, not guaranteed to be open.
- Canonical-URL and company/title/location deduplication across sources before
  displaying the combined catalog.
- Source health metrics. Missing or failed providers are reported rather than
  silently presented as having zero job openings.

No public aggregator can index **every company or opening** in the U.S. Some
employers require authentication, reject programmatic access, hide internship
postings in general job listings, or publish positions only through their own
websites. Broad feeds may repeat jobs, omit details, or lag closures. Always
verify the employer website before applying.

## Automatic discovery of big and small U.S. employers

The 52 manually configured employer ATS boards are a foundation, **not a ceiling**.
On every scheduled four-hour refresh, Internship Radar also inspects the
employer application URLs surfaced by all 14 public internship feeds. It
automatically discovers additional public Greenhouse, Lever, Ashby and Workday
boards, including smaller companies that are not on any hand-maintained list.

- Up to **50 additional employer ATS boards per refresh** are selected from
  discovered candidates. A deterministic rotating selection changes every
  four-hour slot, allowing other companies to be checked across the day.
- Only official ATS hostnames and well-formed job URLs are eligible. No
  arbitrary websites are crawled; no logins, private data, or mass applications.
- Short public Workday scans are capped at three pages of 20 results each.
  Other ATS endpoints are requested only once per selected employer.
- Selected sources can fail; in that case, third-party leads remain available
  with appropriate caveats instead of treating a timeout as a closure.
- The feed reports **discovered_ats_candidates**, **discovered_ats_scanned**,
  **discovered_ats_responding**, and **discovered_ats_added_before_dedup**.
  These values show the breadth and reliability of discovery, not guaranteed
  job openings or the total number of U.S. companies.
- Beyond these supported ATS platforms, employers using private job platforms,
  individual websites, or jobs that appear in no public feed may still be missed.

The core objective is *broad U.S. discovery followed by personalized ranking*,
not rewarding a large raw job count. Daily 10 continues to rank based on
the selected role, skills and location preference and removes previously
submitted or skipped roles.

## Virginia / DMV employer coverage

Internship Radar prioritizes DC, Northern Virginia, and Maryland, while retaining a nationwide search. The source configuration monitors the following **official public employer applicant-tracking feeds** in addition to broader nationwide feeds: Capital One, Fannie Mae, Booz Allen Hamilton, GDIT, Leidos, Northrop Grumman, Shield AI, Appian, and other configured ATS boards. Workday sources use a bounded, unauthenticated public search endpoint; public ATS hosts sometimes block automated requests.

Explore internships includes an **official employer watchlist** for 20 major employers, including Freddie Mac, CACI, MITRE, Navy Federal, SAIC, BAE Systems, and RTX. This directory **distinguishes three states**: direct source responding, direct source request failed, and official careers link only. Links-only companies are **not** claimed to be automatically scanned. Every listing is still subject to employer eligibility and closing-date verification.

- The refresh workflow attempts configured sources every four hours. The listing feed includes only qualifying technical internship leads found in responding sources, and failed sources are reported instead of silently labeled as having no openings.
- Source status and per-company qualifying counts refer to the most recently published feed, not a live inquiry when a user clicks the page.
- The Workday scanner limits its query to the first 240 `intern` search results per configured public board (20 postings per page) and does not guarantee every employer job, a valid application window, or fully independent closure checks.
- Offline parser/configuration checks run before publishing. A separate diagnostic checks actual source connectivity on pull requests without publishing data. Source failures aren't interpreted as closed internship programs.
- Official careers URLs are maintained in `scripts/priority_employers.json`, and direct ATS source definitions live in `scripts/boards.json`.

## Daily application mission

The **Home** page tracks real submissions toward a default goal of **10 applications per day** (changeable from Settings). It is designed to make the next meaningful application obvious—not to reward spam.

- A progress bar and milestones at 20%, 50%, 80%, and 100% of the daily goal celebrate recorded submissions.
- A seven-day activity history highlights consistency without punishing rest days or requiring streaks.
- A single next-action button opens Daily 10 (or your pipeline after completing the mission).
- Press **I applied** only after submitting through the employer's website, or add an already-submitted application in **My pipeline**.
- Saved/skipped roles and opening job links do not count. Repeated status clicks do not earn additional credit, and normalized duplicate URLs are counted once.
- Dates follow your device's local timezone. Progress derives from your existing browser-local application records; no telemetry, login, or external service.
- Application history remains exportable in Settings. Incorrect submissions can be undone in My pipeline by switching the status back to Saved or Remove.
- Goal celebrations acknowledge effort; they are **not** claims about application quality, hiring likelihood, or employer responses.

Test the dashboard and calculations before deploying with:

```bash
python scripts/test_job_descriptions.py
node scripts/test_resume_edits.cjs
node scripts/test_application_pipeline.cjs
node scripts/test_daily_progress.cjs
```

## Stats & Insights

The new **Stats & Insights** workspace turns your private, browser-local application records into an interactive dashboard:

- Toggle the analysis window between 7, 30, 90 days and all time.
- Compare application volume against the previous same-length period, see average submissions per active day, and identify days meeting your currently configured daily goal.
- Track the percentage of applications whose **current recorded status** is Assessment, Interview, Offer or Rejected. This *recorded response rate* is not a success prediction, and a rejection counts as a response.
- Click activity-chart bars and current-stage breakdowns to drill into the corresponding jobs; clear filters to return to the full range.
- See actionable prompts for saved roles, untouched applications after 14 days, and unrecorded outcomes. No automated messages are sent.
- When manually logging a previously submitted application, optionally choose the original application date so historical counts are accurate; otherwise today's date is used.

This is a **current pipeline snapshot**, not a stage-transition funnel. Historical interview/offer conversion and employer response times require a separate timestamped status-event history that is not tracked yet. Duplicate canonical URLs are excluded from summaries. Stats disappear if you clear browser data, so export backups regularly.

## Resume Studio

From an internship listing, select **Enhance resume**, or open `/resume-studio.html` to start with a custom job description.

- Upload a master resume as **PDF, DOCX, or TXT**. Parsing and version history run in the browser using same-origin JavaScript libraries. Resume text, uploaded original files, accepted edits, and job-specific drafts are stored in the browser's IndexedDB (not on GitHub).
- Update your master resume later, including adding new experience. Earlier master versions remain available locally and can be restored as a new version. Existing job drafts remain associated with the older version.
- Where possible, the daily feed includes a longer official Greenhouse, Lever, or Ashby job description. Community leads may have only an excerpt. You can paste the full employer posting to improve analysis.
- The **Resume ↔ job alignment** percentage is only the fraction of recognized technical keywords from the job description also present in the current tailored resume. **It is not an ATS system score, recruiter prediction, or guarantee of eligibility.**
- Review, edit, accept, skip, or undo deterministic wording alternatives grounded in your resume. This static, free app **does not generate AI-written rewrites** and intentionally does not invent skills, employers, or achievements.
- Download the job-specific PDF or DOCX, or download your **unaltered original uploaded file**. The tailored exports recreate a compact serif layout with section rules and indentation. They **do not byte-for-byte edit or guarantee pixel-perfect reproduction** of arbitrary source PDF/DOCX formatting. Check fonts, spacing, and page breaks before applying. For perfect original formatting, adjust an editable source resume externally.
- Your resume **is never uploaded to a server by this app**. Local browser storage can be wiped by clearing site data, private browsing, or switching devices. Keep your own backup. The source code intentionally includes **no example person's resume, contact details, or embedded PDF**.

The bundled PDF.js and jsPDF libraries retain their upstream license notices. No private resume or API credential should ever be committed to this public repository.
