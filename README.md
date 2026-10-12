# Internship Radar

A free internship discovery and application-tracking dashboard. Deployed via GitHub Pages. The site is public, but application status stays in browser storage and is not synchronized.

Do not commit resumes, application backups, credentials, or personal schedules.

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
