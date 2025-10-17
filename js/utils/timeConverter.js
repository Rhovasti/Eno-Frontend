/**
 * Temporal System Utility Functions
 * Converts between game time cycles and human-readable formats
 *
 * Time System:
 * - 1 Full Cycle = 360 days = 12 months = 4 seasons
 * - 1 Month = 30 days
 * - 1 Season = 90 days (3 months)
 *
 * Eras:
 * - Ancient Past: -10,000 to -1 cycles
 * - Before Era: -1 to 0 cycles
 * - Now Era: 0 to 1,000 cycles
 * - After Era: 1,000 to 2,000 cycles
 */

const TIME_CONSTANTS = {
    DAYS_PER_CYCLE: 360,
    DAYS_PER_MONTH: 30,
    DAYS_PER_SEASON: 90,
    MONTHS_PER_CYCLE: 12,
    SEASONS_PER_CYCLE: 4
};

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const MONTH_NAMES = [
    'First Month', 'Second Month', 'Third Month',
    'Fourth Month', 'Fifth Month', 'Sixth Month',
    'Seventh Month', 'Eighth Month', 'Ninth Month',
    'Tenth Month', 'Eleventh Month', 'Twelfth Month'
];

const ERA_NAMES = {
    ANCIENT: { min: -10000, max: -1, name: 'Ancient Past' },
    BEFORE: { min: -1, max: 0, name: 'Before Era' },
    NOW: { min: 0, max: 1000, name: 'Now Era' },
    AFTER: { min: 1000, max: 2000, name: 'After Era' }
};

/**
 * Convert cycle and day to human-readable format
 * @param {number} cycle - Full cycle number (can be negative)
 * @param {number} day - Day within cycle (1-360)
 * @returns {string} Human-readable format
 */
function cycleToReadable(cycle, day = 1) {
    if (cycle === null || cycle === undefined) {
        return 'Unknown time';
    }

    day = day || 1;
    const season = getSeason(day);
    const month = getMonth(day);
    const dayInMonth = getDayInMonth(day);
    const era = getEra(cycle);

    return `Cycle ${cycle}, ${season}, ${month}, Day ${dayInMonth} (${era})`;
}

/**
 * Convert cycle and day to short format
 * @param {number} cycle - Full cycle number
 * @param {number} day - Day within cycle (1-360)
 * @returns {string} Short format (e.g., "C523.145")
 */
function cycleToShort(cycle, day = 1) {
    if (cycle === null || cycle === undefined) {
        return 'Unknown';
    }
    return `C${cycle}.${day || 1}`;
}

/**
 * Convert cycles to total days
 * @param {number} cycles - Number of cycles
 * @returns {number} Total days
 */
function cycleToDays(cycles) {
    return cycles * TIME_CONSTANTS.DAYS_PER_CYCLE;
}

/**
 * Convert days to cycles (with remainder)
 * @param {number} days - Total days
 * @returns {{cycles: number, days: number}} Cycles and remaining days
 */
function daysToCycles(days) {
    const cycles = Math.floor(days / TIME_CONSTANTS.DAYS_PER_CYCLE);
    const remainingDays = days % TIME_CONSTANTS.DAYS_PER_CYCLE;
    return { cycles, days: remainingDays };
}

/**
 * Get season name from day number
 * @param {number} day - Day within cycle (1-360)
 * @returns {string} Season name
 */
function getSeason(day) {
    if (day < 1 || day > 360) return 'Unknown Season';
    const seasonIndex = Math.floor((day - 1) / TIME_CONSTANTS.DAYS_PER_SEASON);
    return SEASON_NAMES[seasonIndex];
}

/**
 * Get season number from day (0-3)
 * @param {number} day - Day within cycle (1-360)
 * @returns {number} Season index (0-3)
 */
function getSeasonNumber(day) {
    if (day < 1 || day > 360) return 0;
    return Math.floor((day - 1) / TIME_CONSTANTS.DAYS_PER_SEASON);
}

/**
 * Get month name from day number
 * @param {number} day - Day within cycle (1-360)
 * @returns {string} Month name
 */
function getMonth(day) {
    if (day < 1 || day > 360) return 'Unknown Month';
    const monthIndex = Math.floor((day - 1) / TIME_CONSTANTS.DAYS_PER_MONTH);
    return MONTH_NAMES[monthIndex];
}

/**
 * Get month number from day (1-12)
 * @param {number} day - Day within cycle (1-360)
 * @returns {number} Month number (1-12)
 */
function getMonthNumber(day) {
    if (day < 1 || day > 360) return 1;
    return Math.floor((day - 1) / TIME_CONSTANTS.DAYS_PER_MONTH) + 1;
}

/**
 * Get day within month from absolute day
 * @param {number} day - Day within cycle (1-360)
 * @returns {number} Day within month (1-30)
 */
function getDayInMonth(day) {
    if (day < 1 || day > 360) return 1;
    return ((day - 1) % TIME_CONSTANTS.DAYS_PER_MONTH) + 1;
}

