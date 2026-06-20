# Luke Ong | Product Management Leader Portfolio

This is the personal portfolio website of Luke Ong, a Product Management Leader and strategist specializing in AI/ML solutions, data analytics, and government-enterprise environments. 

The site is built with pure HTML, CSS, and vanilla JavaScript, employing a modern dark-theme glassmorphism design.

## 🚀 Features
- **Dynamic Articles Loader**: Fetches and renders articles written in Markdown format on-the-fly using `marked.js`.
- **LaTeX Math Rendering**: Supports rendering mathematical equations in articles using `MathJax`.
- **Premium Aesthetics**: Includes dynamic animated background elements, glassmorphic cards and headers, responsive navigation, and staggered load animations.
- **Fully Responsive**: Optimized for all viewports from mobile devices to desktop displays.

---

## 📂 Project Structure
```text
├── index.html          # Main landing page (About, Experience, Achievements)
├── articles.html       # Archive list of all articles
├── article.html        # Single article page layout (loads MD dynamically)
├── css/
│   └── style.css       # Core stylesheet (custom properties, animations, markdown rules)
├── js/
│   ├── app.js          # Core app logic (animations, header effects, mobile menu)
│   └── article-loader.js # Dynamic fetching, parsing, and rendering of articles
├── articles/
│   ├── articles.json   # Index metadata of all articles
│   └── *.md            # Individual article source files in Markdown format
└── package.json        # Project metadata and dependencies (gh-pages deployment)
```

---

## 🛠️ Local Development

To run and preview the website locally, use Python's built-in HTTP server:

```bash
# Run server using the project's Python virtual environment
/Users/ongyishengluke/code/.venv/bin/python3 -m http.server 8000
```

Once the server is running, navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🚢 Deployment

The portfolio is hosted on **GitHub Pages** and served from the `gh-pages` branch. 

### To Deploy Changes:
To publish your local changes to the live site, run:

```bash
npx gh-pages -d .
```

This will automatically push the directory contents to the `gh-pages` branch, updating the live site.
