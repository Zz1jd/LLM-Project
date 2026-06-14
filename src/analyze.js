const fs = require('fs');
const path = require('path');

// 设定基准目录：指向根目录下的 output 文件夹
const outputDir = path.join(__dirname, '..', 'output');
// 汇总表格的保存路径
const summaryFile = path.join(outputDir, 'benchmark_summary.csv');

// 定义 CSV 的表头
const headers = [
    'Model',          // 模型名称
    'Task',           // 任务名称
    'Success',        // 是否完全修复成功 (true/false)
    'Iterations',     // 消耗的修复轮数
    'Init_Total',     // 初始状态：总错误数
    'Init_A11y',      // 初始状态：无障碍错误
    'Init_Sec',       // 初始状态：安全错误
    'Final_Total',    // 最终状态：总错误数
    'Final_A11y',     // 最终状态：无障碍错误
    'Final_Sec'       // 最终状态：安全错误
];

let csvContent = headers.join(',') + '\n';
let totalFiles = 0;

console.log('🔍 开始扫描测试数据...');

// 1. 检查 output 目录是否存在
if (!fs.existsSync(outputDir)) {
    console.error(`❌ 找不到 output 目录，请确认路径: ${outputDir}`);
    process.exit(1);
}

// 2. 获取 output 下所有的子文件夹（即模型名称目录）
const models = fs.readdirSync(outputDir).filter(item => {
    // 过滤掉可能存在的隐藏文件（如 .DS_Store）或非文件夹文件
    if (item.startsWith('.')) return false; 
    const itemPath = path.join(outputDir, item);
    return fs.statSync(itemPath).isDirectory();
});

// 3. 遍历每个模型文件夹
models.forEach(model => {
    // 根据你的截图，日志存放在 output/模型名/logs/ 目录下
    const logsDir = path.join(outputDir, model, 'logs');
    
    if (!fs.existsSync(logsDir)) {
        console.log(`⚠️ 模型 [${model}] 下未找到 logs 文件夹，已跳过。`);
        return;
    }

    // 获取该模型下所有的 .json 文件
    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.json'));

    logFiles.forEach(file => {
        const filePath = path.join(logsDir, file);
        const rawData = fs.readFileSync(filePath, 'utf-8');
        
        try {
            const data = JSON.parse(rawData);

            // 提取基础信息 (优先使用 JSON 内部的 task 字段，否则用文件名推断)
            const task = data.task || file.replace('_log.json', '');
            const success = data.finalState ? data.finalState.success : false;
            const iterationsUsed = data.finalState ? data.finalState.iterationsUsed : 0;

            // 提取初始错误信息
            const initTotal = data.initialState ? data.initialState.totalErrors : 0;
            const initA11y = data.initialState ? data.initialState.a11yErrors : 0;
            const initSec = data.initialState ? data.initialState.secErrors : 0;

            // 提取最终错误信息
            let finalTotal = data.finalState ? data.finalState.remainingErrors : initTotal;
            let finalA11y = initA11y;
            let finalSec = initSec;

            // 核心逻辑：从修复历史中准确抓取最后一轮的错误分类数据
            if (data.repairHistory && Array.isArray(data.repairHistory) && data.repairHistory.length > 0) {
                const lastIteration = data.repairHistory[data.repairHistory.length - 1];
                finalTotal = lastIteration.totalErrors;
                finalA11y = lastIteration.a11yErrors;
                finalSec = lastIteration.secErrors;
            } else if (success) {
                // 如果没有修复历史（例如第一轮甚至生成阶段就完美了）且状态为成功，说明错误全清 0
                finalTotal = 0;
                finalA11y = 0;
                finalSec = 0;
            }

            // 组装成 CSV 的一行
            const row = [
                model,
                task,
                success,
                iterationsUsed,
                initTotal,
                initA11y,
                initSec,
                finalTotal,
                finalA11y,
                finalSec
            ];

            csvContent += row.join(',') + '\n';
            totalFiles++;
            
        } catch (err) {
            console.error(`❌ 解析文件失败: ${filePath} (可能是 JSON 格式损坏)`, err.message);
        }
    });
});

// 4. 将提取的结果写入 CSV 文件
fs.writeFileSync(summaryFile, csvContent, 'utf-8');
console.log(`\n✅ 数据提取完成！`);
console.log(`📊 共处理了 ${totalFiles} 份有效日志。`);
console.log(`📁 汇总表格已生成: ${summaryFile}`);