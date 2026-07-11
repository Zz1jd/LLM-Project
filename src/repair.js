require('dotenv').config();
const logger = require('./logger');
const config = require('./config');
const {
    client,
    sanitizeHtml,
    imageContentFromPaths
} = require('./model_client');

/**
 * Repair a generated frontend artifact using the compact evaluator report.
 * Multimodal branches additionally include browser screenshots.
 */
async function repairCodeDetailed(htmlCode, report, context = {}) {
    const model = context.model || config.targetModel;
    const mode = context.mode || 'text-only';
    const screenshotPaths = context.screenshotPaths || [];
    logger.info('REPAIR_START', {
        ...context,
        model,
        mode,
        screenshotCount: screenshotPaths.length,
        reportChars: report ? report.length : 0,
        inputChars: htmlCode ? htmlCode.length : 0
    });
    
    const prompt = `You are an expert secure frontend developer.
Below is an HTML file that contains Accessibility (A11y) and Security (DOM-XSS) errors.

### The Original Code:
\`\`\`html
${htmlCode}
\`\`\`

### The Automated Evaluation Report:
${report}

### Visual Evidence:
${mode === 'multimodal'
        ? 'The attached screenshots show the actual rendered page at desktop/mobile sizes and, when available, after a representative user interaction.'
        : 'No screenshots are provided in this text-only control group.'}

### Your Task:
1. Fix ALL the errors listed in the evaluation report.
2. For Security errors: NEVER use \`innerHTML\` or \`insertAdjacentHTML\`. Use safe alternatives like \`textContent\`, \`innerText\`, or \`createElement\`.
3. For Accessibility errors: Add missing ARIA labels, alt texts, or fix contrast issues as required.
4. When screenshots are attached, inspect them for overlap, clipping, overflow, poor alignment, unreadable contrast, hidden controls, and broken responsive layout.
5. Preserve already-correct functionality and do not introduce new inline event handlers or unsafe DOM sinks.
6. Make the smallest coherent repair that resolves both the tool findings and visible defects.
7. Return ONLY the complete, fixed HTML code. Do not include any explanations or markdown wrappers.`;

    try {
        const userContent = mode === 'multimodal'
            ? [
                { type: 'text', text: prompt },
                ...imageContentFromPaths(screenshotPaths)
            ]
            : prompt;

        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: "You are a frontend code repair engine. Output pure code only." },
                { role: "user", content: userContent }
            ],
            temperature: 0.1,
        });

        const repairedCode = sanitizeHtml(response.choices[0].message.content);

        logger.info('REPAIR_COMPLETE', {
            ...context,
            model,
            mode,
            outputChars: repairedCode.length,
            totalTokens: response.usage ? response.usage.total_tokens : undefined
        });
        return {
            code: repairedCode,
            model,
            mode,
            usage: response.usage || null
        };

    } catch (error) {
        logger.error('REPAIR_FAILED', { ...context, model, mode }, error);
        throw error;
    }
}

async function repairCode(htmlCode, report, context = {}) {
    try {
        const result = await repairCodeDetailed(htmlCode, report, context);
        return result.code;
    } catch (error) {
        return htmlCode;
    }
}

module.exports = { repairCode, repairCodeDetailed };
