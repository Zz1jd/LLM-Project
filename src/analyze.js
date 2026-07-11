const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'output');
const summaryFile = path.join(outputDir, 'benchmark_summary.csv');

const headers = [
    'Model',
    'Task',
    'Success',
    'Iterations',
    'Init_Total',
    'Init_A11y',
    'Init_Sec',
    'Final_Total',
    'Final_A11y',
    'Final_Sec'
];

let csvContent = headers.join(',') + '\n';
let totalFiles = 0;

console.log('Scanning benchmark logs...');

if (!fs.existsSync(outputDir)) {
    console.error(`Output directory not found: ${outputDir}`);
    process.exit(1);
}

const models = fs.readdirSync(outputDir).filter(item => {
    if (item.startsWith('.')) return false; 
    const itemPath = path.join(outputDir, item);
    return fs.statSync(itemPath).isDirectory();
});

models.forEach(model => {
    const logsDir = path.join(outputDir, model, 'logs');
    
    if (!fs.existsSync(logsDir)) {
        console.log(`No logs directory found for model ${model}; skipped.`);
        return;
    }

    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.json'));

    logFiles.forEach(file => {
        const filePath = path.join(logsDir, file);
        const rawData = fs.readFileSync(filePath, 'utf-8');
        
        try {
            const data = JSON.parse(rawData);

            const task = data.task || file.replace('_log.json', '');
            const success = data.finalState ? data.finalState.success : false;
            const iterationsUsed = data.finalState ? data.finalState.iterationsUsed : 0;

            const initTotal = data.initialState ? data.initialState.totalErrors : 0;
            const initA11y = data.initialState ? data.initialState.a11yErrors : 0;
            const initSec = data.initialState ? data.initialState.secErrors : 0;

            let finalTotal = data.finalState ? data.finalState.remainingErrors : initTotal;
            let finalA11y = initA11y;
            let finalSec = initSec;

            if (data.repairHistory && Array.isArray(data.repairHistory) && data.repairHistory.length > 0) {
                const lastIteration = data.repairHistory[data.repairHistory.length - 1];
                finalTotal = lastIteration.totalErrors;
                finalA11y = lastIteration.a11yErrors;
                finalSec = lastIteration.secErrors;
            } else if (success) {
                finalTotal = 0;
                finalA11y = 0;
                finalSec = 0;
            }

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
            console.error(`Failed to parse log file: ${filePath}`, err.message);
        }
    });
});

fs.writeFileSync(summaryFile, csvContent, 'utf-8');
console.log('\nBenchmark extraction complete.');
console.log(`Processed ${totalFiles} valid log files.`);
console.log(`Summary written to: ${summaryFile}`);
