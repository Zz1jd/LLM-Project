const path = require('path');

function parseList(value, fallback) {
    if (!value) return fallback;
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const projectRoot = path.join(__dirname, '..');

module.exports = {
    projectRoot,
    apiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.chatanywhere.tech/v1',
    targetModel: process.env.TARGET_MODEL || 'gpt-4o',
    maxIterations: parsePositiveInteger(process.env.MAX_ITERATIONS, 3),
    pilotTasks: parseList(process.env.PILOT_TASKS, [
        'task1_login',
        'task2_shopping_cart',
        'task3_chat_ui',
        'task4_dashboard',
        'task5_modal'
    ]),
    pilotModes: parseList(process.env.PILOT_MODES, ['text-only', 'multimodal']),
    visionDetail: process.env.VISION_DETAIL || 'low',
    browser: {
        desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
        mobile: { width: 390, height: 844, deviceScaleFactor: 2 }
    }
};
