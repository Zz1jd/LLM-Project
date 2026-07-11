require('dotenv').config();
const logger = require('./logger');
const config = require('./config');
const { client, sanitizeHtml } = require('./model_client');

/**
 * Generate the initial frontend artifact from a benchmark prompt.
 * @param {string} userPrompt - Benchmark task prompt.
 * @returns {Promise<{code: string, model: string, usage: object|null}|null>}
 */
async function generateCodeDetailed(userPrompt, context = {}) {
    const model = context.model || config.targetModel;
    logger.info('GENERATION_START', { ...context, model });
    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                {
                    role: "system",
                    content: "You are an expert frontend developer. Output ONLY raw HTML code containing embedded CSS and JS. Do not use markdown code blocks (like ```html). Start directly with <!DOCTYPE html>."
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            temperature: 0.2,
        });

        const generatedCode = sanitizeHtml(response.choices[0].message.content);

        logger.info('GENERATION_COMPLETE', {
            ...context,
            model,
            outputChars: generatedCode.length,
            totalTokens: response.usage ? response.usage.total_tokens : undefined
        });
        return {
            code: generatedCode,
            model,
            usage: response.usage || null
        };
        
    } catch (error) {
        logger.error('GENERATION_FAILED', { ...context, model }, error);
        return null;
    }
}

async function generateCode(userPrompt, context = {}) {
    const result = await generateCodeDetailed(userPrompt, context);
    return result ? result.code : null;
}

module.exports = { generateCode, generateCodeDetailed };
