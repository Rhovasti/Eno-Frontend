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
        
        this.init();
    }
    
    async init() {
        // Check authentication first
        await this.checkAuthentication();
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadWikiEntries();
        
        // Initialize graph visualization
        this.initializeGraph();
        
        // Update UI
        this.updateDisplay();
        
        // Setup editor interface if user has permissions
        this.setupEditorInterface();
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
        // Category filtering
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.filterByCategory(e.target.dataset.category);
            });
        });
        
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
        
        // View toggles
        document.getElementById('showMap').addEventListener('change', (e) => {
            this.toggleMapView(e.target.checked);
        });
        
        document.getElementById('showGraph').addEventListener('change', (e) => {
            this.toggleGraphPanel(e.target.checked);
        });
        
        // Modal close
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('entryModal').addEventListener('click', (e) => {
            if (e.target.id === 'entryModal') {
                this.closeModal();
            }
        });
    }
    
    async loadWikiEntries() {
        try {
            // Show loading state
            document.getElementById('loadingState').style.display = 'block';
            document.getElementById('entryGrid').style.display = 'none';
            
            // Fetch wiki entries from the backend
            const response = await fetch('/api/wiki/entries');
            
            if (!response.ok) {
                // If API doesn't exist yet, use sample data
                this.entries = this.getSampleEntries();
            } else {
                const data = await response.json();
                this.entries = data.entries || this.getSampleEntries();
            }
            
            this.filteredEntries = [...this.entries];
            
            // Update category counts
            this.updateCategoryCounts();
            
            // Hide loading state
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('entryGrid').style.display = 'grid';
            
        } catch (error) {
            console.error('Error loading wiki entries:', error);
            // Use sample data as fallback
            this.entries = this.getSampleEntries();
            this.filteredEntries = [...this.entries];
            this.updateCategoryCounts();
            
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('entryGrid').style.display = 'grid';
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
    
    filterByCategory(category) {
        this.currentCategory = category;
        
        // Update active state
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Filter entries
        if (category === 'all') {
            this.filteredEntries = [...this.entries];
        } else {
            this.filteredEntries = this.entries.filter(entry => entry.category === category);
        }
        
        // Apply search filter if active
        if (this.searchTerm) {
            this.searchEntries(this.searchTerm);
        } else {
            this.updateDisplay();
        }
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
        const grid = document.getElementById('entryGrid');
        grid.innerHTML = '';
        
        if (this.filteredEntries.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #8b7355;">No entries found matching your criteria.</div>';
            return;
        }
        
        this.filteredEntries.forEach(entry => {
            const card = this.createEntryCard(entry);
            grid.appendChild(card);
        });
    }
    
    createEntryCard(entry) {
        const card = document.createElement('div');
        card.className = 'entry-card';
        card.onclick = () => this.showEntry(entry);
        
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
        
        modalBody.innerHTML = `
            <h2>${entry.title}</h2>
            <div style="margin: 15px 0;">
                <span class="entry-category">${entry.category}</span>
                ${entry.tags.map(tag => `<span class="entry-tag">${tag}</span>`).join('')}
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
    }
    
    showRelatedEntry(entryId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (entry) {
            this.showEntry(entry);
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
        console.log('Initializing Leaflet map with Eno geospatial data...');
        
        try {
            // Initialize Leaflet map
            const mapContainer = document.getElementById('mapContainer');
            const placeholder = document.getElementById('mapPlaceholder');
            
            // Create map centered on Eno world coordinates
            this.map = L.map('mapContainer').setView([1.37, 10.94], 6);
            
            // Add custom Eno world tile layer (TMS format)
            L.tileLayer('https://rhovasti.github.io/eno-tiles/{z}/{x}/{y}.png', {
                attribution: 'Eno World Map - Custom satellite imagery',
                minZoom: 0,
                maxZoom: 8,
                opacity: 0.8,
                tms: true  // Important: tiles were generated in TMS format
            }).addTo(this.map);
            
            // Initialize layer groups
            this.mapLayers = {
                cities: L.layerGroup().addTo(this.map),
                villages: L.layerGroup(),
                rivers: L.layerGroup(),
                lakes: L.layerGroup()
            };
            
            // Load initial layer (cities)
            await this.loadMapLayer('cities');
            
            // Setup layer controls
            this.setupMapLayerControls();
            
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
        
        Object.entries(controls).forEach(([checkboxId, layerKey]) => {
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
            }
        });
    }
    
    async loadMapLayer(layerType) {
        try {
            console.log(`Loading ${layerType} layer...`);
            const response = await fetch(`/api/geo/${layerType}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.data && data.data.features) {
                this.addGeoJSONToLayer(data.data, layerType);
            }
            
        } catch (error) {
            console.error(`Error loading ${layerType} layer:`, error);
        }
    }
    
    addGeoJSONToLayer(geojsonData, layerType) {
        const layer = this.mapLayers[layerType];
        
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
                color: '#3498db',
                weight: 3,
                opacity: 0.7
            },
            lakes: {
                color: '#2980b9',
                fillColor: '#3498db',
                weight: 2,
                fillOpacity: 0.5
            }
        };
        
        return styles[layerType] || styles.cities;
    }
    
    setupMapPopup(feature, layer, layerType) {
        let popupContent = '';
        
        if (layerType === 'cities' && feature.properties.Burg) {
            const props = feature.properties;
            popupContent = `
                <div class="map-popup">
                    <h3>${props.Burg}</h3>
                    <p><strong>Population:</strong> ${props.Population?.toLocaleString() || 'Unknown'}</p>
                    <p><strong>Culture:</strong> ${props.Culture || 'Unknown'}</p>
                    <p><strong>Valley:</strong> ${props.Valley || 'Unknown'}</p>
                    ${props.wikiEntry ? `
                        <div class="wiki-link">
                            <strong>📖 Wiki Entry:</strong>
                            <br><a href="#" onclick="wiki.viewWikiEntry(${props.wikiEntry.id})">${props.wikiEntry.title}</a>
                            <p>${props.wikiEntry.excerpt}</p>
                        </div>
                    ` : '<p><em>No wiki entry found</em></p>'}
                </div>
            `;
        } else if (layerType === 'villages' && feature.properties.name) {
            const props = feature.properties;
            popupContent = `
                <div class="map-popup">
                    <h3>${props.name}</h3>
                    ${props.wikiEntry ? `
                        <div class="wiki-link">
                            <strong>📖 Wiki Entry:</strong>
                            <br><a href="#" onclick="wiki.viewWikiEntry(${props.wikiEntry.id})">${props.wikiEntry.title}</a>
                            <p>${props.wikiEntry.excerpt}</p>
                        </div>
                    ` : '<p><em>No wiki entry found</em></p>'}
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
                this.showEntry(entry);
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
    console.log('WikiSystem created successfully');
});