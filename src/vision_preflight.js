const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config');
const { client, imageContentFromPaths } = require('./model_client');
const { captureScreenshots, closeBrowser } = require('./browser_renderer');

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required');
    }

    const tempDir = path.join(config.projectRoot, 'output', 'vision-preflight');
    fs.mkdirSync(tempDir, { recursive: true });
    const htmlPath = path.join(tempDir, 'preflight.html');
    fs.writeFileSync(htmlPath, `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Vision preflight</title></head>
<body style="font-family: sans-serif"><h1>VISION_PREFLIGHT_OK</h1></body>
</html>`);

    const screenshots = await captureScreenshots(
        htmlPath,
        path.join(tempDir, 'screenshots'),
        'vision-preflight'
    );
    const content = [
        {
            type: 'text',
            text: 'Read the large heading in this screenshot. Reply with exactly VISION_PREFLIGHT_OK.'
        },
        ...imageContentFromPaths([screenshots[0].path], 'low')
    ];
    const response = await client.chat.completions.create({
        model: config.targetModel,
        messages: [{ role: 'user', content }],
        temperature: 0
    });
    const answer = response.choices[0].message.content.trim();
    console.log(`VISION_PREFLIGHT_RESPONSE=${answer}`);
    if (answer !== 'VISION_PREFLIGHT_OK') {
        throw new Error(`Unexpected vision response: ${answer}`);
    }
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => closeBrowser());
