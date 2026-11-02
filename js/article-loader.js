/**
 * Article Loader Logic
 * Renders the article lists (archive and homepage featured cards) from
 * articles/articles.json. Article pages themselves are pre-rendered by
 * scripts/build.mjs.
 */

const ArticleLoader = {
    // Configuration
    config: {
        articlesIndexPath: 'articles/articles.json'
    },

    /**
     * Format a date string into a nice readable format
     */
    formatDate: function (dateString) {
        // "YYYY-MM-DD" parses as UTC midnight, so format in UTC too; otherwise
        // readers west of UTC (e.g. the Americas) see the previous day.
        const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    },

    // In-memory state for filtering
    state: {
        articles: [],
        currentCategory: 'all',
        searchQuery: ''
    },

    /**
     * Determine if an article matches a category tag
     */
    matchesCategory: function (article, category) {
        if (category === 'all') return true;
        
        const title = (article.title || '').toLowerCase();
        const summary = (article.summary || '').toLowerCase();
        const id = (article.id || '').toLowerCase();
        const combined = `${id} ${title} ${summary}`;
        
        if (category === 'agents') {
            return combined.includes('agent') || 
                   combined.includes('langgraph') || 
                   combined.includes('orchestration') || 
                   combined.includes('chain') || 
                   combined.includes('infrastructure') || 
                   combined.includes('bottleneck');
        }
        if (category === 'safety') {
            return combined.includes('hallucination') || 
                   combined.includes('safety') || 
                   combined.includes('trust') || 
                   combined.includes('nist') || 
                   combined.includes('govern') || 
                   combined.includes('cognitive') || 
                   combined.includes('runtime') || 
                   combined.includes('protocol') || 
                   combined.includes('state machine') || 
                   combined.includes('vibe coding');
        }
        if (category === 'geospatial') {
            return combined.includes('gis') || 
                   combined.includes('onemap') || 
                   combined.includes('map') || 
                   combined.includes('geospatial') || 
                   combined.includes('telegram') || 
                   combined.includes('webhook') || 
                   combined.includes('hydro') || 
                   combined.includes('fill');
        }
        if (category === 'product') {
            return combined.includes('product') || 
                   combined.includes('prioritization') || 
                   combined.includes('strategy') || 
                   combined.includes('drop') || 
                   combined.includes('retail') || 
                   combined.includes('ecosystem') || 
                   combined.includes('data') || 
                   combined.includes('analytics');
        }
        return false;
    },

    /**
     * Render the article cards HTML
     */
    renderArticleList: function (articles) {
        const container = document.getElementById('articles-container');
        if (!container) return;
        
        let html = '';
        
        if (articles.length === 0) {
            html = '<div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;"><p><i class="fas fa-search" style="font-size: 2rem; color: var(--accent-primary); margin-bottom: 1rem;"></i><br>No articles match your search criteria.</p></div>';
        } else {
            articles.forEach((article, index) => {
                const delay = index * 0.05; // faster stagger for filtering
                html += `
                    <a href="articles/${article.id}.html" class="article-card glass-card reveal active" style="transition-delay: ${delay}s">
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
        
        container.innerHTML = html;
        
        // Stagger reveal trigger
        setTimeout(() => {
            const elements = container.querySelectorAll('.reveal');
            elements.forEach(el => el.classList.add('active'));
        }, 50);
    },

    /**
     * Apply active search and category filters
     */
    applyFilters: function () {
        const query = this.state.searchQuery.toLowerCase().trim();
        const category = this.state.currentCategory;
        
        const filtered = this.state.articles.filter(article => {
            // Category check
            const matchesCat = this.matchesCategory(article, category);
            
            // Search query check
            const title = (article.title || '').toLowerCase();
            const summary = (article.summary || '').toLowerCase();
            const matchesSearch = query === '' || title.includes(query) || summary.includes(query);
            
            return matchesCat && matchesSearch;
        });
        
        this.renderArticleList(filtered);
    },

    /**
     * Setup event listeners for the search and category filters
     */
    setupSearchAndFilter: function () {
        const searchInput = document.getElementById('article-search');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchQuery = e.target.value;
                this.applyFilters();
            });
        }
        
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active button styling
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update category and apply filters
                this.state.currentCategory = btn.getAttribute('data-category');
                this.applyFilters();
            });
        });
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

            // Save to state for clientside filtering
            this.state.articles = articles;

            // Hide loading
            loading.style.display = 'none';
            
            // Render first load
            this.renderArticleList(articles);
            
            // Setup listeners
            this.setupSearchAndFilter();

        } catch (error) {
            console.error('Error loading articles:', error);
            loading.innerHTML = '<p style="color: #ff6b6b;"><i class="fas fa-exclamation-circle"></i> Error loading articles. Please try again later.</p>';
        }
    },

    /**
     * Load top featured articles for the index.html landing page
     */
    loadFeaturedArticles: async function () {
        const container = document.getElementById('featured-articles-container');
        if (!container) return;

        try {
            const response = await fetch(this.config.articlesIndexPath);
            if (!response.ok) throw new Error('Could not load articles index');

            const articles = await response.json();
            articles.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Select top 4 showcase articles
            const featured = articles.slice(0, 4);

            let html = '';
            featured.forEach((article, index) => {
                const delay = index * 0.1;
                html += `
                    <a href="articles/${article.id}.html" class="article-card glass-card reveal" style="transition-delay: ${delay}s">
                        <div class="article-date">
                            <i class="far fa-calendar-alt"></i> ${this.formatDate(article.date)}
                            <span style="margin-left: 10px;"><i class="far fa-clock"></i> ${article.readTime || '5 min'} read</span>
                        </div>
                        <h3 class="article-title">${article.title}</h3>
                        <p class="article-summary">${article.summary}</p>
                        <span class="read-more">Read Architectural Case Study <i class="fas fa-arrow-right"></i></span>
                    </a>
                `;
            });

            container.innerHTML = html;

            setTimeout(() => {
                const elements = container.querySelectorAll('.reveal');
                elements.forEach(el => el.classList.add('active'));
            }, 100);
        } catch (error) {
            console.error('Error loading featured articles:', error);
        }
    }
};
