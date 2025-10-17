/**
 * Wiki to Map Integration
 * Provides "View on Map" functionality for wiki entries
 */

// Open wiki entry on temporal map
function openTemporalMap(entryId, entryTitle, latitude, longitude, cycle, day, locationType, locationId) {
    // Build URL with parameters
    const params = new URLSearchParams();

    params.set('wiki_entry', entryId);
    params.set('title', encodeURIComponent(entryTitle));

    if (latitude !== null && longitude !== null) {
        params.set('lat', latitude);
        params.set('lon', longitude);
    }

    if (cycle !== null) {
        params.set('cycle', cycle);
    }

    if (day !== null) {
        params.set('day', day);
    }

    if (locationType) {
        params.set('location_type', locationType);
    }

    if (locationId) {
        params.set('location_id', locationId);
    }

    // Determine appropriate zoom level
    let zoom = 10;
    if (locationType === 'region') zoom = 6;
    else if (locationType === 'citystate') zoom = 10;
    else if (locationType === 'district') zoom = 13;
    else if (locationType === 'building') zoom = 16;

    params.set('zoom', zoom);

    // Open in new tab
    const url = `/hml/unified-map.html?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Add "View on Map" button to wiki entry cards
function addMapButtonToEntry(entryCard, entryData) {
    // Check if entry has location data
    if (!entryData.latitude || !entryData.longitude) {
        return; // No location data, skip
    }

    // Check if button already exists
    if (entryCard.querySelector('.view-on-map-btn')) {
        return;
    }

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'map-button-container';
    buttonContainer.style.cssText = `
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #d4c0a0;
    `;

    // Create map button
    const mapButton = document.createElement('button');
    mapButton.className = 'view-on-map-btn';
    mapButton.innerHTML = '🗺️ View on Temporal Map';
    mapButton.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    `;

    mapButton.addEventListener('mouseover', () => {
        mapButton.style.transform = 'translateY(-2px)';
        mapButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    mapButton.addEventListener('mouseout', () => {
        mapButton.style.transform = 'translateY(0)';
        mapButton.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
    });

    mapButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click

        openTemporalMap(
            entryData.id,
            entryData.title,
            entryData.latitude,
            entryData.longitude,
            entryData.temporal_start_cycle || 0,
            entryData.temporal_start_day || 1,
            entryData.location_type,
            entryData.location_id
        );
    });

    buttonContainer.appendChild(mapButton);

    // Find appropriate place to insert button
    const cardContent = entryCard.querySelector('.entry-content') ||
                       entryCard.querySelector('.entry-excerpt') ||
                       entryCard;

    cardContent.appendChild(buttonContainer);
}

// Enhanced entry modal with map button
function enhanceEntryModal(modalElement, entryData) {
    if (!entryData.latitude || !entryData.longitude) {
        return;
    }

    // Find modal content area
    const modalBody = modalElement.querySelector('.modal-body') ||
                     modalElement.querySelector('.entry-content') ||
                     modalElement;

    // Create large map button for modal
    const mapButtonSection = document.createElement('div');
    mapButtonSection.className = 'modal-map-section';
    mapButtonSection.style.cssText = `
        margin: 20px 0;
        padding: 15px;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        border-radius: 10px;
        border: 2px solid rgba(102, 126, 234, 0.3);
    `;

    const mapButton = document.createElement('button');
    mapButton.className = 'view-on-map-btn-large';
    mapButton.innerHTML = '🗺️ Explore on Interactive Temporal Map';
    mapButton.style.cssText = `
        width: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 15px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 700;
        transition: all 0.3s;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    `;

    mapButton.addEventListener('mouseover', () => {
        mapButton.style.transform = 'scale(1.02)';
        mapButton.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
    });

    mapButton.addEventListener('mouseout', () => {
        mapButton.style.transform = 'scale(1)';
        mapButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    mapButton.addEventListener('click', () => {
        openTemporalMap(
            entryData.id,
            entryData.title,
            entryData.latitude,
            entryData.longitude,
            entryData.temporal_start_cycle || 0,
            entryData.temporal_start_day || 1,
            entryData.location_type,
            entryData.location_id
        );
    });

    const infoText = document.createElement('p');
    infoText.style.cssText = `
        margin: 10px 0 0 0;
        font-size: 13px;
        color: #666;
        text-align: center;
    `;
    infoText.textContent = 'View this location in historical context with timeline controls';

    mapButtonSection.appendChild(mapButton);
    mapButtonSection.appendChild(infoText);

    // Insert at top of modal body
    modalBody.insertBefore(mapButtonSection, modalBody.firstChild);
}

// Initialize map integration for all entries
function initializeWikiMapIntegration() {
    // Find all entry cards and add map buttons
    const entryCards = document.querySelectorAll('[data-entry-id]');

    entryCards.forEach(card => {
        const entryId = card.dataset.entryId;

        // Try to get entry data from various sources
        let entryData = null;

        // Check if data is stored in dataset
        if (card.dataset.latitude && card.dataset.longitude) {
            entryData = {
                id: entryId,
                title: card.dataset.title || card.querySelector('.entry-title')?.textContent,
                latitude: parseFloat(card.dataset.latitude),
                longitude: parseFloat(card.dataset.longitude),
                temporal_start_cycle: parseInt(card.dataset.cycle) || null,
                temporal_start_day: parseInt(card.dataset.day) || null,
                location_type: card.dataset.locationType || null,
                location_id: card.dataset.locationId || null
            };
        }

        if (entryData) {
            addMapButtonToEntry(card, entryData);
        }
    });

    console.log(`Wiki-Map Integration: Added map buttons to ${entryCards.length} entries`);
}

// Export functions to window for global access
if (typeof window !== 'undefined') {
    window.openTemporalMap = openTemporalMap;
    window.addMapButtonToEntry = addMapButtonToEntry;
    window.enhanceEntryModal = enhanceEntryModal;
    window.initializeWikiMapIntegration = initializeWikiMapIntegration;
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWikiMapIntegration);
    } else {
        // DOM already loaded
        setTimeout(initializeWikiMapIntegration, 500);
    }
}