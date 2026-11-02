# Lukespeak Engineering Insights

Source for [Lukespeak Engineering Insights](https://yisheng05.github.io/lukespeak-portfolio/), Luke Ong's publication on AI architectures, agentic systems, and data products.

The site is built with pure HTML, CSS, and vanilla JavaScript, employing a modern dark-theme glassmorphism design. There is no build step: articles are Markdown files rendered in the browser.

## 🚀 Features
- **Dynamic Articles Loader**: Fetches and renders articles written in Markdown format on-the-fly using `marked.js`.
- **LaTeX Math Rendering**: Supports inline `\( … \)` and display `$$ … $$` / `\[ … \]` math via `MathJax`.
- **Search & Category Filters**: Client-side search and filtering on the articles page.
- **Fully Responsive**: Optimized for all viewports from mobile devices to desktop displays.

---

## 📂 Project Structure
```text
├── index.html          # Landing page (hero, engineering paradigms, featured articles)
├── articles.html       # Archive list of all articles with search and filters
├── article.html        # Single article page layout (loads MD dynamically)
├── og-image.png        # 1200×630 social share preview (og:image / twitter:image)
├── favicon.svg
├── css/
│   └── style.css       # Core stylesheet (custom properties, animations, markdown rules)
├── js/
│   ├── app.js          # Core app logic (animations, header effects, mobile menu)
│   └── article-loader.js # Dynamic fetching, parsing, and rendering of articles
├── articles/
│   ├── articles.json   # Index metadata of all articles
│   └── *.md            # Individual article source files in Markdown format
└── .github/workflows/
    └── static.yml      # Deploys the site to GitHub Pages on every push to main
```

## ✍️ Adding an Article
1. Add `articles/<id>.md`. A leading `# Title` line is optional; it is stripped because the page header already shows the title.
2. Add an entry to `articles/articles.json` with the same `id`, plus `title`, `date` (`YYYY-MM-DD`), `summary`, and `readTime`.
3. Tag code fences with a language (`python`, `bash`, `json`) for syntax highlighting. Untagged fences render as plain text, which suits ASCII diagrams.

---

## 🛠️ Local Development

Serve the folder with any static server, for example:

```bash
npm run dev
```

This runs `python3 -m http.server 8000`. Then open **[http://localhost:8000](http://localhost:8000)**.

---

## 🚢 Deployment

Pushing to `main` deploys the site automatically: `.github/workflows/static.yml` uploads the repository as a GitHub Pages artifact and publishes it. There is no manual deploy command.

One-time repository setting: **Settings → Pages → Build and deployment → Source** must be set to **GitHub Actions**. If it is set to "Deploy from a branch", GitHub also runs its built-in "pages build and deployment" job on every push, which fails and leaves a red ✗ on each commit.
