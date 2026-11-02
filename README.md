# Lukespeak Engineering Insights

Source for [Lukespeak Engineering Insights](https://yisheng05.github.io/lukespeak-portfolio/), Luke Ong's publication on AI architectures, agentic systems, and data products.

The site is plain HTML, CSS, and vanilla JavaScript with a dark glassmorphism design. Articles are written in Markdown; a small Node build script (`scripts/build.mjs`) turns each one into its own static HTML page at deploy time.

## 🚀 Features
- **Per-article pages**: every article is pre-rendered to `articles/<id>.html` with its own `<title>`, description, canonical URL, Open Graph/Twitter tags, and JSON-LD, so links shared on LinkedIn or X preview with the article's own title and summary.
- **RSS feed and sitemap**: `feed.xml` and `sitemap.xml` are generated on every build.
- **Build-time validation**: the build fails if `articles/articles.json` and the Markdown files disagree (missing file, orphan file, duplicate id, invalid date), so a broken article never deploys.
- **LaTeX Math Rendering**: inline `\( … \)` and display `$$ … $$` / `\[ … \]` math via MathJax.
- **Search & Category Filters**: client-side search and filtering on the articles page.
- **Fully Responsive**: optimized for all viewports from mobile devices to desktop displays.

---

## 📂 Project Structure
```text
├── index.html            # Landing page (hero, engineering paradigms, featured articles)
├── articles.html         # Archive list of all articles with search and filters
├── article.html          # Legacy redirect: article.html?id=<id> → articles/<id>.html
├── templates/
│   └── article.html      # Template for the generated article pages
├── scripts/
│   └── build.mjs         # Validates articles, renders pages, writes feed + sitemap
├── articles/
│   ├── articles.json     # Article metadata (the source of truth for titles, dates, summaries)
│   └── *.md              # Article bodies in Markdown
├── css/style.css         # Core stylesheet
├── js/
│   ├── app.js            # Animations, header effects, mobile menu, analytics events
│   └── article-loader.js # Renders the article lists from articles.json
├── og-image.png          # 1200×630 social share image
├── favicon.svg
└── .github/workflows/
    └── static.yml        # Builds on every push and PR; deploys on push to main
```

The build writes the publishable site to `_site/` (git-ignored). Generated pages are never committed.

## ✍️ Adding an Article
1. Add `articles/<id>.md`. A leading `# Title` line is optional; it is dropped because the page header already shows the title.
2. Add an entry to `articles/articles.json` with the same `id` (lowercase-kebab-case), plus `title`, `date` (`YYYY-MM-DD`), `summary`, and `readTime`. The `summary` becomes the page description and the social preview text.
3. Tag code fences with a language (`python`, `bash`, `json`) for syntax highlighting. Untagged fences render as plain text, which suits ASCII diagrams.
4. Run `npm run build` to check it. Keep drafts outside `articles/`: a Markdown file there without an `articles.json` entry fails the build.

The article's public URL is `https://yisheng05.github.io/lukespeak-portfolio/articles/<id>.html`. Share that URL, not the old `article.html?id=<id>` form; old links still redirect, but crawlers only see the generic site preview for them.

---

## 🛠️ Local Development

Requires Node 22+ and Python 3.

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` builds the site into `_site/` and serves it at **[http://localhost:8000](http://localhost:8000)**. Re-run it after editing articles or templates.

---

## 🚢 Deployment

Pushing to `main` deploys automatically: `.github/workflows/static.yml` runs `npm ci` and `npm run build`, then publishes `_site/` to GitHub Pages. Pull requests run the same build without deploying, so validation errors show up as a failed check before merge.

One-time repository setting: **Settings → Pages → Build and deployment → Source** must be set to **GitHub Actions**. If it is set to "Deploy from a branch", GitHub also runs its built-in "pages build and deployment" job on every push, which fails and leaves a red ✗ on each commit.
