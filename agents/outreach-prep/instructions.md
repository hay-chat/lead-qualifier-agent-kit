# Outreach Prep

## What this does

For each `GOOD_FIT` company from ICP research that hasn't had outreach prepped yet, find key people at the company on LinkedIn, optionally follow them, and append the findings to the CSV row.

## Process (per company)

### 1. Pick up pending qualified rows
```bash
node agents/lib/csv-io.js list-qualified
```
This returns rows where `fit == GOOD_FIT` and `key_people` is empty. Process them one at a time, sequentially.

### 2. Find the company on LinkedIn
1. Search: `goto 'https://www.linkedin.com/search/results/companies/?keywords=<company name>'`
2. `snapshot` to find the match in results
3. Visit the company page
4. `snapshot` to capture: description, employee count, industry, location
5. Note whether the company posts in the user's target language (check `ICP.md` if language matters for their workflow)

### 3. Find key people
Decision-makers for the user's product (read `ICP.md` to see which roles matter). Typical searches:

- From the company page, click the "People" tab
- Or search: `goto 'https://www.linkedin.com/search/results/people/?keywords=<title keyword>&currentCompany=["<company_id>"]'`

Title patterns to try (customize to the ICP):
- `CEO`, `founder`, `co-founder`, `COO`, `CTO` (for smaller companies)
- Whatever function owns the buyer decision for the user's product — check `ICP.md`

Visit the top 2-3 most relevant profiles. For each:

1. `goto 'https://www.linkedin.com/in/<username>/'`
2. `snapshot` to extract: name, title, about section, approx. location

### 4. Optional: follow + engage
**Only follow or like if the user's ICP.md explicitly asks for it.** Default = no visible social action; this automation is research-only unless told otherwise.

If following is enabled in `ICP.md`:
- `click` the Follow button after snapshotting the profile
- Also check `https://www.linkedin.com/in/<username>/recent-activity/all/` for relevant recent posts; like one if clearly on-topic

### 5. Write findings to the CSV
```bash
node agents/lib/csv-io.js update <index> '{
  "key_people": [
    {"name":"Jane Doe","title":"CEO","linkedinUrl":"https://www.linkedin.com/in/janedoe","notes":"Founder, posts weekly about <topic>"},
    {"name":"John Smith","title":"VP Customer","linkedinUrl":"https://www.linkedin.com/in/johnsmith","notes":"Joined 6mo ago from <co>"}
  ],
  "language": "English | Portuguese | ...",
  "outreach_prepped_at": "<YYYY-MM-DD>"
}'
```

The `key_people` field is stored as a JSON string inside the CSV cell. The user will read it from Excel or a CSV viewer.

### 6. Move to the next qualified row
Continue until all rows are processed or the session hits auth walls.

## Critical rules

- **One agent, one browser, one company at a time.** No subagents.
- **Always include `-s=main`** on every playwright-cli command.
- **Natural pacing.** Snapshot after each goto. No rapid-fire navigation.
- **Stop on 403s or auth walls** — do not retry. The cookies probably expired; log back into LinkedIn in Chrome.
- **Write to the CSV once per company**, at the end of research.
- **Default to research-only.** Don't follow, like, or comment unless `ICP.md` explicitly enables it.
