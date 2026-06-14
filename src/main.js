const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { generateCode } = require('./generator');
const { evaluateCode } = require('./evaluator');
const { repairCode } = require('./repair');

// 🚀 核心控制变量：最大修复轮次
const MAX_ITERATIONS = 3; 

async function runPipeline(taskName) {
    logger.info('PIPELINE_START', { task: taskName, maxIterations: MAX_ITERATIONS });

    // 1. 读取 Prompt
    const promptPath = path.join(__dirname, `../prompts/${taskName}.txt`);
    if (!fs.existsSync(promptPath)) {
        logger.error('PROMPT_FILE_MISSING', { task: taskName, promptPath });
        return;
    }
    const prompt = fs.readFileSync(promptPath, 'utf8');

    // 📊 初始化实验数据对象 (用于写论文)
    const logData = {
        task: taskName,
        maxIterationsAllowed: MAX_ITERATIONS,
        initialState: {},
        repairHistory: [],
        finalState: {}
    };

    // 2. 生成初始代码
    let currentHtml = await generateCode(prompt, { task: taskName });
    if (!currentHtml) return;

    const initialFilePath = path.join(__dirname, `../output/initial/${taskName}.html`);
    fs.writeFileSync(initialFilePath, currentHtml);

    // 3. 初始评估
    let currentEval = await evaluateCode(initialFilePath, { task: taskName, phase: 'initial' });
    
    // 记录初始状态数据
    logData.initialState = {
        totalErrors: currentEval.errorCount,
        a11yErrors: currentEval.a11yCount,
        secErrors: currentEval.secCount,
        rawReport: currentEval.rawReportData
    };

    // 4. 🔄 多轮迭代修复 (While Loop)
    let iteration = 1;
    let currentFilePath = initialFilePath;

    logger.info('REPAIR_LOOP_START', { task: taskName, maxIterations: MAX_ITERATIONS, initialTotalIssues: currentEval.errorCount });
    
    while (currentEval.errorCount > 0 && iteration <= MAX_ITERATIONS) {
        logger.info('ITERATION_START', { task: taskName, iteration, inputTotalIssues: currentEval.errorCount });
        
        // 呼叫大模型进行修复
        currentHtml = await repairCode(currentHtml, currentEval.report, { task: taskName, iteration });
        
        // 保存本轮修复后的代码
        currentFilePath = path.join(__dirname, `../output/repaired/${taskName}_fixed.html`);
        fs.writeFileSync(currentFilePath, currentHtml);

        // 重新评估修改后的代码
        currentEval = await evaluateCode(currentFilePath, { task: taskName, phase: 'repair', iteration });

        // 记录本轮修复的历史数据
        logData.repairHistory.push({
            iteration: iteration,
            totalErrors: currentEval.errorCount,
            a11yErrors: currentEval.a11yCount,
            secErrors: currentEval.secCount,
            rawReport: currentEval.rawReportData
        });

        if (currentEval.errorCount === 0) {
            logger.info('ITERATION_COMPLETE', { task: taskName, iteration, totalIssues: 0, status: 'resolved' });
            break; // 错误清零，提前跳出循环
        } else {
            logger.info('ITERATION_COMPLETE', { task: taskName, iteration, totalIssues: currentEval.errorCount, status: 'remaining' });
        }

        iteration++;
    }

    // 5. 记录最终状态并保存 JSON 日志
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

// --- 本地批量运行触发器 ---
if (require.main === module) {
    // 确保所有输出文件夹存在 (新增了 logs 文件夹)
    const dirs = ['../output', '../output/initial', '../output/repaired', '../output/logs'];
    dirs.forEach(d => {
        const dirPath = path.join(__dirname, d);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    });

    // 暂定先跑前 4 个任务进行快速验证，验证成功后你随时可以换成 20 个
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
