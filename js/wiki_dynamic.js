// Dynamic Wiki System for Eno World Encyclopedia
// Integrates with lore database, provides search, filtering, and visualization

console.log('Wiki script loading...');

class WikiSystem {
    constructor() {
        this.entries = [];
        this.filteredEntries = [];
        this.currentCategory = 'all';
        this.currentEntry = null;
        this.currentEditingEntry = null;
        this.searchTerm = '';
        this.graphData = { nodes: [], links: [] };
        this.currentUser = null;
        this.isEditor = false;
        this.autoSaveTimer = null;
        this.locationData = {
            cities: [],
            villages: [],
            rivers: [],
            lakes: []
        };
        
        this.init();
    }
    
    async init() {
        // Check authentication first
        await this.checkAuthentication();

        // Initialize event listeners
        this.setupEventListeners();

        // Load initial data
        await this.loadWikiEntries();

        // Update UI - populate topic list
        this.updateDisplay();

        // Initialize flags for lazy-loaded components
        this.graphInitialized = false;
        this.topicTimeline = null;

        // Setup editor interface if user has permissions
        this.setupEditorInterface();

        console.log('Wiki system initialized with updated UI layout');
    }
    
    // Get current user and check permissions
    async checkAuthentication() {
        try {
            const token = this.getCookie('token') || localStorage.getItem('auth_token');
            console.log('Wiki: Checking authentication, token exists:', !!token);
            if (!token) {
                console.log('Wiki: No token found in cookies or localStorage');
                return;
            }
            
            const response = await fetch('/api/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                
                // Parse roles if it's a string
                const roles = typeof this.currentUser.roles === 'string' 
                    ? JSON.parse(this.currentUser.roles) 
                    : this.currentUser.roles;
                
                // Check if user has editor or admin role
                this.isEditor = roles.includes('editor') || roles.includes('admin') || this.currentUser.is_admin;
                
                // Debug logging
                console.log('User authentication:', {
                    user: this.currentUser.username,
                    roles: roles,
                    isEditor: this.isEditor
                });
                
                // Update UI to show user badge
                this.updateUserBadge();
            }
        } catch (error) {
            console.error('Error checking authentication:', error);
        }
    }
    
    // Helper to get cookie value
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    // Update user badge display
    updateUserBadge() {
        const badge = document.getElementById('userBadge');
        if (this.currentUser) {
            badge.textContent = `${this.currentUser.username} (${this.isEditor ? 'Editor' : 'Viewer'})`;
            badge.style.display = 'block';
            
            // Also add a debug message
            if (!this.isEditor) {
                console.warn('User is not an editor. Roles:', this.currentUser.roles);
            }
        } else {
            badge.textContent = 'Not logged in';
            badge.style.display = 'block';
            badge.style.background = '#dc3545';
        }
    }
    
    // Setup editor interface for authorized users
    setupEditorInterface() {
        console.log('Wiki: Setting up editor interface, isEditor:', this.isEditor);
        if (!this.isEditor) {
            console.log('Wiki: User is not an editor, skipping editor interface setup');
            return;
        }
        
        // Show editor toolbar
        const toolbar = document.getElementById('editorToolbar');
        if (toolbar) {
            toolbar.classList.add('visible');
            console.log('Wiki: Editor toolbar made visible');
        } else {
            console.error('Wiki: Editor toolbar element not found!');
        }
        
        // Add new entry button listener
        document.getElementById('newEntryBtn').addEventListener('click', () => {
            this.openEditorModal();
        });
        
        // Add editor modal listeners
        document.getElementById('editorClose').addEventListener('click', () => {
            this.closeEditorModal();
        });
        
        document.getElementById('btnCancel').addEventListener('click', () => {
            this.closeEditorModal();
        });
        
        document.getElementById('btnPreview').addEventListener('click', () => {
            this.previewEntry();
        });
        
        document.getElementById('editorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveEntry();
        });
        
