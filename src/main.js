const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { generateCode } = require('./generator');
const { evaluateCode } = require('./evaluator');
const { repairCode } = require('./repair');

const MAX_ITERATIONS = 3; 

async function runPipeline(taskName) {
    logger.info('PIPELINE_START', { task: taskName, maxIterations: MAX_ITERATIONS });

    const promptPath = path.join(__dirname, `../prompts/${taskName}.txt`);
    if (!fs.existsSync(promptPath)) {
        logger.error('PROMPT_FILE_MISSING', { task: taskName, promptPath });
        return;
    }
    const prompt = fs.readFileSync(promptPath, 'utf8');

    const logData = {
        task: taskName,
        maxIterationsAllowed: MAX_ITERATIONS,
        initialState: {},
        repairHistory: [],
        finalState: {}
    };

    let currentHtml = await generateCode(prompt, { task: taskName });
    if (!currentHtml) return;

    const initialFilePath = path.join(__dirname, `../output/initial/${taskName}.html`);
    fs.writeFileSync(initialFilePath, currentHtml);

    let currentEval = await evaluateCode(initialFilePath, { task: taskName, phase: 'initial' });
    
    logData.initialState = {
        totalErrors: currentEval.errorCount,
        a11yErrors: currentEval.a11yCount,
        secErrors: currentEval.secCount,
        rawReport: currentEval.rawReportData
    };

    let iteration = 1;
    let currentFilePath = initialFilePath;

    logger.info('REPAIR_LOOP_START', { task: taskName, maxIterations: MAX_ITERATIONS, initialTotalIssues: currentEval.errorCount });
    
    while (currentEval.errorCount > 0 && iteration <= MAX_ITERATIONS) {
        logger.info('ITERATION_START', { task: taskName, iteration, inputTotalIssues: currentEval.errorCount });
        
        currentHtml = await repairCode(currentHtml, currentEval.report, { task: taskName, iteration });
        
        currentFilePath = path.join(__dirname, `../output/repaired/${taskName}_fixed.html`);
        fs.writeFileSync(currentFilePath, currentHtml);

        currentEval = await evaluateCode(currentFilePath, { task: taskName, phase: 'repair', iteration });

        logData.repairHistory.push({
            iteration: iteration,
            totalErrors: currentEval.errorCount,
            a11yErrors: currentEval.a11yCount,
            secErrors: currentEval.secCount,
            rawReport: currentEval.rawReportData
        });

        if (currentEval.errorCount === 0) {
            logger.info('ITERATION_COMPLETE', { task: taskName, iteration, totalIssues: 0, status: 'resolved' });
            break;
        } else {
            logger.info('ITERATION_COMPLETE', { task: taskName, iteration, totalIssues: currentEval.errorCount, status: 'remaining' });
        }

        iteration++;
    }

    const actualIterations = iteration > MAX_ITERATIONS ? MAX_ITERATIONS : iteration;
    logData.finalState = {
        success: currentEval.errorCount === 0,
        iterationsUsed: currentEval.errorCount === 0 ? actualIterations : MAX_ITERATIONS,
        remainingErrors: currentEval.errorCount
    };

    const logFilePath = path.join(__dirname, `../output/logs/${taskName}_log.json`);
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
    logger.info('PIPELINE_LOG_WRITTEN', { task: taskName, logPath: `output/logs/${taskName}_log.json` });
}

if (require.main === module) {
    const dirs = ['../output', '../output/initial', '../output/repaired', '../output/logs'];
    dirs.forEach(d => {
        const dirPath = path.join(__dirname, d);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    });

    const benchmarkTasks = [
        //'task1_login'
// 'task2_shopping_cart', 'task3_chat_ui', 'task4_dashboard',
//         'task5_modal', 'task6_carousel', 'task7_dropdown_nav', 'task8_video_player',
//         'task9_autocomplete', 'task10_progress_bar', 'task11_tabs', 'task12_accordion',
//         'task13_todo_list', 'task14_star_rating', 'task15_cookie_banner', 'task16_profile_card',
//         'task17_calendar', 'task18_toast_notification', 'task19_pricing_table', 'task20_comments',
        'task21_custom_modal', 'task22_autocomplete_search', 'task23_data_table', 
        'task24_file_upload_preview', 'task25_accordion_faq', 'task26_multi_step_form', 
        'task27_image_carousel', 'task28_interactive_tooltip', 'task29_user_comments', 
        'task30_video_player_controls'
    ];

    (async () => {
        logger.info('BENCHMARK_START', { taskCount: benchmarkTasks.length, tasks: benchmarkTasks });
        
        for (const task of benchmarkTasks) {
            await runPipeline(task);
            logger.info('BENCHMARK_COOLDOWN', { cooldownMs: 3000 });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        logger.info('BENCHMARK_COMPLETE', { taskCount: benchmarkTasks.length, artifactsDir: 'output/logs' });
    })();
}
