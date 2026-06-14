function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
        const needsQuoting = value === '' || /[\s"=]/.test(value);
        return needsQuoting ? JSON.stringify(value) : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
}

function formatFields(fields) {
    const entries = Object.entries(fields || {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${formatValue(v)}`);
    return entries.length ? ` ${entries.join(' ')}` : '';
}

function emit(level, event, fields, error) {
    const ts = new Date().toISOString();
    const base = `EXP ts=${ts} level=${level} event=${event}`;
    const line = base + formatFields(fields);
    if (level === 'ERROR') {
        if (error) {
            console.error(line, error);
            return;
        }
        console.error(line);
        return;
    }
    console.log(line);
}

function info(event, fields) {
    emit('INFO', event, fields);
}

function warn(event, fields) {
    emit('WARN', event, fields);
}

function error(event, fields, err) {
    emit('ERROR', event, fields, err);
}

module.exports = { info, warn, error };
