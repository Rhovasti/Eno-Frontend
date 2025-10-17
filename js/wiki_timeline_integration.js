/**
 * Wiki Timeline Integration
 * Connects TemporalTimeline component to wiki page functionality
 */

let wikiTimeline = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeTimelineIntegration();
});

function initializeTimelineIntegration() {
    const timelineContainer = document.getElementById('wikiTimeline');
    const timelineSection = document.getElementById('timelineSection');
    const showTimelineCheckbox = document.getElementById('showTimeline');
    const collapseBtn = document.getElementById('collapseTimeline');

    if (!timelineContainer || !timelineSection || !showTimelineCheckbox) {
        console.warn('Timeline integration elements not found');
        return;
    }

    showTimelineCheckbox.addEventListener('change', function() {
        if (this.checked) {
            timelineSection.classList.add('visible');
            if (!wikiTimeline) {
                initializeTimeline();
            }
        } else {
            timelineSection.classList.remove('visible');
        }
    });

    collapseBtn.addEventListener('click', function() {
        timelineSection.classList.remove('visible');
        showTimelineCheckbox.checked = false;
    });
}

function initializeTimeline() {
    const timelineContainer = document.getElementById('wikiTimeline');

    try {
        wikiTimeline = new TemporalTimeline('wikiTimeline', {
            width: timelineContainer.clientWidth || 800,
            height: 200,
            initialCycle: 0,
            initialZoomLevel: 3,
            onEventClick: handleTimelineEventClick,
            onTimeChange: handleTimelineChange
        });

        console.log('Wiki timeline initialized successfully');
    } catch (error) {
        console.error('Error initializing wiki timeline:', error);
        timelineContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #8b7355;">
                <p><strong>Timeline temporarily unavailable</strong></p>
                <p style="font-size: 0.9em;">Please ensure the timeline API endpoints are configured.</p>
            </div>
        `;
    }
}

function handleTimelineEventClick(event) {
    console.log('Timeline event clicked:', event);

    if (!event || !event.title) {
        return;
    }

    if (event.related_wiki_entry_id) {
        navigateToWikiEntry(event.related_wiki_entry_id);
    } else {
        searchWikiByEventTitle(event.title);
    }
}

function navigateToWikiEntry(entryId) {
    const entryCard = document.querySelector(`[data-entry-id="${entryId}"]`);

    if (entryCard) {
        entryCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        entryCard.classList.add('highlight');
        setTimeout(() => {
            entryCard.classList.remove('highlight');
        }, 2000);

        entryCard.click();
    } else {
        console.warn(`Wiki entry ${entryId} not found in current view`);
        showTemporaryMessage(`Looking for related entry: ${entryId}`);
    }
}

function searchWikiByEventTitle(eventTitle) {
    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.value = eventTitle;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        searchInput.scrollIntoView({ behavior: 'smooth', block: 'start' });

        showTemporaryMessage(`Searching wiki for: ${eventTitle}`);
    }
}

function handleTimelineChange(newCycle) {
    console.log('Timeline centered on cycle:', newCycle);
}

function showTemporaryMessage(message) {
    const existingMessage = document.getElementById('timeline-temp-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.id = 'timeline-temp-message';
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #8b7355;
        color: white;
        padding: 12px 24px;
        border-radius: 5px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        animation: slideDown 0.3s ease-out;
    `;
    messageDiv.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateX(-50%) translateY(-20px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.transition = 'opacity 0.3s';
        messageDiv.style.opacity = '0';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

function filterTimelineByCategory(category) {
    if (!wikiTimeline) {
        return;
    }

    const categoryToEventTypeMap = {
        'history': ['battle', 'treaty', 'founding'],
        'characters': ['birth', 'death'],
        'geography': ['founding', 'discovery'],
        'mythology': ['discovery'],
        'magic': ['discovery'],
        'all': []
    };

    const eventTypes = categoryToEventTypeMap[category] || [];

    wikiTimeline.setFilters({
        eventTypes: eventTypes,
        minImportance: 0
    });
}

if (typeof window !== 'undefined') {
    window.wikiTimelineIntegration = {
        filterByCategory: filterTimelineByCategory,
        jumpToCycle: (cycle) => wikiTimeline && wikiTimeline.jumpToCycle(cycle),
        jumpToEvent: (eventId) => wikiTimeline && wikiTimeline.jumpToEvent(eventId)
    };
}