const OpenAI = require('openai');
require('dotenv').config();
const logger = require('./logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.chatanywhere.tech/v1', 
});

/**
 * 核心生成函数：根据 Prompt 生成初始前端代码
 * @param {string} userPrompt - 用户的原始提示词
 * @returns {string} - 生成的 HTML 代码字符串
 */
async function generateCode(userPrompt, context = {}) {
    logger.info('GENERATION_START', { ...context });
    try {
        const response = await openai.chat.completions.create({
            //model: "gpt-4o", 
            //model: "deepseek-v3.2",
            model: "gemini-2.5-pro",
            messages: [
                {
                    // 强制要求模型只输出纯代码，不加任何废话
                    role: "system",
                    content: "You are an expert frontend developer. Output ONLY raw HTML code containing embedded CSS and JS. Do not use markdown code blocks (like ```html). Start directly with <!DOCTYPE html>."
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            temperature: 0.2, // 低温，保证输出稳定性
        });

        let generatedCode = response.choices[0].message.content.trim();

        // 容错清洗：去掉大模型可能附带的 Markdown 代码块标记
        if (generatedCode.startsWith('```')) {
            generatedCode = generatedCode.replace(/^```(html)?\n?/, '').replace(/\n?```$/, '');
        }

        // 直接返回代码字符串，让 main.js 去负责存文件
        logger.info('GENERATION_COMPLETE', { ...context, outputChars: generatedCode.length });
        return generatedCode;
        
    } catch (error) {
        logger.error('GENERATION_FAILED', { ...context }, error);
        return null; // 失败时返回 null 防止后续流程崩溃
    }
}

// 导出函数，名称必须和 main.js 里面 require 的一致！
module.exports = { generateCode };
