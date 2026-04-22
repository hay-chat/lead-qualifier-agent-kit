# Your ICP

> Edit this file to match your product. The agents read this on every run, so changes take effect immediately — no code changes needed.

## What we sell

<!-- One or two sentences. What is your product? Who pays for it? What's the value prop? -->
We sell [your product] that helps [target persona] [outcome]. Our customers typically buy this to [main use case].

## Strong-fit criteria

<!-- List the attributes of a great customer. Be specific. -->
- **Vertical:** [e.g., SaaS, E-commerce, Fintech]
- **Company size:** [e.g., 11-200 employees]
- **Pricing model:** [e.g., PLG / freemium / self-serve]
- **Customer base:** [e.g., SMB end-users, developer-first]
- **Other signals:** [e.g., has a help center, hiring CS roles, publicly complaining about current tooling]

## Anti-patterns (BAD_FIT)

<!-- What makes a company clearly NOT a fit? -->
- Too small (<10 employees, pre-product-market-fit)
- Too large / enterprise-only (>5000, builds in-house)
- [Other disqualifiers specific to your product]

## Scoring rubric

Each factor is scored 0-10, then multiplied by its weight. Sum = final score (0-10).

| Factor | Weight | 10 points | 6 points | 2 points |
|---|---|---|---|---|
| Vertical fit | 20% | Perfect vertical match | Adjacent vertical | Outside ICP |
| Company size | 15% | In sweet spot | At the edge | Too small / too big |
| Pricing model | 15% | PLG / freemium | Self-serve | Enterprise-only |
| Customer type | 15% | SMB | Mid-market | Enterprise |
| [Signal A] | 15% | Strong evidence | Some evidence | No evidence |
| [Signal B] | 10% | Strong evidence | Some evidence | No evidence |
| [Signal C] | 10% | Strong evidence | Some evidence | No evidence |

## Classification thresholds

- **GOOD_FIT:** score ≥ 8 → set `stage: SALES_QUALIFIED` → outreach-prep will research key people
- **MEDIUM_FIT:** score 5-7 → `stage: MARKETING_QUALIFIED` → keep monitoring
- **BAD_FIT:** score ≤ 4 → `stage: NOT_A_FIT`

## Signal multipliers (optional)

If the agent discovers any of these during research, they should push a company up the score:

- **Actively searching for a tool** in our space (e.g., RFP, comparison articles, job posts for related roles)
- **Public complaint** about their current solution
- **Recent funding / growth** that increases their need for our product
- **Hiring signals** in adjacent roles

## Outreach — key personas

<!-- Which roles should outreach-prep look for on LinkedIn? -->
- **Primary:** [e.g., VP of Customer, Head of Support]
- **Secondary:** [e.g., CEO / founder for smaller companies]

## Engagement rules

<!-- Should outreach-prep follow people, like posts, or just research silently? -->
- [ ] Follow key people on LinkedIn
- [ ] Like relevant recent posts
- [x] Research only, no visible social actions (default)

## Language

<!-- If your ICP is language-specific, note it. The agent will detect posting language and record it. -->
Primary language(s): English