/**
 * Get era name from cycle number
 * @param {number} cycle - Full cycle number
 * @returns {string} Era name
 */
function getEra(cycle) {
    if (cycle < ERA_NAMES.ANCIENT.max) return ERA_NAMES.ANCIENT.name;
    if (cycle < ERA_NAMES.BEFORE.max) return ERA_NAMES.BEFORE.name;
    if (cycle < ERA_NAMES.NOW.max) return ERA_NAMES.NOW.name;
    if (cycle < ERA_NAMES.AFTER.max) return ERA_NAMES.AFTER.name;
    return 'Far Future';
}

/**
 * Calculate time difference between two temporal coordinates
 * @param {number} cycle1 - Start cycle
 * @param {number} day1 - Start day
 * @param {number} cycle2 - End cycle
 * @param {number} day2 - End day
 * @returns {{cycles: number, days: number, totalDays: number}} Time difference
 */
function timeDifference(cycle1, day1, cycle2, day2) {
    day1 = day1 || 1;
    day2 = day2 || 1;

    const totalDays1 = cycleToDays(cycle1) + day1;
    const totalDays2 = cycleToDays(cycle2) + day2;
    const diffDays = Math.abs(totalDays2 - totalDays1);

    const { cycles, days } = daysToCycles(diffDays);

    return {
        cycles,
        days,
        totalDays: diffDays
    };
}

/**
 * Get current game time (configurable, defaults to cycle 0, day 1)
 * In production, this could be fetched from server or game settings
 * @returns {{cycle: number, day: number}}
 */
function getCurrentGameTime() {
    // TODO: Make this configurable per game or fetch from server
    return {
        cycle: 0,
        day: 1
    };
}

/**
 * Convert absolute day to cycle and day
 * @param {number} absoluteDay - Total days from cycle 0
 * @returns {{cycle: number, day: number}}
 */
function absoluteDayToTime(absoluteDay) {
    const { cycles, days } = daysToCycles(absoluteDay);
    return {
        cycle: cycles,
        day: days + 1 // Days are 1-indexed
    };
}

/**
 * Convert cycle and day to absolute day
 * @param {number} cycle - Cycle number
 * @param {number} day - Day within cycle
 * @returns {number} Absolute day count
 */
function timeToAbsoluteDay(cycle, day = 1) {
    return cycleToDays(cycle) + (day - 1);
}

/**
 * Format time range for display
 * @param {number} cycleStart - Start cycle
 * @param {number} dayStart - Start day
 * @param {number} cycleEnd - End cycle (null for instantaneous)
 * @param {number} dayEnd - End day
 * @returns {string} Formatted range
 */
function formatTimeRange(cycleStart, dayStart, cycleEnd, dayEnd) {
    const start = cycleToShort(cycleStart, dayStart);

    if (cycleEnd === null || cycleEnd === undefined) {
        return start;
    }

    const end = cycleToShort(cycleEnd, dayEnd);
    return `${start} - ${end}`;
}

/**
 * Check if a time point falls within a range
 * @param {number} cycle - Cycle to check
 * @param {number} day - Day to check
 * @param {number} rangeStart - Range start cycle
 * @param {number} rangeStartDay - Range start day
 * @param {number} rangeEnd - Range end cycle (null for ongoing)
 * @param {number} rangeEndDay - Range end day
 * @returns {boolean} True if within range
 */
function isWithinTimeRange(cycle, day, rangeStart, rangeStartDay, rangeEnd, rangeEndDay) {
    const checkTime = timeToAbsoluteDay(cycle, day);
    const startTime = timeToAbsoluteDay(rangeStart, rangeStartDay);

    if (rangeEnd === null) {
        // Ongoing event, only check start
        return checkTime >= startTime;
    }

    const endTime = timeToAbsoluteDay(rangeEnd, rangeEndDay);
    return checkTime >= startTime && checkTime <= endTime;
}

/**
 * Get granularity display name
 * @param {string} granularity - Granularity code
 * @returns {string} Display name
 */
function getGranularityName(granularity) {
    const names = {
        'epoch': 'Epoch',
        'century': 'Century',
        'decade': 'Decade',
        'cycle': 'Cycle',
        'season': 'Season',
        'month': 'Month',
        'day': 'Day'
    };
    return names[granularity] || 'Unknown';
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TIME_CONSTANTS,
        SEASON_NAMES,
        MONTH_NAMES,
        ERA_NAMES,
        cycleToReadable,
        cycleToShort,
        cycleToDays,
        daysToCycles,
        getSeason,
        getSeasonNumber,
        getMonth,
        getMonthNumber,
        getDayInMonth,
        getEra,
        timeDifference,
        getCurrentGameTime,
        absoluteDayToTime,
        timeToAbsoluteDay,
        formatTimeRange,
        isWithinTimeRange,
        getGranularityName
    };
}