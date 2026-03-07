/**
 * Article Loader Logic
 * Handles fetching markdown files and rendering them for the portfolio
 */

const ArticleLoader = {
    // Configuration
    config: {
        articlesIndexPath: 'articles/articles.json',
        articlesDir: 'articles/'
    },

    /**
     * Format a date string into a nice readable format
     */
    formatDate: function (dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    },

    /**
     * Load the list of articles for the articles.html page
     */
    loadArticleList: async function () {
        const container = document.getElementById('articles-container');
        const loading = document.getElementById('loading-indicator');

        if (!container || !loading) return;

        try {
            // Fetch articles index
            const response = await fetch(this.config.articlesIndexPath);

            if (!response.ok) {
                throw new Error('Could not load articles index');
            }

            const articles = await response.json();

            // Sort by date (newest first)
            articles.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Generate HTML
            let html = '';

            if (articles.length === 0) {
                html = '<div class="glass-card" style="grid-column: 1 / -1; text-align: center;"><p>More articles coming soon!</p></div>';
            } else {
                articles.forEach((article, index) => {
                    // Add staggered animation delay
                    const delay = index * 0.1;

                    html += `
                        <a href="article.html?id=${article.id}" class="article-card glass-card reveal" style="transition-delay: ${delay}s">
                            <div class="article-date">
                                <i class="far fa-calendar-alt"></i> ${this.formatDate(article.date)}
                                <span style="margin-left: 10px;"><i class="far fa-clock"></i> ${article.readTime || '5 min'} read</span>
                            </div>
                            <h2 class="article-title">${article.title}</h2>
                            <p class="article-summary">${article.summary}</p>
                            <span class="read-more">Read Full Article <i class="fas fa-arrow-right"></i></span>
                        </a>
                    `;
                });
            }

            // Hide loading, show content
            loading.style.display = 'none';
            container.innerHTML = html;

            // Trigger animation for newly added elements
            setTimeout(() => {
                const elements = container.querySelectorAll('.reveal');
                elements.forEach(el => el.classList.add('active'));
            }, 100);

        } catch (error) {
            console.error('Error loading articles:', error);
            loading.innerHTML = '<p style="color: #ff6b6b;"><i class="fas fa-exclamation-circle"></i> Error loading articles. Please try again later.</p>';
        }
    },

    /**
     * Load a single article for the article.html page based on URL parameter
     */
    loadSingleArticle: async function () {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');

        const titleEl = document.getElementById('article-title');
        const contentEl = document.getElementById('article-content');
        const dateEl = document.getElementById('article-date');
        const readTimeEl = document.getElementById('article-read-time');

        if (!articleId) {
            titleEl.textContent = 'Article Not Found';
            contentEl.innerHTML = '<p>No article ID specified in the URL. Please return to the <a href="articles.html" style="color:var(--accent-primary)">Articles list</a>.</p>';
            return;
        }

        try {
            // 1. Fetch metadata to get title and date
            const indexResponse = await fetch(this.config.articlesIndexPath);
            if (!indexResponse.ok) throw new Error('Could not load articles index');

            const articles = await indexResponse.json();
            const articleMeta = articles.find(a => a.id === articleId);

            if (!articleMeta) {
                titleEl.textContent = 'Article Not Found';
                contentEl.innerHTML = '<p>The requested article does not exist. Please return to the <a href="articles.html" style="color:var(--accent-primary)">Articles list</a>.</p>';
                return;
            }

            // Update Meta Info
            document.title = `${articleMeta.title} | Luke Ong`;
            titleEl.innerHTML = articleMeta.title;
            dateEl.innerHTML = `<i class="far fa-calendar"></i> ${this.formatDate(articleMeta.date)}`;
            readTimeEl.innerHTML = `<i class="far fa-clock"></i> ${articleMeta.readTime || '5 min'} read`;

            // 2. Fetch Markdown content
            const mdResponse = await fetch(`${this.config.articlesDir}${articleId}.md`);
            if (!mdResponse.ok) throw new Error('Could not fetch markdown file');

            const markdownContent = await mdResponse.text();

            // 3. Parse Markdown to HTML
            // Ensure marked is available
            if (typeof marked === 'undefined') {
                throw new Error('Markdown parser (marked.js) is not loaded.');
            }

            // Configure marked for security
            marked.setOptions({
                headerIds: true,
                gfm: true, // GitHub Flavored Markdown
                breaks: true
            });

            const htmlContent = marked.parse(markdownContent);

            // Inject content
            contentEl.innerHTML = htmlContent;

        } catch (error) {
            console.error('Error loading article:', error);
            titleEl.textContent = 'Error Loading Article';
            contentEl.innerHTML = `<p style="color: #ff6b6b;"><i class="fas fa-exclamation-circle"></i> ${error.message}. Please try again later.</p>`;
        }
    }
};
