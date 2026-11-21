import { Pool } from 'pg';
import { logs } from '../api/logs.js';

const poolConfig = {
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DATABASE,
    max: parseInt(process.env.POSTGRES_MAX) || 10, 
    min: parseInt(process.env.POSTGRES_MIN) || 1,
    idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT_MILLIS) || 20000, 
    connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT_MILLIS) || 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
};

export const postgresql = new Pool(poolConfig);

postgresql.on('error', (err) => {
    // 安全地获取错误消息，防止 err.message 为 undefined/null
    const errorMessage = (err.message || '').toLowerCase();
    const errorCode = err.code;

    // 定义已知的、可接受的断开连接错误特征
    // 1. PostgreSQL 错误码 57P01: admin_shutdown
    // 2. 消息中包含 "terminated unexpectedly"
    // 3. 消息中包含 "connection terminated"
    const isKnownDisconnectError = 
        errorCode === '57P01' || 
        errorMessage.includes('terminated unexpectedly') || 
        errorMessage.includes('connection terminated');

    // 如果不是已知的断开连接错误，则视为未知错误进行记录
    if (!isKnownDisconnectError) {
        // 确保 logs 函数存在，避免二次崩溃
        if (typeof logs === 'function') {
            logs('error', `PostgreSQL 池发生未知错误: ${err.message}`);
        }
    }
});


(async () => {
    try {
        const res = await postgresql.query('SELECT NOW()');
        logs("", "兖下材料助手后端服务器 PostgreSQL 数据库连接成功！");
    } catch (err) {
        logs("error", "兖下材料助手后端服务器 PostgreSQL 数据库连接失败: " + err.message);
    }
})();