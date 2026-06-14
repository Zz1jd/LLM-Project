const OpenAI = require('openai');
require('dotenv').config();
const logger = require('./logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.chatanywhere.tech/v1', 
});

/**
 * 核心修复函数
 * @param {string} htmlCode - 包含 Bug 的原始 HTML 代码字符串
 * @param {string} report - evaluator.js 生成的压缩版结构化错误报告
 * @returns {string} - 修复后的 HTML 代码字符串
 */
async function repairCode(htmlCode, report, context = {}) {
    logger.info('REPAIR_START', { ...context, reportChars: report ? report.length : 0, inputChars: htmlCode ? htmlCode.length : 0 });
    
    // 构造结构化 Prompt，强制分离 A11y 和 Security 的修复要求
    const prompt = `You are an expert secure frontend developer.
Below is an HTML file that contains Accessibility (A11y) and Security (DOM-XSS) errors.

### The Original Code:
\`\`\`html
${htmlCode}
\`\`\`

### The Automated Evaluation Report:
${report}

### Your Task:
1. Fix ALL the errors listed in the evaluation report.
2. For Security errors: NEVER use \`innerHTML\` or \`insertAdjacentHTML\`. Use safe alternatives like \`textContent\`, \`innerText\`, or \`createElement\`.
3. For Accessibility errors: Add missing ARIA labels, alt texts, or fix contrast issues as required.
4. Return ONLY the complete, fixed HTML code. Do not include any explanations or markdown wrappers.`;

    try {
        const response = await openai.chat.completions.create({
            //model: "gpt-4o",
            //model: "deepseek-v3.2",
            model: "gemini-2.5-pro",
            messages: [
                { role: "system", content: "You are an automated code repair bot. Output pure code only." },
                { role: "user", content: prompt } // 修复了之前的变量名错误
            ],
            temperature: 0.1, // 保持 0.1，修复代码不需要创造力，需要严谨
        });

        let repairedCode = response.choices[0].message.content.trim();
        
        // 清理 markdown 代码块符号
        if (repairedCode.startsWith('```')) {
            repairedCode = repairedCode.replace(/^```(html)?\n?/, '').replace(/\n?```$/, '');
        }

        // 直接返回修好的字符串，让 main.js 去负责写文件和接下来的多轮迭代
        logger.info('REPAIR_COMPLETE', { ...context, outputChars: repairedCode.length });
        return repairedCode;

    } catch (error) {
        logger.error('REPAIR_FAILED', { ...context }, error);
        return htmlCode; // 降级处理：如果 API 失败，原样返回防止流程崩溃
    }
}

// 移除了底部的本地单独测试运行区域，因为现在由 main.js 统一管理控制流
module.exports = { repairCode };
