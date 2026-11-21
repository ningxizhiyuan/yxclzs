import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function logs(type, msg) {
    const now = new Date();
    const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    // 控制台输出
    if (type == 'error') {
        console.error(time + "  " + msg);
    } else {
        console.log(time + "  " + msg);
    }
    
    // 写入日志文件
    const logDir = path.join(__dirname, '../logs');
    let logFile;
    
    if (type == 'error') {
        logFile = path.join(logDir, 'error.log');
    } else {
        logFile = path.join(logDir, 'other.log');
    }
    
    const logEntry = `${time}  ${msg}\n`;
    fs.appendFileSync(logFile, logEntry, 'utf8');
}