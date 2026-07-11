const test = require('node:test');
const assert = require('node:assert/strict');

const { scanHtmlHeuristics } = require('../src/evaluator_heuristics');

test('does not treat attribute suffixes or JavaScript variable names as event handlers', () => {
    const html = `<!doctype html>
<html>
<head><meta name="viewport" content="width=device-width"></head>
<body>
<script>
const confirmation = 'Complete';
const validationMessage = "Valid";
</script>
</body>
</html>`;

    assert.deepEqual(scanHtmlHeuristics(
        html,
        `const confirmation = 'Complete'; const validationMessage = "Valid";`
    ), []);
});

test('detects actual inline event handlers and javascript URIs', () => {
    const html = `
<button onclick="submitForm()">Submit</button>
<a href="javascript:alert('x')">Open</a>`;

    assert.deepEqual(scanHtmlHeuristics(html), [
        {
            count: 1,
            desc: 'Unsafe javascript: URI in href attribute'
        },
        {
            count: 1,
            desc: 'Unsafe inline event handler (e.g., onclick=...)'
        }
    ]);
});

test('detects document.write only in extracted JavaScript', () => {
    const html = '<p>Example text: document.write("not executed")</p>';
    const jsCode = 'document.write(userInput);';

    assert.deepEqual(scanHtmlHeuristics(html, jsCode), [
        {
            count: 1,
            desc: 'Unsafe use of document.write()'
        }
    ]);
});