        // Auto-save functionality
        const contentField = document.getElementById('entryContent');
        contentField.addEventListener('input', () => {
            this.scheduleAutoSave();
        });
    }
    
    setupEventListeners() {
        // Enhanced search functionality with autocomplete
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Clear previous timeout
            clearTimeout(searchTimeout);

            // Debounce search to avoid too many API calls
            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 300);
            } else if (query.length === 0) {
                // Clear search and show all entries
                this.hideAutocomplete();
                this.searchTerm = '';
                this.filterEntries();
            }
        });

        // Handle search input focus/blur for autocomplete
        searchInput.addEventListener('focus', () => {
            if (this.searchSuggestions && this.searchSuggestions.length > 0) {
                this.showAutocomplete();
            }
        });

        // Hide autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !document.getElementById('autocompleteDropdown')?.contains(e.target)) {
                this.hideAutocomplete();
            }
        });

        // Graph modal controls
        const openGraphBtn = document.getElementById('openGraphBtn');
        const closeGraphBtn = document.getElementById('closeGraphBtn');
        const graphPanel = document.getElementById('graphPanel');

        if (openGraphBtn) {
            openGraphBtn.addEventListener('click', () => {
                graphPanel.classList.add('active');
                if (!this.graphInitialized) {
                    this.initializeGraph();
                }
            });
        }

        if (closeGraphBtn) {
            closeGraphBtn.addEventListener('click', () => {
                graphPanel.classList.remove('active');
            });
        }

        // Close graph when clicking outside content
        if (graphPanel) {
            graphPanel.addEventListener('click', (e) => {
                if (e.target === graphPanel) {
                    graphPanel.classList.remove('active');
                }
            });
        }

        // Modal close (kept for legacy entry modal)
        const modalClose = document.getElementById('modalClose');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.closeModal();
            });
        }

        const entryModal = document.getElementById('entryModal');
        if (entryModal) {
            entryModal.addEventListener('click', (e) => {
                if (e.target.id === 'entryModal') {
                    this.closeModal();
                }
            });
        }
    }
    
    async loadWikiEntries() {
        try {
            // Show loading state
            const loadingState = document.getElementById('loadingState');
            const topicList = document.getElementById('topicList');

            if (loadingState) loadingState.style.display = 'block';
            if (topicList) topicList.innerHTML = '<li style="padding: 20px; text-align: center; color: #8b7355;">Loading topics...</li>';

            // Fetch wiki entries from the backend (request all entries for timeline/map integration)
            const response = await fetch('/api/wiki/entries?limit=1000');

            if (!response.ok) {
                // If API doesn't exist yet, use sample data
                this.entries = this.getSampleEntries();
            } else {
                const data = await response.json();
                this.entries = data.entries || this.getSampleEntries();
            }

            this.filteredEntries = [...this.entries];

            // Hide loading state
            if (loadingState) loadingState.style.display = 'none';

            // Dispatch event for timeline/map integration
            document.dispatchEvent(new CustomEvent('wikiEntriesLoaded', {
                detail: { entries: this.entries }
            }));

        } catch (error) {
            console.error('Error loading wiki entries:', error);
            // Use sample data as fallback
            this.entries = this.getSampleEntries();
            this.filteredEntries = [...this.entries];

            const loadingState = document.getElementById('loadingState');
            if (loadingState) loadingState.style.display = 'none';

            // Dispatch event even with sample data
            document.dispatchEvent(new CustomEvent('wikiEntriesLoaded', {
                detail: { entries: this.entries }
            }));
        }
    }
    
    getSampleEntries() {
        // Sample data based on Eno world lore
        return [
            {
                id: 'cultures-of-eno',
                title: 'Cultures of Eno',
                category: 'culture',
                excerpt: 'The diverse societies of Eno, each with unique biological and spiritual characteristics shaped by their valleys.',
                content: `The planet Eno hosts numerous distinct cultures, each adapted to their specific valley environments:

**Night Valley Cultures**: Known for their connection to shadows and mysteries, these societies have developed unique forms of magic and communication that function in perpetual twilight.

**Day Valley Cultures**: Radiant societies that harness light and energy, creating advanced technologies powered by perpetual sunshine.

**Dawn Valley Cultures**: Transitional societies that celebrate beginnings and change, known for their healing arts and agricultural innovations.

**Dusk Valley Cultures**: Philosophical societies focused on endings and reflection, maintaining vast libraries and archives of knowledge.`,
                tags: ['valleys', 'societies', 'biology', 'spirituality'],
                related: ['night-valley', 'day-valley', 'dawn-valley', 'dusk-valley']
            },
            {
                id: 'night-valley',
                title: 'Night Valley',
                category: 'geography',
                excerpt: 'The realm of shadows and mysteries, where ancient magic still lingers in eternal twilight.',
                content: `Night Valley exists in a state of perpetual twilight, creating a unique ecosystem and culture. Major cities include:

**Palwede**: A major port city with 47,137 inhabitants, featuring impressive fortifications and a thriving shadow market.

**Ithemate**: Known for its mystical academies and connection to ancient magics.

The valley's cool climate and mysterious atmosphere have shaped its inhabitants into master traders and scholars of the arcane.`,
                tags: ['valley', 'geography', 'darkness', 'shadow', 'cities'],
                related: ['cultures-of-eno', 'palwede-city', 'shadow-magic']
            },
            {
                id: 'soul-system',
                title: 'The Soul System of Eno',
                category: 'mythology',
                excerpt: 'The hierarchical soul structure that connects all entities in Eno, from the Primordial World Soul to individual beings.',
                content: `The Soul System is the fundamental spiritual framework of Eno:

**Primordial World Soul**: The all-encompassing source of all souls in Eno, containing the essence of the entire world.

**Valley Souls**: Four major souls corresponding to each valley:
- Valley Soul of Darkness (Night)
- Valley Soul of Light (Day)  
- Valley Soul of Beginnings (Dawn)
- Valley Soul of Endings (Dusk)

**Entity Souls**: Every city, building, and individual possesses a soul that connects to the greater hierarchy, creating a web of spiritual interconnection.`,
                tags: ['souls', 'spirituality', 'mythology', 'hierarchy'],
                related: ['cultures-of-eno', 'magic-systems']
            },
            {
                id: 'economic-networks',
                title: 'Trade Networks of Eno',
                category: 'economics',
                excerpt: 'The complex trade relationships between cities, focusing on luxury goods and regional specialties.',
                content: `Eno's economy is characterized by sophisticated trade networks:

**Major Trade Hubs**:
- Guild: Population 79,193 - Industrial center and major port
- Mahyapak: Population 71,912 - Industrial powerhouse with extensive trade routes
- Jeong: Population 50,393 - Central market connecting multiple valleys

**Primary Trade Goods**:
- Jewelry: High-value luxury items traded across vast distances
- Machinery: Industrial products from advanced cities
- Textiles: Woven goods from medieval settlements
- Raw Materials: Wood, stone, and food for local consumption

Trade is primarily conducted in luxury goods due to transportation costs over long distances.`,
                tags: ['trade', 'economy', 'cities', 'resources'],
                related: ['guild-city', 'mahyapak-city', 'resource-taxonomy']
            },
            {
                id: 'magic-systems',
                title: 'Magic Systems',
                category: 'magic',
                excerpt: 'The various forms of magic practiced across Eno, shaped by valley influences and soul connections.',
                content: `Magic in Eno manifests differently in each valley:

**Shadow Magic (Night Valley)**: Manipulation of darkness and mystery, used for concealment and revelation of hidden truths.

**Light Magic (Day Valley)**: Harnessing of radiant energy for creation and transformation.

**Transition Magic (Dawn Valley)**: Powers of change and renewal, particularly strong in healing and growth.

**Reflection Magic (Dusk Valley)**: Abilities related to memory, wisdom, and temporal manipulation.

All magic is connected to the soul system, with practitioners drawing power from their connection to valley souls.`,
                tags: ['magic', 'valleys', 'souls', 'power'],
                related: ['soul-system', 'night-valley', 'day-valley']
            },
            {
                id: 'children-of-eno',
                title: 'The Children of Eno',
                category: 'mythology',
                excerpt: 'The primordial beings who shaped the valleys and established the first civilizations.',
                content: `Legend speaks of the Children of Eno, the first beings to emerge from the Primordial World Soul:

**The Four Founders**: Each child claimed a valley and shaped it according to their nature:
- The Shadow Walker (Night Valley)
- The Light Bringer (Day Valley)
- The Dawn Singer (Dawn Valley)
- The Dusk Keeper (Dusk Valley)

Their descendants still carry traces of their primordial power, manifesting as exceptional abilities in magic and leadership.`,
                tags: ['mythology', 'origins', 'legends', 'founders'],
                related: ['soul-system', 'cultures-of-eno']
            },
            {
                id: 'guild-city',
                title: 'Guild',
                category: 'geography',
                excerpt: 'The largest city in Eno with 79,193 inhabitants, a major industrial and trading center.',
                content: `Guild stands as Eno's most populous city and economic powerhouse:

**Demographics**: 79,193 inhabitants at Industrial technology level
**Infrastructure**: Major port, central market, impressive fortifications, grand temple
**Culture**: Wildlands culture following the Isti religion
**Economy**: Center of machinery production and luxury goods trade

Founded in year 50, Guild has grown to become the primary hub for inter-valley commerce.`,
                tags: ['city', 'trade', 'industry', 'port'],
                related: ['economic-networks', 'trade-routes']
            },
            {
                id: 'technological-eras',
                title: 'Technology Levels',
                category: 'history',
                excerpt: 'The three technological eras that define settlement capabilities and trade relationships.',
                content: `Eno's settlements exist at different technological levels:

**Tribal Era** (66% of settlements):
- Basic tools and organic agriculture
- Limited trade capabilities
- Subsistence economies
- Population typically under 10,000

**Medieval Era** (30% of settlements):
- Metal working and complex crafts
- Regional trade networks
- Fortified cities
- Populations 10,000-50,000

**Industrial Era** (4% of settlements):
- Machinery and mass production
- Global trade capabilities
- Advanced infrastructure
- Populations exceeding 50,000

The technological disparity creates unique trade opportunities and cultural exchanges.`,
                tags: ['technology', 'progress', 'civilization', 'development'],
                related: ['economic-networks', 'guild-city']
            }
        ];
    }
    
    async updateCategoryCounts() {
        try {
            // Try to fetch from API first
            const response = await fetch('/api/wiki/categories');
            if (response.ok) {
                const data = await response.json();
                
                // Update categories from API
                if (data.categories) {
                    data.categories.forEach(category => {
                        const categoryItem = document.querySelector(`[data-category="${category.id}"]`);
                        if (categoryItem) {
                            const countSpan = categoryItem.querySelector('.category-count');
                            if (countSpan) {
                                countSpan.textContent = category.count;
                            }
                        }
                    });
                    return;
                }
            }
        } catch (error) {
            console.error('Error fetching category counts from API:', error);
        }
        
        // Fallback to client-side counting
        const counts = {};
        
        // Initialize all counts to 0
        document.querySelectorAll('.category-item').forEach(item => {
            const category = item.dataset.category;
            counts[category] = 0;
        });
        
        // Count entries per category
        this.entries.forEach(entry => {
            counts[entry.category] = (counts[entry.category] || 0) + 1;
            counts['all'] = (counts['all'] || 0) + 1;
        });
        
        // Update UI
        document.querySelectorAll('.category-item').forEach(item => {
            const category = item.dataset.category;
            const countSpan = item.querySelector('.category-count');
            if (countSpan) {
                countSpan.textContent = counts[category] || 0;
            }
        });
    }
    
    filterEntries() {
        // Apply current filters (search term, category, etc.)
        let filtered = [...this.entries];

        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(entry => {
                return entry.title.toLowerCase().includes(searchLower) ||
                       entry.excerpt.toLowerCase().includes(searchLower) ||
                       entry.content.toLowerCase().includes(searchLower) ||
                       entry.tags.some(tag => tag.toLowerCase().includes(searchLower));
            });
        }

        // Apply category filter if needed
        if (this.currentCategory && this.currentCategory !== 'all') {
            filtered = filtered.filter(entry => entry.category === this.currentCategory);
        }

        this.filteredEntries = filtered;
        this.updateDisplay();
    }

    filterByCategory(category) {
        this.currentCategory = category;

        // Update active state
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        const categoryElement = document.querySelector(`[data-category="${category}"]`);
        if (categoryElement) {
            categoryElement.classList.add('active');
        }

        // Filter and update
        this.filterEntries();
    }
    
    // Enhanced search with API integration
    async performSearch(query) {
        try {
            console.log('Wiki: Performing search for:', query);
            const response = await fetch(`/api/wiki/search?q=${encodeURIComponent(query)}&limit=10`);
            
            if (response.ok) {
                const data = await response.json();
                this.searchSuggestions = data.results || [];
                
                // Show autocomplete dropdown
                this.showAutocomplete();
                
                // Also filter current entries
                this.searchTerm = query;
                this.filterEntries();
            } else {
                // Fallback to client-side search
                this.searchTerm = query;
                this.filterEntries();
            }
        } catch (error) {
            console.error('Search error:', error);
            // Fallback to client-side search
            this.searchTerm = query;
            this.filterEntries();
        }
    }
    
    showAutocomplete() {
        if (!this.searchSuggestions || this.searchSuggestions.length === 0) return;
        
        let dropdown = document.getElementById('autocompleteDropdown');
        if (!dropdown) {
            // Create autocomplete dropdown
            dropdown = document.createElement('div');
            dropdown.id = 'autocompleteDropdown';
            dropdown.className = 'autocomplete-dropdown';
            
            const searchContainer = document.getElementById('searchInput').parentElement;
            searchContainer.style.position = 'relative';
            searchContainer.appendChild(dropdown);
        }
        
        dropdown.innerHTML = '';
        
        this.searchSuggestions.forEach(result => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <div class="autocomplete-title">${this.escapeHtml(result.title)}</div>
                <div class="autocomplete-category">${result.category}</div>
                <div class="autocomplete-excerpt">${this.escapeHtml(result.excerpt.substring(0, 100))}...</div>
            `;
            
            item.addEventListener('click', () => {
                // Navigate to the entry
                this.showEntryById(result.id);
                this.hideAutocomplete();
                
                // Set search input to selected title
                document.getElementById('searchInput').value = result.title;
            });
            
            dropdown.appendChild(item);
        });
        
        dropdown.style.display = 'block';
    }
    
    hideAutocomplete() {
        const dropdown = document.getElementById('autocompleteDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    async showEntryById(entryId) {
        try {
            const response = await fetch(`/api/wiki/entries/${entryId}`);
            if (response.ok) {
                const data = await response.json();
                const entry = data.entry || data;
                this.showEntry(entry);
            } else {
                // Fallback: find in current entries
                const entry = this.entries.find(e => e.id == entryId);
                if (entry) {
                    this.showEntry(entry);
                }
            }
        } catch (error) {
            console.error('Error fetching entry:', error);
        }
    }
    
    searchEntries(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase();
        
        if (!this.searchTerm) {
            this.filterByCategory(this.currentCategory);
            return;
        }
        
        // Filter based on current category and search term
        const baseEntries = this.currentCategory === 'all' 
            ? this.entries 
            : this.entries.filter(entry => entry.category === this.currentCategory);
        
        this.filteredEntries = baseEntries.filter(entry => {
            return entry.title.toLowerCase().includes(this.searchTerm) ||
                   entry.excerpt.toLowerCase().includes(this.searchTerm) ||
                   entry.tags.some(tag => tag.toLowerCase().includes(this.searchTerm));
        });
        
        this.updateDisplay();
    }
    
    updateDisplay() {
        const topicList = document.getElementById('topicList');
        if (!topicList) return;

        topicList.innerHTML = '';

        if (this.filteredEntries.length === 0) {
            topicList.innerHTML = '<li style="padding: 20px; text-align: center; color: #8b7355;">No topics found matching your criteria.</li>';
            return;
        }

        this.filteredEntries.forEach(entry => {
            const listItem = this.createTopicListItem(entry);
            topicList.appendChild(listItem);
        });
    }

    createTopicListItem(entry) {
        const listItem = document.createElement('li');
        listItem.className = 'topic-list-item';
        listItem.dataset.topicId = entry.id;

        // Create topic info structure
        const topicTitle = document.createElement('div');
        topicTitle.className = 'topic-list-title';
        topicTitle.textContent = entry.title;

        const topicCategory = document.createElement('div');
        topicCategory.className = 'topic-category';
        topicCategory.textContent = entry.category;

        listItem.appendChild(topicTitle);
        listItem.appendChild(topicCategory);

        // Add click handler
        listItem.addEventListener('click', () => {
            this.selectTopic(entry);
        });

        return listItem;
    }

    selectTopic(entry) {
        // Hide welcome view, show topic detail
        const welcomeView = document.getElementById('welcomeView');
        const topicDetailView = document.getElementById('topicDetailView');
        const loadingState = document.getElementById('loadingState');

        if (welcomeView) welcomeView.classList.remove('active');
        if (topicDetailView) topicDetailView.classList.add('active');
        if (loadingState) loadingState.style.display = 'none';

        // Update active state in list
        document.querySelectorAll('.topic-list-item').forEach(item => {
            if (item.dataset.topicId === entry.id) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Load topic content in detail view (includes related graph and timeline)
        this.loadTopicDetail(entry);

        // Update context image panel
        this.updateContextImage(entry);

        // Update graph highlighting
        this.updateGraph(entry);

        // Store current entry
        this.currentEntry = entry;
    }

    loadTopicDetail(entry) {
        const topicDetailView = document.getElementById('topicDetailView');
        if (!topicDetailView) return;

        // Convert markdown-style content to HTML
        const formattedContent = entry.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Build related topics mini-graph
        const relatedGraphHTML = (entry.related && entry.related.length > 0) ? `
            <div class="topic-related-graph">
                <h4>Related Topics</h4>
                <div class="related-nodes-container">
                    ${entry.related.map((relId, index) => {
                        const relEntry = this.entries.find(e => e.id === relId);
                        if (!relEntry) return '';
                        return `
                            ${index > 0 ? '<span class="node-edge">—</span>' : ''}
                            <div class="related-node" data-entry-id="${relId}">
                                ${relEntry.title}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';

        // Determine if timeline should be shown based on category
        const showTimeline = this.shouldShowTimeline(entry);
        const timelineHTML = showTimeline ? `
            <div class="topic-timeline-section" id="topicTimelineSection">
                <h3>Timeline</h3>
                <div class="topic-timeline-container" id="topicTimelineContainer">
                    <!-- Timeline will be rendered here -->
                </div>
                <div class="timeline-scale-info" id="timelineScaleInfo"></div>
            </div>
        ` : '';

        topicDetailView.innerHTML = `
            ${relatedGraphHTML}
            <div class="topic-detail-header">
                <h1 class="topic-detail-title">${entry.title}</h1>
                <div class="topic-detail-meta">
                    <span class="entry-category">${entry.category}</span>
                    ${entry.tags.map(tag => `<span class="entry-tag">${tag}</span>`).join('')}
                </div>
            </div>
            <div class="topic-detail-content">
                <p>${formattedContent}</p>
            </div>
            ${timelineHTML}
        `;

        // Add click handlers for related topic nodes
        topicDetailView.querySelectorAll('.related-node').forEach(node => {
            node.addEventListener('click', () => {
                const relatedEntry = this.entries.find(e => e.id === node.dataset.entryId);
                if (relatedEntry) {
                    this.selectTopic(relatedEntry);
                    // Scroll topic list to show selected topic
                    const listItem = document.querySelector(`[data-topic-id="${relatedEntry.id}"]`);
                    if (listItem) {
                        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            });
        });

        // Initialize timeline if shown
        if (showTimeline) {
            this.initializeTopicTimeline(entry);
        }
    }

    shouldShowTimeline(entry) {
        // Don't show timeline for concepts (magic systems, mythology without temporal data)
        if (entry.category === 'magic' || entry.category === 'mythology') {
            // Only show if entry has temporal data
            return entry.temporal_start_cycle !== undefined || entry.temporal_start_day !== undefined;
        }

        // Show timeline for geography, history, characters, organizations, culture, economics
        return ['geography', 'history', 'characters', 'organizations', 'culture', 'economics'].includes(entry.category);
    }

    initializeTopicTimeline(entry) {
        const container = document.getElementById('topicTimelineContainer');
        const scaleInfo = document.getElementById('timelineScaleInfo');
        if (!container) return;

        try {
            // Calculate appropriate scale based on entry type and data
            const timelineConfig = this.getTimelineConfig(entry);

            this.topicTimeline = new TemporalTimeline('topicTimelineContainer', {
                width: container.clientWidth || 800,
                height: 200,
                initialCycle: entry.temporal_start_cycle || 0,
                initialZoomLevel: timelineConfig.zoomLevel,
                onEventClick: (event) => {
                    console.log('Timeline event clicked:', event);
                },
                onTimeChange: (cycle) => {
                    console.log('Timeline centered on cycle:', cycle);
                }
            });

            // Show scale information
            if (scaleInfo && timelineConfig.scaleInfo) {
                scaleInfo.textContent = timelineConfig.scaleInfo;
            }

            console.log('Topic timeline initialized with config:', timelineConfig);
        } catch (error) {
            console.error('Error initializing topic timeline:', error);
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #8b7355;">
                    <p>Timeline temporarily unavailable</p>
                </div>
            `;
        }
    }

    getTimelineConfig(entry) {
        // Determine timeline scale based on entry category and temporal data
        let zoomLevel = 3; // Default: cycles
        let scaleInfo = 'Timeline scale: Cycles';

        if (entry.category === 'characters') {
            // Life cycle timeline - zoom to show decades/years
            zoomLevel = 5;
            scaleInfo = 'Timeline scale: Life events (zoomed to decades)';
        } else if (entry.category === 'history') {
            // Historical events - may span cycles or days
            if (entry.event_duration_days && entry.event_duration_days < 100) {
                zoomLevel = 6;
                scaleInfo = `Timeline scale: Event duration (~${entry.event_duration_days} days)`;
            } else {
                zoomLevel = 4;
                scaleInfo = 'Timeline scale: Historical period (cycles)';
            }
        } else if (entry.category === 'geography') {
            // Location timeline - founding, significant events
            zoomLevel = 3;
            scaleInfo = 'Timeline scale: Location history (cycles)';
        }

        return { zoomLevel, scaleInfo };
    }

    updateContextImage(entry) {
        const imageContainer = document.getElementById('contextImageContainer');
        const imageTitle = document.getElementById('contextImageTitle');
        const viewMoreBtn = document.getElementById('viewMoreImagesBtn');

        if (!imageContainer) return;

        // Determine image type and source based on entry category
        const imageConfig = this.getContextImageConfig(entry);

        if (imageConfig.imageUrl) {
            imageContainer.innerHTML = `
                <img src="${imageConfig.imageUrl}"
                     alt="${entry.title}"
                     onclick="wikiSystem.openImageGallery('${entry.id}')">
                <div class="image-type-badge">${imageConfig.typeLabel}</div>
            `;

            if (imageTitle) {
                imageTitle.textContent = imageConfig.title;
            }

            if (viewMoreBtn) {
                viewMoreBtn.style.display = 'block';
                viewMoreBtn.onclick = () => this.openImageGallery(entry.id);
            }
        } else {
            // No image available - show placeholder
            imageContainer.innerHTML = `
                <div class="context-image-placeholder">
                    No ${imageConfig.typeLabel.toLowerCase()} available for this topic
                </div>
            `;

            if (viewMoreBtn) {
                viewMoreBtn.style.display = 'none';
            }
        }
    }

    getContextImageConfig(entry) {
        // Determine appropriate image based on topic type
        let imageUrl = null;
        let typeLabel = 'Context';
        let title = 'Context';

        switch (entry.category) {
            case 'geography':
                // Location images - map views at appropriate scale
                if (entry.location_type === 'building' && entry.floorplan_image) {
                    imageUrl = entry.floorplan_image;
                    typeLabel = 'Floor Plan';
                    title = 'Floor Plan';
                } else if (entry.location_type === 'district' && entry.district_map) {
                    imageUrl = entry.district_map;
                    typeLabel = 'District Map';
                    title = 'District View';
                } else if (entry.location_type === 'citystate' && entry.city_map) {
                    imageUrl = entry.city_map;
                    typeLabel = 'City Map';
                    title = 'City View';
                } else if (entry.map_image) {
                    imageUrl = entry.map_image;
                    typeLabel = 'Map';
                    title = 'Location Map';
                }
                break;

            case 'characters':
                // Person images - portraits
                imageUrl = entry.portrait_image || entry.character_image;
                typeLabel = 'Portrait';
                title = 'Character Portrait';
                break;

            case 'magic':
            case 'mythology':
                // Concept images
                imageUrl = entry.concept_image || entry.illustration_image;
                typeLabel = 'Concept Art';
                title = 'Concept Illustration';
                break;

            case 'history':
                // Event images - painting style
                imageUrl = entry.event_image || entry.painting_image;
                typeLabel = 'Historical Depiction';
                title = 'Event Depiction';
                break;

            case 'organizations':
                // Organization emblem/symbol
                imageUrl = entry.emblem_image || entry.symbol_image;
                typeLabel = 'Emblem';
                title = 'Organization Symbol';
                break;

            case 'culture':
                // Cultural imagery
                imageUrl = entry.cultural_image || entry.illustration_image;
                typeLabel = 'Cultural Art';
                title = 'Cultural Depiction';
                break;

            case 'economics':
                // Economic diagrams/charts
                imageUrl = entry.diagram_image || entry.chart_image;
                typeLabel = 'Economic Diagram';
                title = 'Economic Visualization';
                break;
        }

        return { imageUrl, typeLabel, title };
    }

    openImageGallery(entryId) {
        // Open image gallery modal or interactive map based on entry type
        const entry = this.entries.find(e => e.id === entryId);
        if (!entry) return;

        if (entry.category === 'geography' && entry.latitude && entry.longitude) {
            // For geography, open interactive map
            window.open(`/hml/unified-map.html?location=${entry.location_type || 'region'}:${entry.location_id || entryId}&lat=${entry.latitude}&lon=${entry.longitude}`, '_blank');
        } else {
            // For other types, open image gallery
            // TODO: Implement image gallery modal
            console.log('Opening image gallery for:', entry.title);
            alert(`Image gallery for ${entry.title} - Feature coming soon!`);
        }
    }

    initializeContextMap() {
        const mapContainer = document.getElementById('contextMapContainer');
        if (!mapContainer || this.contextMapInitialized) return;

        try {
            // Initialize Leaflet map in context panel
            this.contextMap = L.map('contextMapContainer').setView([1.37, 10.94], 6);

            L.tileLayer('https://rhovasti.github.io/eno-tiles/{z}/{x}/{y}.png', {
                minZoom: 3,
                maxZoom: 10,
                attribution: 'Eno World Map'
            }).addTo(this.contextMap);

            this.contextMapInitialized = true;
            console.log('Context map initialized');
        } catch (error) {
            console.error('Error initializing context map:', error);
        }
    }

    initializeContextTimeline() {
        const timelineContainer = document.getElementById('contextTimeline');
        if (!timelineContainer || this.contextTimelineInitialized) return;

        try {
            // Initialize TemporalTimeline component
            this.contextTimeline = new TemporalTimeline('contextTimeline', {
                width: timelineContainer.clientWidth || 350,
                height: 180,
                initialCycle: 0,
                initialZoomLevel: 3
            });

            this.contextTimelineInitialized = true;
            console.log('Context timeline initialized');
        } catch (error) {
            console.error('Error initializing context timeline:', error);
            timelineContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #8b7355;">
                    <p>Timeline temporarily unavailable</p>
                </div>
            `;
        }
    }

    createEntryCard(entry) {
        const card = document.createElement('div');
        card.className = 'entry-card';
        card.onclick = () => this.showEntry(entry);

        card.dataset.entryId = entry.id;
        card.dataset.title = entry.title;
        if (entry.latitude) card.dataset.latitude = entry.latitude;
        if (entry.longitude) card.dataset.longitude = entry.longitude;
        if (entry.temporal_start_cycle) card.dataset.cycle = entry.temporal_start_cycle;
        if (entry.temporal_start_day) card.dataset.day = entry.temporal_start_day;
        if (entry.location_type) card.dataset.locationType = entry.location_type;
        if (entry.location_id) card.dataset.locationId = entry.location_id;

        const categoryColors = {
            culture: '#e8f0ff',
            geography: '#f0ffe8',
            mythology: '#ffe8f0',
            magic: '#f8e8ff',
            history: '#fff8e8',
            characters: '#e8fff8',
            organizations: '#f8f0e8',
            economics: '#e8f8ff'
        };

        card.innerHTML = `
            <div class="entry-title">${entry.title}</div>
            <span class="entry-category" style="background: ${categoryColors[entry.category] || '#f4e8d0'}">
                ${entry.category}
            </span>
            <div class="entry-excerpt">${entry.excerpt}</div>
            <div class="entry-tags">
                ${entry.tags.map(tag => `<span class="entry-tag">${tag}</span>`).join('')}
            </div>
            ${this.isEditor ? '<button class="edit-btn" data-entry-id="' + entry.id + '">Edit</button>' : ''}
        `;
        
        // Override the onclick to handle edit button
        card.onclick = (e) => {
            if (!e.target.classList.contains('edit-btn')) {
                this.showEntry(entry);
            }
        };
        
        // Add edit button listener if editor
        if (this.isEditor) {
            const editBtn = card.querySelector('.edit-btn');
            if (editBtn) {
                console.log('Wiki: Adding edit button listener for entry:', entry.title);
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openEditorModal(entry);
                });
            } else {
                console.warn('Wiki: Edit button not found in card for entry:', entry.title);
            }
        } else {
            console.log('Wiki: Not adding edit buttons - user is not editor');
        }
        
        return card;
    }
    
    showEntry(entry) {
        this.currentEntry = entry;
        
        const modal = document.getElementById('entryModal');
        const modalBody = document.getElementById('modalBody');
        
        // Convert markdown-style content to HTML
        const formattedContent = entry.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Check if this entry is geographic and might have a corresponding citystate
        const isGeographic = entry.category === 'geography' ||
                           entry.tags.includes('city') ||
                           entry.tags.includes('location') ||
                           entry.tags.includes('citystate');

        // Check if this entry has location data
        const hasLocation = entry.location_type && entry.location_id;

        // Try to match with available citystates
        let matchedCitystate = null;
        if (isGeographic && this.citystateMapViewer && this.citystateMapViewer.citystates) {
            const entryTitleLower = entry.title.toLowerCase();
            matchedCitystate = this.citystateMapViewer.citystates.find(cs =>
                cs.name.toLowerCase() === entryTitleLower ||
                cs.display_name.toLowerCase() === entryTitleLower
            );
        }

        modalBody.innerHTML = `
            <h2>${entry.title}</h2>
            ${hasLocation ? `
                <div style="margin: 10px 0; padding: 10px; background: #e8f4f8; border-left: 4px solid #3498db; border-radius: 4px;">
                    <strong>📍 Location:</strong> ${entry.location_type} - ${entry.location_id}
                    <button onclick="wikiSystem.viewOnUnifiedMap('${entry.location_type}', '${entry.location_id}', ${entry.latitude || 0}, ${entry.longitude || 0})"
                            style="margin-left: 10px; padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">
                        🗺️ View on Map
                    </button>
                </div>
            ` : ''}
            <div style="margin: 15px 0;">
                <span class="entry-category">${entry.category}</span>
                ${entry.tags.map(tag => `<span class="entry-tag">${tag}</span>`).join('')}
                ${matchedCitystate ? `
                    <button onclick="wikiSystem.viewCitystateMap('${matchedCitystate.name}')"
                            style="margin-left: 10px; padding: 8px 15px; background: #4a90e2; color: white;
                                   border: none; border-radius: 5px; cursor: pointer; transition: all 0.3s;">
                        🗺️ View Map
                    </button>
                ` : ''}
            </div>
            <div style="line-height: 1.6; color: #333;">
                <p>${formattedContent}</p>
            </div>
            ${entry.related && entry.related.length > 0 ? `
                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e8d4b0;">
                    <h3>Related Entries</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                        ${entry.related.map(relId => {
                            const relEntry = this.entries.find(e => e.id === relId);
                            return relEntry ? `
                                <button onclick="wikiSystem.showRelatedEntry('${relId}')" 
                                        style="padding: 8px 15px; background: #f4e8d0; border: 1px solid #8b7355; 
                                               border-radius: 5px; cursor: pointer; transition: all 0.3s;">
                                    ${relEntry.title}
                                </button>
                            ` : '';
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        
        modal.classList.add('active');
        
        // Update graph to show relationships
        this.updateGraph(entry);

        // Zoom map to location mentioned in the entry
        this.zoomToEntryLocation(entry);

        // Update timeline and map integration
        if (window.wikiTimelineMapIntegration) {
            window.wikiTimelineMapIntegration.updateForEntry(entry);
        }
    }

    showRelatedEntry(entryId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (entry) {
            this.showEntry(entry);
        }
    }
    
    viewOnUnifiedMap(locationType, locationId, latitude, longitude) {
        console.log(`Viewing ${locationType} ${locationId} on unified map`);

        this.closeModal();

        window.open(`/hml/unified-map.html?location=${locationType}:${locationId}&lat=${latitude}&lon=${longitude}`, '_blank');
    }

    viewCitystateMap(citystateName) {
        console.log(`Viewing map for citystate: ${citystateName}`);

        // Close the wiki entry modal
        this.closeModal();

        // Show the map view if not already visible
        this.toggleMapView(true);

        // Switch to the citystate view
        if (this.citystateMapViewer && this.citystateMapViewer.switchToCitystate) {
            this.citystateMapViewer.switchToCitystate(citystateName).then(() => {
                console.log(`Successfully switched to ${citystateName} map view`);
            }).catch(error => {
                console.error(`Failed to switch to ${citystateName}:`, error);
                alert(`Unable to load map for ${citystateName}`);
            });
        } else {
            console.error('CitystateMapViewer not available');
            alert('Map viewer is not available');
        }
    }

    closeModal() {
        document.getElementById('entryModal').classList.remove('active');
        this.currentEntry = null;
    }
    
    toggleMapView(show) {
        const mapView = document.getElementById('mapView');
        mapView.style.display = show ? 'block' : 'none';
        
        if (show && !this.mapInitialized) {
            this.initializeMap();
        }
    }
    
    toggleGraphPanel(show) {
        const graphPanel = document.getElementById('graphPanel');
        graphPanel.style.display = show ? 'block' : 'none';
    }
    
    highlightRelatedWikiEntries(citystateName) {
        // Find wiki entries that mention this citystate
        const relatedEntries = this.entries.filter(entry => {
            const searchText = `${entry.title} ${entry.content}`.toLowerCase();
            return searchText.includes(citystateName.toLowerCase());
        });

        if (relatedEntries.length > 0) {
            console.log(`Found ${relatedEntries.length} wiki entries related to ${citystateName}`);
            // You could show a notification or highlight entries in the UI here
        }
    }

    findWikiEntryForLocation(locationName) {
        // Find wiki entries that are about this specific location
        return this.entries.find(entry => {
            const title = entry.title.toLowerCase();
            const location = locationName.toLowerCase();
            // Check if the title contains the location name or vice versa
            return title.includes(location) || location.includes(title) ||
                   entry.content.toLowerCase().includes(`**${location}**`) ||
                   entry.content.toLowerCase().includes(`# ${location}`);
        });
    }

    createEntryForLocation(locationName, category = 'geography') {
        if (!this.isEditor) {
            this.showNotification('You need editor permissions to create wiki entries', 'error');
            return;
        }

        // Pre-fill the editor with location information
        this.openEditorModal();
        document.getElementById('entryTitle').value = locationName;
        document.getElementById('entryCategory').value = category;
        document.getElementById('entryExcerpt').value = `Information about ${locationName}, a location in the world of Eno.`;
        document.getElementById('entryContent').value = `# ${locationName}

**Location**: [Provide valley or region information]

**Description**: [Describe the location, its characteristics, and significance]

**Population**: [If applicable]

**Culture**: [If applicable]

**Notable Features**:
- [List any important buildings, landmarks, or features]

**History**: [Brief historical information]

**Related Locations**: [Mention nearby cities, landmarks, or regions]`;

        // Focus on the content area for immediate editing
        document.getElementById('entryContent').focus();
    }

    zoomToEntryLocation(entry) {
        // Only proceed if map is initialized and visible
        if (!this.mapInitialized || !this.map) return;

        // Check if map view is visible
        const mapView = document.getElementById('mapView');
        if (mapView.style.display === 'none') return;
        
        // Combine entry title and content for searching
        const searchText = `${entry.title} ${entry.content}`.toLowerCase();
        
        // First, check for explicit coordinates in entry metadata
        if (entry.coordinates) {
            console.log(`Zooming to explicit coordinates for ${entry.title}:`, entry.coordinates);
            this.map.setView(entry.coordinates, 8);
            return;
        }
        
        // Search for city names in the content
        let foundLocation = null;
        let locationType = null;
        
        // Check cities first (higher priority)
        for (const city of this.locationData.cities) {
            if (city.name && searchText.includes(city.name.toLowerCase())) {
                foundLocation = city;
                locationType = 'city';
                break;
            }
        }
        
        // If no city found, check villages
        if (!foundLocation) {
            for (const village of this.locationData.villages) {
                if (village.name && searchText.includes(village.name.toLowerCase())) {
                    foundLocation = village;
                    locationType = 'village';
                    break;
                }
            }
        }
        
        if (foundLocation) {
            // Convert GeoJSON coordinates [lon, lat] to Leaflet [lat, lon]
            const coords = [foundLocation.coordinates[1], foundLocation.coordinates[0]];
            const zoomLevel = locationType === 'city' ? 8 : 9;

            console.log(`Found ${locationType} "${foundLocation.name}" in entry, zooming to:`, coords);
            this.map.setView(coords, zoomLevel);

            // Check if this is a citystate and switch to local mode if available
            if (this.citystateMapViewer && locationType === 'city') {
                const citystateName = foundLocation.name.toLowerCase();
                if (this.citystateMapViewer.citystates.some(cs => cs.name.toLowerCase() === citystateName)) {
                    console.log(`Switching to local mode for citystate: ${foundLocation.name}`);
                    this.citystateMapViewer.switchToCitystate(foundLocation.name);
                }
            }

            // Optionally highlight the location with a temporary marker
            const tempMarker = L.circleMarker(coords, {
                color: '#ffff00',
                fillColor: '#ffff00',
                fillOpacity: 0.8,
                radius: 12,
                weight: 3
            }).addTo(this.map);

            // Remove highlight after 3 seconds
            setTimeout(() => {
                this.map.removeLayer(tempMarker);
            }, 3000);
        } else {
            // No location found, zoom to center of map
            console.log('No location found in entry, using default map center');
            this.map.setView([1.37, 10.94], 6);
        }
    }
    
    async initializeGraph() {
        console.log('Initializing D3.js force-directed graph...');

        // Initialize graph properties
        this.graphSvg = null;
        this.graphSimulation = null;
        this.graphNodes = [];
        this.graphLinks = [];
        this.selectedNodeId = null;

        // Setup SVG container
        this.setupGraphSvg();

        // Setup graph controls
        this.setupGraphControls();

        // Load graph data from API
        await this.loadGraphData();

        // Render initial graph
        this.renderGraph();

        // Mark as initialized
        this.graphInitialized = true;

        console.log('Graph initialized successfully');
    }
    
    drawGraphPlaceholder(ctx, width, height) {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw sample nodes and connections
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Central node
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
        ctx.fillStyle = '#4a708b';
        ctx.fill();
        ctx.strokeStyle = '#2a4058';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Related nodes
        const angles = [0, 60, 120, 180, 240, 300];
        const radius = 80;
        
        angles.forEach(angle => {
            const x = centerX + radius * Math.cos(angle * Math.PI / 180);
            const y = centerY + radius * Math.sin(angle * Math.PI / 180);
            
            // Draw connection
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = '#d4c0a0';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Draw node
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI);
            ctx.fillStyle = '#8b7355';
            ctx.fill();
            ctx.strokeStyle = '#5a4738';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }
    
    updateGraph(entry) {
        if (!entry || !this.graphNodesSelection) {
            return;
        }
        
        // Update selected node highlighting
        this.selectedNodeId = `entry-${entry.id}`;
        
        this.graphNodesSelection.selectAll('.graph-node')
            .classed('selected', d => d.id === this.selectedNodeId);
    }
    
    async initializeMap() {
        console.log('Initializing enhanced map with CitystateMapViewer...');

        try {
            // Initialize CitystateMapViewer instead of basic Leaflet map
            this.citystateMapViewer = new CitystateMapViewer('mapContainer', {
                globalTileUrl: 'https://rhovasti.github.io/eno-tiles/{z}/{x}/{y}.png',
                globalCenter: [1.37, 10.94],
                globalZoom: 6,
                onCitystateChange: (citystateName) => {
                    console.log(`Wiki: Citystate changed to ${citystateName}`);
                    // Look for wiki entries related to this citystate
                    this.highlightRelatedWikiEntries(citystateName);
                }
            });

            // Get reference to the underlying Leaflet map for existing functionality
            this.map = this.citystateMapViewer.map;

            const mapContainer = document.getElementById('mapContainer');
            const placeholder = document.getElementById('mapPlaceholder');

            // CitystateMapViewer handles basemap layers and zoom restrictions
            // Store basemap reference for compatibility with existing controls
            this.basemapLayers = {
                satellite: 'satellite',  // Reference to CitystateMapViewer's internal layer
                relief: 'relief'
            };
            this.currentBasemap = 'satellite';
            
            // Initialize layer groups - include new vector layers
            this.mapLayers = {
                cities: L.layerGroup().addTo(this.map),
                villages: L.layerGroup(),
                rivers: L.layerGroup(),
                lakes: L.layerGroup(),
                roads: L.layerGroup(),
                biomes: L.layerGroup(),
                elevation: L.layerGroup(),
                water: L.layerGroup()  // General water features
            };

            // Load initial layers (cities and villages for location matching)
            await this.loadMapLayer('cities');
            await this.loadMapLayer('villages');
            
            // Setup layer controls (including basemap selector)
            this.setupMapLayerControls();
            this.setupBasemapSelector();
            
            // Hide placeholder
            placeholder.style.display = 'none';
            
            this.mapInitialized = true;
            console.log('Map initialized successfully');
            
        } catch (error) {
            console.error('Error initializing map:', error);
            document.getElementById('mapPlaceholder').innerHTML = 
                '<h3>⚠️ Map Loading Error</h3><p>Could not initialize the map</p>';
        }
    }
    
    setupMapLayerControls() {
        // Setup layer toggle checkboxes
        const controls = {
            'layerCities': 'cities',
            'layerVillages': 'villages',
            'layerRivers': 'rivers',
            'layerLakes': 'lakes'
        };

        // Add controls for new vector layers if they exist in the HTML
        const extendedControls = {
            ...controls,
            'layerRoads': 'roads',
            'layerBiomes': 'biomes',
            'layerElevation': 'elevation',
            'layerWater': 'water'
        };

        Object.entries(extendedControls).forEach(([checkboxId, layerKey]) => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.addEventListener('change', async (e) => {
                    if (e.target.checked) {
                        // Load and show layer
                        if (!this.mapLayers[layerKey].hasLayer) {
                            await this.loadMapLayer(layerKey);
                        }
                        this.map.addLayer(this.mapLayers[layerKey]);
                    } else {
                        // Hide layer
                        this.map.removeLayer(this.mapLayers[layerKey]);
                    }
                });
            } else {
                // Only log warning for expected layers that don't exist
                if (['layerRoads', 'layerBiomes', 'layerElevation', 'layerWater'].includes(checkboxId)) {
                    console.log(`Wiki: Layer control ${checkboxId} not found in HTML - new vector layers may need to be added to UI`);
                }
            }
        });
    }

    setupBasemapSelector() {
        const basemapSelector = document.getElementById('basemapSelector');
        if (basemapSelector) {
            basemapSelector.addEventListener('change', (e) => {
                this.switchBasemap(e.target.value);
            });
        }
    }

    switchBasemap(basemapType) {
        // Delegate basemap switching to CitystateMapViewer if available
        if (this.citystateMapViewer && this.citystateMapViewer.switchBasemap) {
            this.citystateMapViewer.switchBasemap(basemapType);
            this.currentBasemap = basemapType;
            console.log(`Wiki: Switched to ${basemapType} basemap via CitystateMapViewer`);
        } else {
            console.warn('CitystateMapViewer not available for basemap switching');
        }
    }
    
    async loadMapLayer(layerType) {
        try {
            console.log(`Loading ${layerType} layer...`);

            // Map layer types to our new vector API endpoints
            const apiEndpoints = {
                'elevation': '/api/maps/elevation/contours',
                'roads': '/api/maps/roads/network',
                'water': '/api/maps/water/features',
                'biomes': '/api/maps/biomes/regions',
                'rivers': '/api/maps/water/rivers',
                'cities': '/api/geo/cities',  // Keep existing city/village endpoints
                'villages': '/api/geo/villages',
                'lakes': '/api/maps/water/features'  // Use water features for lakes
            };

            const endpoint = apiEndpoints[layerType] || `/api/geo/${layerType}`;
            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle both old API format (success + data) and new API format (direct data)
            let geojsonData;
            if (data.success && data.data) {
                geojsonData = data.data;
            } else if (data.data) {
                geojsonData = data.data;
            } else if (data.features) {
                geojsonData = data;
            } else {
                console.warn(`Unexpected data format for ${layerType}:`, data);
                return;
            }

            if (geojsonData.features) {
                this.addGeoJSONToLayer(geojsonData, layerType);
            } else {
                console.warn(`No features found in ${layerType} data`);
            }

        } catch (error) {
            console.error(`Error loading ${layerType} layer:`, error);
        }
    }
    
    addGeoJSONToLayer(geojsonData, layerType) {
        const layer = this.mapLayers[layerType];
        
        // Store location data for searching
        if (layerType === 'cities' || layerType === 'villages') {
            this.locationData[layerType] = geojsonData.features
                .filter(feature => feature.geometry && feature.geometry.coordinates) // Filter out null geometries
                .map(feature => ({
                    name: feature.properties.Burg || feature.properties.Name || feature.properties.name,
                    coordinates: feature.geometry.coordinates,
                    properties: feature.properties
                }));
            console.log(`Stored ${this.locationData[layerType].length} ${layerType} for location matching`);
        }
        
        L.geoJSON(geojsonData, {
            style: this.getLayerStyle(layerType),
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, this.getLayerStyle(layerType));
            },
            onEachFeature: (feature, layer) => {
                this.setupMapPopup(feature, layer, layerType);
            }
        }).addTo(layer);
        
        // Mark layer as loaded
        layer.hasLayer = true;
        
        console.log(`Added ${geojsonData.features.length} features to ${layerType} layer`);
    }
    
    getLayerStyle(layerType) {
        const styles = {
            cities: {
                color: '#e74c3c',
                fillColor: '#e74c3c',
                radius: 8,
                weight: 2,
                fillOpacity: 0.8
            },
            villages: {
                color: '#f39c12',
                fillColor: '#f39c12',
                radius: 5,
                weight: 1,
                fillOpacity: 0.6
            },
            rivers: {
                color: '#2980b9',
                weight: 2,
                opacity: 0.8
            },
            lakes: {
                color: '#4a90e2',
                fillColor: '#6bb6ff',
                weight: 2,
                fillOpacity: 0.6
            },
            roads: {
                color: '#444444',
                weight: 1.5,
                opacity: 0.8,
                dashArray: '5, 5'  // Dashed lines for roads
            },
            biomes: (feature) => {
                const biomeType = feature.properties.Biome || feature.properties.biome || 'unknown';
                const biomeColors = {
                    'Forest': '#228B22',
                    'Wetland': '#4682B4',
                    'Grassland': '#90EE90',
                    'Desert': '#F4A460',
                    'Tundra': '#E0E0E0',
                    'Mountain': '#A0522D',
                    'Ocean': '#006994',
                    'unknown': '#CCCCCC'
                };
                const color = biomeColors[biomeType] || '#CCCCCC';
                return {
                    color: color,
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 0.3
                };
            },
            elevation: (feature) => {
                const elevation = feature.properties.ELEV || 0;
                const intensity = Math.min(elevation / 200, 1);
                const color = `hsl(30, 70%, ${50 + intensity * 30}%)`;
                const weight = 0.5 + intensity * 1.5;
                return {
                    color: color,
                    weight: weight,
                    opacity: 0.7 + intensity * 0.3,
                    fillOpacity: 0
                };
            },
            water: {
                color: '#4a90e2',
                weight: 2,
                fillColor: '#6bb6ff',
                fillOpacity: 0.6
            }
        };

        const style = styles[layerType];
        if (typeof style === 'function') {
            return style;
        }
        return style || styles.cities;
    }
    
    setupMapPopup(feature, layer, layerType) {
        let popupContent = '';
        
        if (layerType === 'cities' && feature.properties.Burg) {
            const props = feature.properties;
            const coordinates = feature.geometry.coordinates.slice().reverse(); // [lat, lng]
            popupContent = `
                <div class="map-popup">
                    <h3>${props.Burg}</h3>
                    <p><strong>Population:</strong> ${props.Population?.toLocaleString() || 'Unknown'}</p>
                    <p><strong>Culture:</strong> ${props.Culture || 'Unknown'}</p>
                    <p><strong>Valley:</strong> ${props.Valley || 'Unknown'}</p>
                    ${this.findWikiEntryForLocation(props.Burg) ? (() => {
                        const wikiEntry = this.findWikiEntryForLocation(props.Burg);
                        return `
                            <div class="wiki-link">
                                <strong>📖 Wiki Entry:</strong>
                                <br><a href="#" onclick="wikiSystem.showRelatedEntry('${wikiEntry.id}')">${wikiEntry.title}</a>
                                <p>${wikiEntry.excerpt}</p>
                            </div>
                        `;
                    })() : `
                        <div class="wiki-link">
                            <strong>📖 Create Wiki Entry:</strong>
                            <br><a href="#" onclick="wikiSystem.createEntryForLocation('${props.Burg}', 'geography')">Create entry for ${props.Burg}</a>
                        </div>
                    `}
                    <div class="popup-actions">
                        <button class="detail-btn" onclick="window.cityDetailViewer.open('${props.Burg}', {population: '${props.Population || 'Unknown'}', type: 'City', culture: '${props.Culture || 'Unknown'}'}, [${coordinates[0]}, ${coordinates[1]}])">
                            🗺️ View Details
                        </button>
                    </div>
                </div>
            `;
        } else if (layerType === 'villages' && feature.properties.name) {
            const props = feature.properties;
            const coordinates = feature.geometry.coordinates.slice().reverse(); // [lat, lng]
            popupContent = `
                <div class="map-popup">
                    <h3>${props.name}</h3>
                    ${this.findWikiEntryForLocation(props.name) ? (() => {
                        const wikiEntry = this.findWikiEntryForLocation(props.name);
                        return `
                            <div class="wiki-link">
                                <strong>📖 Wiki Entry:</strong>
                                <br><a href="#" onclick="wikiSystem.showRelatedEntry('${wikiEntry.id}')">${wikiEntry.title}</a>
                                <p>${wikiEntry.excerpt}</p>
                            </div>
                        `;
                    })() : `
                        <div class="wiki-link">
                            <strong>📖 Create Wiki Entry:</strong>
                            <br><a href="#" onclick="wikiSystem.createEntryForLocation('${props.name}', 'geography')">Create entry for ${props.name}</a>
                        </div>
                    `}
                    <div class="popup-actions">
                        <button class="detail-btn" onclick="window.cityDetailViewer.open('${props.name}', {population: 'Unknown', type: 'Village'}, [${coordinates[0]}, ${coordinates[1]}])">
                            🗺️ View Details
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Generic popup for rivers/lakes
            const name = feature.properties.name || feature.properties.Name || 'Unknown';
            popupContent = `
                <div class="map-popup">
                    <h3>${name}</h3>
                    <p><strong>Type:</strong> ${layerType.slice(0, -1)}</p>
                </div>
            `;
        }
        
        layer.bindPopup(popupContent);
    }
    
    viewWikiEntry(entryId) {
        // This method will be called from map popups
        const entry = this.entries.find(e => e.id == entryId);
        if (entry) {
            this.showEntryModal(entry);
        }
    }
    
    // ====================
    // Editor Methods
    // ====================
    
    openEditorModal(entry = null) {
        this.currentEditingEntry = entry;
        const modal = document.getElementById('editorModal');
        const form = document.getElementById('editorForm');
        const title = document.getElementById('editorTitle');
        
        // Reset form
        form.reset();
        
        if (entry) {
            // Editing existing entry
            title.textContent = 'Edit Wiki Entry';
            document.getElementById('entryTitle').value = entry.title;
            document.getElementById('entryCategory').value = entry.category;
            document.getElementById('entryExcerpt').value = entry.excerpt || '';
            document.getElementById('entryContent').value = entry.content;
            document.getElementById('entryTags').value = entry.tags ? entry.tags.join(', ') : '';
            document.getElementById('entryRelated').value = entry.related ? entry.related.join(', ') : '';
        } else {
            // Creating new entry
            title.textContent = 'New Wiki Entry';
        }
        
        modal.classList.add('active');
    }
    
    closeEditorModal() {
        const modal = document.getElementById('editorModal');
        modal.classList.remove('active');
        this.currentEditingEntry = null;
        
        // Clear auto-save timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    async saveEntry() {
        const form = document.getElementById('editorForm');
        const formData = new FormData(form);
        
        // Parse tags and related entries
        const tags = formData.get('tags') 
            ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag)
            : [];
        const related = formData.get('related')
            ? formData.get('related').split(',').map(rel => rel.trim()).filter(rel => rel)
            : [];
        
        const entryData = {
            title: formData.get('title'),
            category: formData.get('category'),
            excerpt: formData.get('excerpt'),
            content: formData.get('content'),
            tags: tags,
            related: related
        };
        
        try {
            const token = this.getCookie('token');
            let response;
            
            if (this.currentEditingEntry) {
                // Update existing entry
                response = await fetch(`/api/wiki/entries/${this.currentEditingEntry.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include',
                    body: JSON.stringify(entryData)
                });
            } else {
                // Create new entry
                response = await fetch('/api/wiki/entries', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include',
                    body: JSON.stringify(entryData)
                });
            }
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification('Wiki entry saved successfully!', 'success');
                this.closeEditorModal();
                
                // Reload entries to show the new/updated one
                await this.loadWikiEntries();
                this.updateDisplay();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to save wiki entry', 'error');
            }
        } catch (error) {
            console.error('Error saving wiki entry:', error);
            this.showNotification('Error saving wiki entry', 'error');
        }
    }
    
    previewEntry() {
        const content = document.getElementById('entryContent').value;
        const title = document.getElementById('entryTitle').value;
        
        // Convert markdown-style formatting to HTML
        let html = content
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/g, '<p>')
            .replace(/$/g, '</p>');
        
        // Show preview in a temporary modal
        const previewHtml = `
            <h2>${title}</h2>
            <div>${html}</div>
        `;
        
        // You could show this in a separate modal or replace the content temporarily
        alert('Preview:\n\n' + title + '\n\n' + content);
    }
    
    scheduleAutoSave() {
        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        // Schedule new auto-save in 30 seconds
        this.autoSaveTimer = setTimeout(() => {
            if (this.currentEditingEntry) {
                this.saveEntry();
            }
        }, 30000);
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 5px;
            z-index: 3000;
            animation: slideDown 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ====================
    // D3.js Graph Visualization Methods
    // ====================
    
    setupGraphSvg() {
        const svg = d3.select('#graphSvg');
        svg.selectAll('*').remove(); // Clear existing content
        
        // Get container dimensions
        const container = document.querySelector('.graph-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Set up zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                svg.select('.graph-content').attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Store zoom for controls
        this.graphZoom = zoom;
        
        // Create main group for graph content
        this.graphContent = svg.append('g').attr('class', 'graph-content');
        
        // Create groups for links and nodes
        this.graphLinksGroup = this.graphContent.append('g').attr('class', 'links');
        this.graphNodesGroup = this.graphContent.append('g').attr('class', 'nodes');
        
        this.graphSvg = svg;
        this.graphWidth = width;
        this.graphHeight = height;
    }
    
    setupGraphControls() {
        // Reset zoom button
        document.getElementById('resetZoomBtn').onclick = () => {
            this.graphSvg.transition()
                .duration(750)
                .call(this.graphZoom.transform, d3.zoomIdentity);
        };
        
        // Center graph button
        document.getElementById('centerGraphBtn').onclick = () => {
            this.centerGraph();
        };
    }
    
    async loadGraphData() {
        try {
            console.log('Loading graph data from API...');
            const response = await fetch('/api/wiki/graph');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Graph data loaded:', data);
            
            this.graphData = data;
            this.graphNodes = [...data.nodes];
            this.graphLinks = [...data.links];
            
        } catch (error) {
            console.error('Failed to load graph data:', error);
            // Use empty data as fallback
            this.graphData = { nodes: [], links: [] };
            this.graphNodes = [];
            this.graphLinks = [];
        }
    }
    
    renderGraph() {
        if (!this.graphSvg || this.graphNodes.length === 0) {
            console.log('No graph data or SVG not ready');
            return;
        }
        
        console.log('Rendering graph with', this.graphNodes.length, 'nodes and', this.graphLinks.length, 'links');
        
        // Create force simulation
        this.graphSimulation = d3.forceSimulation(this.graphNodes)
            .force('link', d3.forceLink(this.graphLinks).id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.graphWidth / 2, this.graphHeight / 2))
            .force('collision', d3.forceCollide().radius(d => d.size + 5));
        
        // Create links
        const links = this.graphLinksGroup
            .selectAll('.graph-link')
            .data(this.graphLinks)
            .enter()
            .append('line')
            .attr('class', 'graph-link');
        
        // Create nodes
        const nodes = this.graphNodesGroup
            .selectAll('.graph-node')
            .data(this.graphNodes)
            .enter()
            .append('g')
            .attr('class', 'node-group')
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d))
            );
        
        // Add circles to nodes
        nodes.append('circle')
            .attr('class', 'graph-node')
            .attr('r', d => d.size)
            .attr('fill', d => d.color)
            .on('click', (event, d) => this.onNodeClick(event, d))
            .on('mouseover', (event, d) => this.onNodeHover(event, d, true))
            .on('mouseout', (event, d) => this.onNodeHover(event, d, false));
        
        // Add text labels
        nodes.append('text')
            .attr('class', d => d.type === 'tag' ? 'graph-tag-text' : 'graph-text')
            .attr('dy', d => d.size + 15)
            .text(d => d.title.length > 12 ? d.title.substring(0, 10) + '...' : d.title);
        
        // Update simulation
        this.graphSimulation.on('tick', () => {
            links
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            nodes
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });
        
        // Store references for later use
        this.graphNodesSelection = nodes;
        this.graphLinksSelection = links;
    }
    
    centerGraph() {
        if (!this.graphSimulation) return;
        
        // Calculate center of mass of nodes
        let totalX = 0, totalY = 0, count = 0;
        
        this.graphNodes.forEach(node => {
            if (node.x !== undefined && node.y !== undefined) {
                totalX += node.x;
                totalY += node.y;
                count++;
            }
        });
        
        if (count === 0) return;
        
        const centerX = totalX / count;
        const centerY = totalY / count;
        
        // Transform to center the graph
        const transform = d3.zoomIdentity
            .translate(this.graphWidth / 2 - centerX, this.graphHeight / 2 - centerY)
            .scale(1);
        
        this.graphSvg.transition()
            .duration(750)
            .call(this.graphZoom.transform, transform);
    }
    
    // Drag event handlers
    dragstarted(event, d) {
        if (!event.active) this.graphSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    dragended(event, d) {
        if (!event.active) this.graphSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    // Node interaction handlers
    onNodeClick(event, d) {
        console.log('Node clicked:', d);

        if (d.type === 'entry' && d.entryId) {
            // Navigate to the clicked entry
            const entry = this.entries.find(e => e.id === d.entryId);
            if (entry) {
                // Close graph modal
                const graphPanel = document.getElementById('graphPanel');
                if (graphPanel) {
                    graphPanel.classList.remove('active');
                }

                // Select the topic
                this.selectTopic(entry);

                // Scroll to topic in list
                const listItem = document.querySelector(`[data-topic-id="${entry.id}"]`);
                if (listItem) {
                    listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }

        event.stopPropagation();
    }
    
    onNodeHover(event, d, isEntering) {
        if (isEntering) {
            // Show tooltip or highlight
            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .attr('r', d => d.size * 1.2);
                
            console.log('Hovering over:', d.title);
        } else {
            // Remove highlight
            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .attr('r', d => d.size);
        }
    }
    
}

// Initialize the wiki system when page loads
let wikiSystem;
let wiki; // Global reference for map popups
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - Creating WikiSystem...');
    wikiSystem = new WikiSystem();
    wiki = wikiSystem; // Make globally accessible for map popups
    window.wikiSystem = wikiSystem; // Also make available on window for integration
    console.log('WikiSystem created successfully');
});