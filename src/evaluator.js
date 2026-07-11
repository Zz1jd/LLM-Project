const pa11y = require('pa11y');
const { ESLint } = require('eslint');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const {
    extractHtmlStartTags,
    scanHtmlHeuristics
} = require('./evaluator_heuristics');

async function evaluateCode(filePath, context = {}) {
    logger.info('EVALUATION_START', { ...context, file: path.basename(filePath) });
    
    if (!fs.existsSync(filePath)) {
        logger.error('EVALUATION_INPUT_MISSING', { ...context, filePath });
        return null;
    }

    let totalErrors = 0;
    let a11yErrorCount = 0;
    let secErrorCount = 0;

    const reportData = {
        a11y: [],
        security: []
    };

    // ==========================================
    // 1. Accessibility scan (Pa11y)
    // ==========================================
    logger.info('A11Y_START', { ...context, tool: 'pa11y', standard: 'WCAG2AA' });
    try {
        const fileUrl = `file://${path.resolve(filePath)}`;
        const a11yResults = await pa11y(fileUrl, { includeWarnings: false, includeNotices: false, standard: 'WCAG2AA' });
        const a11yErrors = a11yResults.issues.filter(issue => issue.type === 'error');
        
        a11yErrorCount = a11yErrors.length;
        if (a11yErrorCount > 0) {
            const groupedA11y = {};
            a11yErrors.forEach(err => {
                if (!groupedA11y[err.message]) groupedA11y[err.message] = [];
                groupedA11y[err.message].push(err.selector); 
            });

            for (const [msg, selectors] of Object.entries(groupedA11y)) {
                const compactSelectors = selectors.slice(0, 3).join(', ') + (selectors.length > 3 ? ` (+${selectors.length - 3} more)` : '');
                reportData.a11y.push(`[Rule] ${msg} | [Affected Elements] ${compactSelectors}`);
            }
            totalErrors += a11yErrorCount;
        }
    } catch (err) {
        logger.warn('A11Y_TOOL_FAILED', { ...context, tool: 'pa11y', message: err.message });
    }

    // ==========================================
    // 2. Security scan (ESLint + conservative HTML heuristics)
    // ==========================================
    logger.info('SECURITY_START', { ...context, tool: 'eslint+heuristics' });
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
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

    // Only inspect real HTML start-tag attributes to avoid false positives in
    // metadata strings or JavaScript variable names ending with "on".
    scanHtmlHeuristics(htmlContent, jsCode).forEach(finding => {
        reportData.security.push(`[HTML] Found ${finding.count} instance(s) of: ${finding.desc}`);
        secErrorCount += finding.count;
        totalErrors += finding.count;
    });

    // ==========================================
    // 3. Compact report for the repair prompt
    // ==========================================
    let compressedReport = '';
    if (totalErrors === 0) {
        compressedReport = 'Great job! No accessibility or security errors found. The code is clean and safe.';
    } else {
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

    return {
        errorCount: totalErrors,
        a11yCount: a11yErrorCount,
        secCount: secErrorCount,
        report: compressedReport,
        rawReportData: reportData
    };
}

module.exports = {
    evaluateCode,
    extractHtmlStartTags,
    scanHtmlHeuristics
};
