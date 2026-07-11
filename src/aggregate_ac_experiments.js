const fs = require('fs');
const path = require('path');

const config = require('./config');

function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function taskNumber(task) {
    const match = /^task(\d+)_/.exec(task);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function usageTotals(usage) {
    return {
        promptTokens: usage.promptTokens || usage.prompt_tokens || 0,
        completionTokens: usage.completionTokens || usage.completion_tokens || 0,
        totalTokens: usage.totalTokens || usage.total_tokens || 0
    };
}

function readBranch(runDir, task, mode) {
    const branchDir = path.join(runDir, task, mode);
    const correctedPath = path.join(branchDir, 'telemetry.corrected.json');
    if (fs.existsSync(correctedPath)) {
        const data = JSON.parse(fs.readFileSync(correctedPath, 'utf8'));
        const initial = data.states[0];
        const final = data.effectiveFinal;
        return {
            model: data.model,
            task,
            mode,
            initTotal: initial.totalErrors,
            initA11y: initial.a11yErrors,
            initSec: initial.securityErrors,
            finalTotal: final.totalErrors,
            finalA11y: final.a11yErrors,
            finalSec: final.securityErrors,
            iterations: final.iteration,
            success: final.totalErrors === 0,
            terminationStatus: final.totalErrors === 0 ? 'solved' : '',
            terminationReason: final.totalErrors === 0 ? 'resolved' : '',
            ...usageTotals(data.effectiveUsage || {})
        };
    }

    const telemetryPath = path.join(branchDir, 'telemetry.json');
    const data = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
    return {
        model: data.model,
        task,
        mode,
        initTotal: data.initialState.totalErrors,
        initA11y: data.initialState.a11yErrors,
        initSec: data.initialState.secErrors,
        finalTotal: data.finalState.remainingErrors,
        finalA11y: data.finalState.remainingA11yErrors,
        finalSec: data.finalState.remainingSecurityErrors,
        iterations: data.finalState.iterationsUsed,
        success: data.finalState.success,
        terminationStatus: data.finalState.terminationStatus || '',
        terminationReason: data.finalState.terminationReason || '',
        ...usageTotals(data.finalState.apiUsage || {})
    };
}

function generationUsage(runDir) {
    const totals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (const task of fs.readdirSync(runDir)) {
        const usagePath = path.join(runDir, task, 'shared', 'generation.json');
        if (!fs.existsSync(usagePath)) continue;
        const data = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
        const usage = usageTotals(data.usage || {});
        totals.promptTokens += usage.promptTokens;
        totals.completionTokens += usage.completionTokens;
        totals.totalTokens += usage.totalTokens;
    }
    return totals;
}

function main() {
    const runIds = (process.env.RUN_IDS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    if (runIds.length === 0) {
        throw new Error('RUN_IDS is required');
    }

    const outputId = process.env.OUTPUT_ID || 'combined-ac-experiment';
    const experimentRoot = path.join(config.projectRoot, 'output', 'experiments');
    const outputDir = path.join(experimentRoot, outputId);
    fs.mkdirSync(outputDir, { recursive: true });

    const rows = [];
    const generation = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (const runId of runIds) {
        const runDir = path.join(experimentRoot, runId);
        const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
        for (const task of manifest.tasks) {
            for (const mode of manifest.modes) {
                rows.push(readBranch(runDir, task, mode));
            }
        }
        const currentGeneration = generationUsage(runDir);
        generation.promptTokens += currentGeneration.promptTokens;
        generation.completionTokens += currentGeneration.completionTokens;
        generation.totalTokens += currentGeneration.totalTokens;
    }

    rows.sort((a, b) => taskNumber(a.task) - taskNumber(b.task) || a.mode.localeCompare(b.mode));
    const headers = [
        'Model', 'Task', 'Mode',
        'Init_Total', 'Init_A11y', 'Init_Sec',
        'Final_Total', 'Final_A11y', 'Final_Sec',
        'Iterations', 'Success', 'Termination_Status', 'Termination_Reason',
        'Prompt_Tokens', 'Completion_Tokens', 'Total_Tokens'
    ];
    const csvRows = rows.map(row => [
        row.model, row.task, row.mode,
        row.initTotal, row.initA11y, row.initSec,
        row.finalTotal, row.finalA11y, row.finalSec,
        row.iterations, row.success, row.terminationStatus, row.terminationReason,
        row.promptTokens, row.completionTokens, row.totalTokens
    ]);
    fs.writeFileSync(
        path.join(outputDir, 'combined_summary.csv'),
        [headers, ...csvRows].map(row => row.map(csvCell).join(',')).join('\n') + '\n'
    );

    const byMode = {};
    for (const mode of ['text-only', 'multimodal']) {
        const selected = rows.filter(row => row.mode === mode);
        byMode[mode] = selected.reduce((totals, row) => {
            totals.branches += 1;
            totals.successes += row.success ? 1 : 0;
            totals.initTotal += row.initTotal;
            totals.initA11y += row.initA11y;
            totals.initSec += row.initSec;
            totals.finalTotal += row.finalTotal;
            totals.iterations += row.iterations;
            totals.promptTokens += row.promptTokens;
            totals.completionTokens += row.completionTokens;
            totals.totalTokens += row.totalTokens;
            return totals;
        }, {
            branches: 0,
            successes: 0,
            initTotal: 0,
            initA11y: 0,
            initSec: 0,
            finalTotal: 0,
            iterations: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
        });
    }

    fs.writeFileSync(
        path.join(outputDir, 'aggregate_metrics.json'),
        JSON.stringify({ runIds, generation, byMode }, null, 2)
    );
    console.log(`COMBINED_OUTPUT=${outputDir}`);
}

try {
    main();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
