const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config');
const logger = require('./logger');
const { generateCodeDetailed } = require('./generator');
const { evaluateCode } = require('./evaluator');
const { repairCodeDetailed } = require('./repair');
const { captureScreenshots, closeBrowser } = require('./browser_renderer');
const {
    createAgentState,
    recordObservation,
    decideNextAction
} = require('./agent_state');

function timestampId() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
    fs.renameSync(tempPath, filePath);
}

function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function usageTotals(usages) {
    return usages.reduce((totals, usage) => {
        if (!usage) return totals;
        totals.promptTokens += usage.prompt_tokens || 0;
        totals.completionTokens += usage.completion_tokens || 0;
        totals.totalTokens += usage.total_tokens || 0;
        return totals;
    }, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
}

function summaryRowFromBranch(branch) {
    return {
        model: branch.model,
        task: branch.task,
        mode: branch.mode,
        initTotal: branch.initialState.totalErrors,
        initA11y: branch.initialState.a11yErrors,
        initSec: branch.initialState.secErrors,
        finalTotal: branch.finalState.remainingErrors,
        finalA11y: branch.finalState.remainingA11yErrors,
        finalSec: branch.finalState.remainingSecurityErrors,
        iterations: branch.finalState.iterationsUsed,
        success: branch.finalState.success,
        terminationStatus: branch.finalState.terminationStatus,
        terminationReason: branch.finalState.terminationReason,
        promptTokens: branch.finalState.apiUsage.promptTokens,
        completionTokens: branch.finalState.apiUsage.completionTokens,
        totalTokens: branch.finalState.apiUsage.totalTokens
    };
}

function writeSummary(runDir, summaryRows, fileName) {
    const headers = [
        'Model', 'Task', 'Mode',
        'Init_Total', 'Init_A11y', 'Init_Sec',
        'Final_Total', 'Final_A11y', 'Final_Sec',
        'Iterations', 'Success', 'Termination_Status', 'Termination_Reason',
        'Prompt_Tokens', 'Completion_Tokens', 'Total_Tokens'
    ];
    const csvRows = summaryRows.map(row => [
        row.model, row.task, row.mode,
        row.initTotal, row.initA11y, row.initSec,
        row.finalTotal, row.finalA11y, row.finalSec,
        row.iterations, row.success, row.terminationStatus, row.terminationReason,
        row.promptTokens, row.completionTokens, row.totalTokens
    ]);
    const csv = [
        headers.map(csvCell).join(','),
        ...csvRows.map(row => row.map(csvCell).join(','))
    ].join('\n') + '\n';
    const outputPath = path.join(runDir, fileName);
    const tempPath = `${outputPath}.tmp`;
    fs.writeFileSync(tempPath, csv);
    fs.renameSync(tempPath, outputPath);
}

async function evaluateAndCapture({
    filePath,
    phaseDir,
    task,
    model,
    mode,
    phase,
    iteration
}) {
    const evaluation = await evaluateCode(filePath, {
        task,
        model,
        mode,
        phase,
        iteration
    });
    if (!evaluation) {
        throw new Error(`Evaluation failed for ${task} (${mode}, ${phase})`);
    }
    const screenshots = await captureScreenshots(
        filePath,
        path.join(phaseDir, 'screenshots'),
        task,
        { model, mode, phase, iteration }
    );
    return { evaluation, screenshots };
}

async function runBranch({
    task,
    model,
    mode,
    initialCode,
    branchDir,
    maxIterations
}) {
    ensureDir(branchDir);
    const telemetryPath = path.join(branchDir, 'telemetry.json');
    if (fs.existsSync(telemetryPath)) {
        const existing = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
        if (existing.status === 'complete' && existing.finalState) {
            logger.info('PILOT_BRANCH_REUSED', { task, model, mode });
            return existing;
        }
    }
    const usages = [];
    const agentState = createAgentState({
        task,
        model,
        mode,
        maxIterations
    });
    const logData = {
        status: 'running',
        task,
        model,
        mode,
        agentDesign: {
            loop: 'plan-act-observe-reflect',
            shortcutPaths: [
                'resolved',
                'max_iterations',
                'plateau'
            ],
            contextPolicy: 'Only the current artifact, compact evaluation report, and current screenshots are sent to the repair model.'
        },
        contextManagement: {
            sentToRepair: mode === 'multimodal'
                ? ['current artifact', 'compact evaluation report', 'current browser screenshots']
                : ['current artifact', 'compact evaluation report'],
            historyPolicy: 'Full repair history is persisted in telemetry but not resent to the model.',
            tokenControl: 'Accessibility findings are grouped by rule, affected selectors are truncated, and only the latest artifact is used as repair context.',
            stateMemory: ['observations', 'decisions', 'bestArtifact', 'bestErrorCount', 'noImprovementStreak'],
            stagnationRule: 'Stop after two consecutive repair attempts fail to reduce the issue count.'
        },
        visionReviewPolicy: mode === 'multimodal' ? 'at-least-one-pass' : 'not-applicable',
        maxIterationsAllowed: maxIterations,
        initialState: {},
        agentState,
        repairHistory: [],
        finalState: {}
    };

    let currentCode = initialCode;
    let currentPhaseDir = path.join(branchDir, 'initial');
    ensureDir(currentPhaseDir);
    let currentFilePath = path.join(currentPhaseDir, 'artifact.html');
    fs.writeFileSync(currentFilePath, currentCode);

    let state = await evaluateAndCapture({
        filePath: currentFilePath,
        phaseDir: currentPhaseDir,
        task,
        model,
        mode,
        phase: 'initial'
    });

    logData.initialState = {
        totalErrors: state.evaluation.errorCount,
        a11yErrors: state.evaluation.a11yCount,
        secErrors: state.evaluation.secCount,
        rawReport: state.evaluation.rawReportData,
        screenshots: state.screenshots
    };
    recordObservation(agentState, {
        phase: 'initial',
        iteration: 0,
        evaluation: state.evaluation,
        artifact: currentFilePath,
        screenshots: state.screenshots
    });
    writeJson(telemetryPath, logData);

    let iteration = 1;
    let visionReviewPending = mode === 'multimodal';
    while (true) {
        const decision = decideNextAction(agentState, {
            nextIteration: iteration,
            maxIterations,
            visionReviewPending
        });
        logData.agentState = agentState;
        writeJson(telemetryPath, logData);

        if (decision.action === 'terminate') {
            break;
        }

        const repairResult = await repairCodeDetailed(
            currentCode,
            state.evaluation.report,
            {
                task,
                model,
                mode,
                iteration,
                screenshotPaths: mode === 'multimodal'
                    ? state.screenshots.map(item => item.path)
                    : []
            }
        );
        currentCode = repairResult.code;
        usages.push(repairResult.usage);

        currentPhaseDir = path.join(branchDir, `iteration-${iteration}`);
        ensureDir(currentPhaseDir);
        currentFilePath = path.join(currentPhaseDir, 'artifact.html');
        fs.writeFileSync(currentFilePath, currentCode);

        state = await evaluateAndCapture({
            filePath: currentFilePath,
            phaseDir: currentPhaseDir,
            task,
            model,
            mode,
            phase: 'repair',
            iteration
        });
        recordObservation(agentState, {
            phase: 'repair',
            iteration,
            evaluation: state.evaluation,
            artifact: currentFilePath,
            screenshots: state.screenshots
        });

        logData.repairHistory.push({
            iteration,
            decision,
            totalErrors: state.evaluation.errorCount,
            a11yErrors: state.evaluation.a11yCount,
            secErrors: state.evaluation.secCount,
            rawReport: state.evaluation.rawReportData,
            screenshots: state.screenshots,
            apiUsage: repairResult.usage
        });
        visionReviewPending = false;
        logData.agentState = agentState;
        writeJson(telemetryPath, logData);

        iteration += 1;
    }

    logData.finalState = {
        success: state.evaluation.errorCount === 0,
        iterationsUsed: iteration - 1,
        remainingErrors: state.evaluation.errorCount,
        remainingA11yErrors: state.evaluation.a11yCount,
        remainingSecurityErrors: state.evaluation.secCount,
        terminationStatus: agentState.status,
        terminationReason: agentState.terminationReason,
        bestArtifact: agentState.bestArtifact,
        bestErrorCount: agentState.bestErrorCount,
        apiUsage: usageTotals(usages),
        finalArtifact: currentFilePath,
        finalScreenshots: state.screenshots
    };
    logData.status = 'complete';

    writeJson(telemetryPath, logData);
    return logData;
}

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required');
    }

    const runId = process.env.RUN_ID || `pilot-vision-${timestampId()}`;
    const runDir = path.join(config.projectRoot, 'output', 'experiments', runId);
    ensureDir(runDir);

    const manifestPath = path.join(runDir, 'manifest.json');
    const requestedManifest = {
        runId,
        createdAt: new Date().toISOString(),
        model: config.targetModel,
        tasks: config.pilotTasks,
        modes: config.pilotModes,
        maxIterations: config.maxIterations,
        visionDetail: config.visionDetail,
        visionReviewPolicy: 'Multimodal branches execute at least one screenshot review, even when tool errors are zero.',
        design: 'Shared initial artifact; text-only and multimodal repair branches.'
    };
    if (fs.existsSync(manifestPath)) {
        const existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const comparableKeys = ['model', 'tasks', 'modes', 'maxIterations', 'visionDetail'];
        for (const key of comparableKeys) {
            if (JSON.stringify(existingManifest[key]) !== JSON.stringify(requestedManifest[key])) {
                throw new Error(`Run ${runId} cannot resume because manifest field ${key} differs`);
            }
        }
        if (!existingManifest.visionReviewPolicy) {
            writeJson(manifestPath, {
                ...existingManifest,
                visionReviewPolicy: requestedManifest.visionReviewPolicy
            });
        }
    } else {
        writeJson(manifestPath, requestedManifest);
    }

    const summaryRows = [];
    try {
        for (const task of config.pilotTasks) {
            const promptPath = path.join(config.projectRoot, 'prompts', `${task}.txt`);
            if (!fs.existsSync(promptPath)) {
                throw new Error(`Prompt not found: ${promptPath}`);
            }
            const prompt = fs.readFileSync(promptPath, 'utf8');
            const sharedDir = path.join(runDir, task, 'shared');
            ensureDir(sharedDir);
            const sharedArtifactPath = path.join(sharedDir, 'initial-artifact.html');
            let initialCode;
            if (fs.existsSync(sharedArtifactPath)) {
                initialCode = fs.readFileSync(sharedArtifactPath, 'utf8');
                logger.info('PILOT_GENERATION_REUSED', { task, model: config.targetModel });
            } else {
                const generation = await generateCodeDetailed(prompt, {
                    task,
                    model: config.targetModel,
                    experiment: runId
                });
                if (!generation || !generation.code) {
                    throw new Error(`Initial generation failed for ${task}`);
                }
                initialCode = generation.code;
                fs.writeFileSync(sharedArtifactPath, initialCode);
                writeJson(path.join(sharedDir, 'generation.json'), {
                    model: generation.model,
                    usage: generation.usage
                });
            }

            for (const mode of config.pilotModes) {
                if (!['text-only', 'multimodal'].includes(mode)) {
                    throw new Error(`Unsupported pilot mode: ${mode}`);
                }
                const branch = await runBranch({
                    task,
                    model: config.targetModel,
                    mode,
                    initialCode,
                    branchDir: path.join(runDir, task, mode),
                    maxIterations: config.maxIterations
                });

                summaryRows.push(summaryRowFromBranch(branch));
                writeSummary(runDir, summaryRows, 'pilot_summary.partial.csv');
            }
        }
    } finally {
        await closeBrowser();
    }

    writeSummary(runDir, summaryRows, 'pilot_summary.csv');

    logger.info('PILOT_EXPERIMENT_COMPLETE', {
        runId,
        runDir,
        resultCount: summaryRows.length
    });
    console.log(`PILOT_OUTPUT=${runDir}`);
}

main().catch(async error => {
    logger.error('PILOT_EXPERIMENT_FAILED', {}, error);
    await closeBrowser().catch(() => {});
    process.exitCode = 1;
});
