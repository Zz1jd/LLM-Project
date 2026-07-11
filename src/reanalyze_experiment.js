const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config');
const { evaluateCode } = require('./evaluator');

function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function phaseFiles(branchDir) {
    const files = [{
        phase: 'initial',
        iteration: 0,
        filePath: path.join(branchDir, 'initial', 'artifact.html')
    }];

    const entries = fs.readdirSync(branchDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && /^iteration-\d+$/.test(entry.name))
        .sort((a, b) => Number(a.name.split('-')[1]) - Number(b.name.split('-')[1]));

    entries.forEach(entry => {
        const iteration = Number(entry.name.split('-')[1]);
        files.push({
            phase: 'repair',
            iteration,
            filePath: path.join(branchDir, entry.name, 'artifact.html')
        });
    });

    return files.filter(item => fs.existsSync(item.filePath));
}

async function evaluateBranch(runDir, task, mode, model) {
    const branchDir = path.join(runDir, task, mode);
    const originalTelemetryPath = path.join(branchDir, 'telemetry.json');
    const originalTelemetry = fs.existsSync(originalTelemetryPath)
        ? JSON.parse(fs.readFileSync(originalTelemetryPath, 'utf8'))
        : null;
    const states = [];

    for (const item of phaseFiles(branchDir)) {
        const evaluation = await evaluateCode(item.filePath, {
            task,
            model,
            mode,
            phase: `reanalyze-${item.phase}`,
            iteration: item.iteration
        });
        states.push({
            phase: item.phase,
            iteration: item.iteration,
            totalErrors: evaluation.errorCount,
            a11yErrors: evaluation.a11yCount,
            securityErrors: evaluation.secCount,
            rawReport: evaluation.rawReportData,
            artifact: item.filePath
        });
    }

    const firstCleanState = states.find(state => state.totalErrors === 0);
    const effectiveFinal = firstCleanState || states[states.length - 1];
    const usageHistory = originalTelemetry
        ? originalTelemetry.repairHistory.slice(0, effectiveFinal.iteration)
        : [];
    const usage = usageHistory.reduce((totals, item) => {
        const current = item.apiUsage || {};
        totals.promptTokens += current.prompt_tokens || 0;
        totals.completionTokens += current.completion_tokens || 0;
        totals.totalTokens += current.total_tokens || 0;
        return totals;
    }, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });

    const corrected = {
        task,
        model,
        mode,
        note: 'Re-evaluated existing artifacts after correcting HTML inline-handler false positives.',
        states,
        effectiveFinal,
        effectiveUsage: usage
    };
    fs.writeFileSync(
        path.join(branchDir, 'telemetry.corrected.json'),
        JSON.stringify(corrected, null, 2)
    );
    return corrected;
}

async function main() {
    const runId = process.env.RUN_ID;
    if (!runId) {
        throw new Error('RUN_ID is required');
    }

    const runDir = path.join(config.projectRoot, 'output', 'experiments', runId);
    const manifestPath = path.join(runDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Experiment manifest not found: ${manifestPath}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const rows = [];

    for (const task of manifest.tasks) {
        for (const mode of manifest.modes) {
            const result = await evaluateBranch(runDir, task, mode, manifest.model);
            const initial = result.states[0];
            const final = result.effectiveFinal;
            rows.push([
                manifest.model,
                task,
                mode,
                initial.totalErrors,
                initial.a11yErrors,
                initial.securityErrors,
                final.totalErrors,
                final.a11yErrors,
                final.securityErrors,
                final.iteration,
                final.totalErrors === 0,
                result.effectiveUsage.promptTokens,
                result.effectiveUsage.completionTokens,
                result.effectiveUsage.totalTokens
            ]);
        }
    }

    const headers = [
        'Model', 'Task', 'Mode',
        'Init_Total', 'Init_A11y', 'Init_Sec',
        'Final_Total', 'Final_A11y', 'Final_Sec',
        'Effective_Iterations', 'Success',
        'Prompt_Tokens', 'Completion_Tokens', 'Total_Tokens'
    ];
    const csv = [
        headers.map(csvCell).join(','),
        ...rows.map(row => row.map(csvCell).join(','))
    ].join('\n') + '\n';
    const outputPath = path.join(runDir, 'pilot_summary_corrected.csv');
    fs.writeFileSync(outputPath, csv);
    console.log(`CORRECTED_SUMMARY=${outputPath}`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
