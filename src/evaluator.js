const pa11y = require('pa11y');
const { ESLint } = require('eslint');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// 升级版评估函数：报告压缩 + 结构化 + 扩展安全扫描
async function evaluateCode(filePath, context = {}) {
    logger.info('EVALUATION_START', { ...context, file: path.basename(filePath) });
    
    if (!fs.existsSync(filePath)) {
        logger.error('EVALUATION_INPUT_MISSING', { ...context, filePath });
        return null;
    }

    let totalErrors = 0;
    let a11yErrorCount = 0;
    let secErrorCount = 0;

    // 结构化存储：方便后续写成 JSON 文件保存 (为论文攒数据)
    const reportData = {
        a11y: [],
        security: []
    };

    // ==========================================
    // 1. Accessibility 扫描 (Pa11y)
    // ==========================================
    logger.info('A11Y_START', { ...context, tool: 'pa11y', standard: 'WCAG2AA' });
    try {
        const fileUrl = `file://${path.resolve(filePath)}`;
        // 建议：改用 WCAG2AA (工业界最通用标准)。AAA标准有时过于苛刻，容易导致错误数居高不下，影响你观察迭代效果。
        const a11yResults = await pa11y(fileUrl, { includeWarnings: false, includeNotices: false, standard: 'WCAG2AA' });
        const a11yErrors = a11yResults.issues.filter(issue => issue.type === 'error');
        
        a11yErrorCount = a11yErrors.length;
        if (a11yErrorCount > 0) {
            // 【核心创新点：压缩与去重逻辑】
            // 如果同一个错误出现在多个元素上，我们将它们合并，极大节省 Token
            const groupedA11y = {};
            a11yErrors.forEach(err => {
                if (!groupedA11y[err.message]) groupedA11y[err.message] = [];
                groupedA11y[err.message].push(err.selector); 
            });

            for (const [msg, selectors] of Object.entries(groupedA11y)) {
                // 最多只列出前3个元素的选择器，避免长篇大论
                const compactSelectors = selectors.slice(0, 3).join(', ') + (selectors.length > 3 ? ` (+${selectors.length - 3} more)` : '');
                reportData.a11y.push(`[Rule] ${msg} | [Affected Elements] ${compactSelectors}`);
            }
            totalErrors += a11yErrorCount;
        }
    } catch (err) {
        logger.warn('A11Y_TOOL_FAILED', { ...context, tool: 'pa11y', message: err.message });
    }

    // ==========================================
    // 2. Security 扫描 (ESLint + 静态正则扩展)
    // ==========================================
    logger.info('SECURITY_START', { ...context, tool: 'eslint+heuristics' });
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
    // 2.1 扫描 <script> 里的不安全 DOM 操作
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let jsCode = '';
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
        jsCode += match[1] + '\n';
    }

    if (jsCode.trim()) {
        try {
            const eslint = new ESLint({
                useEslintrc: false,
                overrideConfig: {
                    plugins: ["no-unsanitized"],
                    rules: {
                        "no-unsanitized/property": "error",
                        "no-unsanitized/method": "error"
                    },
                    parserOptions: { ecmaVersion: 2021, sourceType: "script" },
                    env: { browser: true, es2021: true }
                }
            });

            const secResults = await eslint.lintText(jsCode);
            const secErrors = secResults[0] ? secResults[0].messages.filter(msg => msg.severity === 2) : [];
            
            secErrors.forEach(err => {
                reportData.security.push(`[JS Line ${err.line}] Unsafe DOM manipulation: ${err.message}. Avoid innerHTML/insertAdjacentHTML.`);
                secErrorCount++;
                totalErrors++;
            });
        } catch (err) {
            logger.warn('SECURITY_TOOL_FAILED', { ...context, tool: 'eslint', message: err.message });
        }
    }

    // 2.2 扩展静态分析：扫描 HTML 内联的危险操作 (补齐 ESLint 盲区)
    const dangerousPatterns = [
        { regex: /href\s*=\s*["']javascript:/gi, desc: 'Unsafe javascript: URI in href attribute' },
        { regex: /on\w+\s*=\s*["']/gi, desc: 'Unsafe inline event handler (e.g., onclick=...)' },
        { regex: /document\.write\(/gi, desc: 'Unsafe use of document.write()' }
    ];

    dangerousPatterns.forEach(pattern => {
        const matches = [...htmlContent.matchAll(pattern.regex)];
        if (matches.length > 0) {
            reportData.security.push(`[HTML] Found ${matches.length} instance(s) of: ${pattern.desc}`);
            secErrorCount += matches.length;
            totalErrors += matches.length;
        }
    });

    // ==========================================
    // 3. 构建压缩版 Prompt 报告
    // ==========================================
    let compressedReport = '';
    if (totalErrors === 0) {
        compressedReport = 'Great job! No accessibility or security errors found. The code is clean and safe.';
    } else {
        // 明确分离 A11y 和 Security，让大模型思路清晰
        if (reportData.a11y.length > 0) {
            compressedReport += `### Accessibility (A11y) Errors:\n` + reportData.a11y.map((err, i) => `${i+1}. ${err}`).join('\n') + `\n\n`;
        }
        if (reportData.security.length > 0) {
            compressedReport += `### Security (DOM-XSS) Errors:\n` + reportData.security.map((err, i) => `${i+1}. ${err}`).join('\n') + `\n`;
        }
    }

    logger.info('EVALUATION_COMPLETE', {
        ...context,
        totalIssues: totalErrors,
        a11yIssues: a11yErrorCount,
        securityIssues: secErrorCount
    });

    // 返回多维度数据，方便 main.js 使用和存 JSON
    return {
        errorCount: totalErrors,
        a11yCount: a11yErrorCount,
        secCount: secErrorCount,
        report: compressedReport,   // 这个是要喂给大模型的“压缩版提示词”
        rawReportData: reportData   // 这个是准备写入 JSON 文件的“学术数据”
    };
}

module.exports = { evaluateCode };
