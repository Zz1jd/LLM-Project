function extractHtmlStartTags(htmlContent) {
    const withoutComments = htmlContent.replace(/<!--[\s\S]*?-->/g, '');
    const withoutRawText = withoutComments
        .replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1\s*>/gi, '<$1$2>');

    return withoutRawText.match(/<[a-z][^<>]*>/gi) || [];
}

function scanHtmlHeuristics(htmlContent, jsCode = '') {
    const startTags = extractHtmlStartTags(htmlContent);
    const joinedTags = startTags.join('\n');
    const findings = [];

    const attributePatterns = [
        {
            regex: /\shref\s*=\s*["']\s*javascript:/gi,
            desc: 'Unsafe javascript: URI in href attribute'
        },
        {
            regex: /\son[a-z][\w:-]*\s*=\s*["']/gi,
            desc: 'Unsafe inline event handler (e.g., onclick=...)'
        }
    ];

    attributePatterns.forEach(pattern => {
        const matches = [...joinedTags.matchAll(pattern.regex)];
        if (matches.length > 0) {
            findings.push({ count: matches.length, desc: pattern.desc });
        }
    });

    const documentWriteMatches = [...jsCode.matchAll(/\bdocument\.write\s*\(/gi)];
    if (documentWriteMatches.length > 0) {
        findings.push({
            count: documentWriteMatches.length,
            desc: 'Unsafe use of document.write()'
        });
    }

    return findings;
}

module.exports = {
    extractHtmlStartTags,
    scanHtmlHeuristics
};
