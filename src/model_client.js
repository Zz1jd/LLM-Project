const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const config = require('./config');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: config.apiBaseUrl,
    maxRetries: 3,
    timeout: 120000
});

function sanitizeHtml(rawContent) {
    let content = (rawContent || '').trim();
    if (content.startsWith('```')) {
        content = content
            .replace(/^```(?:html)?\s*/i, '')
            .replace(/\s*```$/, '');
    }
    return content.trim();
}

function imageContentFromPaths(imagePaths, detail = config.visionDetail) {
    return imagePaths.map(imagePath => {
        const mimeType = path.extname(imagePath).toLowerCase() === '.jpg'
            ? 'image/jpeg'
            : 'image/png';
        const base64 = fs.readFileSync(imagePath).toString('base64');
        return {
            type: 'image_url',
            image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail
            }
        };
    });
}

module.exports = {
    client,
    sanitizeHtml,
    imageContentFromPaths
};
