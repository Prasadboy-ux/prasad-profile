# Customization

## Edit Configuration First

Most customization belongs in `profile.config.json`. The schema limits hero text lengths because SVG terminal rows cannot wrap safely.

### Profile

Use a specific headline that combines direction and evidence, such as:

- `AI Researcher & Web3 Builder`
- `Machine Learning Engineer & Open Source Maintainer`
- `Backend Engineer & Developer Tools Builder`

Avoid long skill inventories in the headline.

### Research Direction

The `research` object powers both the terminal panel and the longer Research Direction section. Keep `primary`, `direction`, and `themes` compact; use `narrative` for nuance.

### Featured Projects

The first four projects appear in the hero. Up to six appear in the README table. Order them by how strongly they support your positioning, not by creation date.

`heroLabel` should describe the project's role in two to four words, for example `Web3 trust layer` or `Test recovery system`.

### Public Links

The first two links appear in the hero. Up to four become badges below it. Only include links you are comfortable making permanently public.

## Palettes

- `signal`: cyan, violet, and green on a research-console background.
- `ocean`: teal, blue, and indigo with a calmer systems feel.
- `solar`: cyan, blue, and amber with warmer technical accents.

Every palette includes separate dark and light values.

## Portrait Guidance

Best results come from:

- A transparent PNG.
- Head-to-torso framing.
- Clear facial lighting.
- Visible separation between hair, face, and clothing.
- Minimal translucent edges around the cutout.

Do not add a decorative background before generation. The console adds its own restrained ambient layer.

## GitHub Analytics

The profile can include dynamically calculated GitHub analytics. These are generated from the GitHub API and cached for 30 minutes.

### Local Generation

Run analytics generation:

```bash
npm run generate:analytics
```

This creates `assets/analytics/analytics.json` and `assets/analytics/cache.json`.

Then regenerate the README to include analytics:

```bash
npm run generate:readme
```

Or do both in sequence:

```bash
npm run generate:analytics && npm run generate:readme
```

### GitHub Actions

The `generate-analytics.yml` workflow automatically updates analytics on a schedule, on push to main when `profile.config.json` changes, or when manually dispatched.

The workflow commits only if the README actually changes.

### Analytics Sections

The generated README includes:

- **Profile Overview** — public repositories, stars, forks, commits, followers, following
- **All Public Repositories** — complete list with language, stars, forks, and last updated date
- **Top Language by Repository** — language distribution by repository count
- **Top Language by Commit Activity** — commit contribution by repository primary language
- **Most Starred Projects** — top 5 repositories by stars
- **Recent Activity** — dynamically updated public GitHub events

### Cache Behavior

Analytics are cached in `assets/analytics/cache.json` for 30 minutes. Running `npm run generate:analytics` multiple times within that window reuses cached data.

The cache is never committed and is safe to ignore in Git.

## Updating Later

Edit `profile.config.json`, then regenerate with the same private source file:

```bash
npm run generate -- --source /absolute/path/to/portrait.png
```

The content and portrait determine a new eight-character asset version. Old generated hero assets are removed automatically, and README receives the new filenames.

Recent Activity content is preserved when the full README is regenerated.
