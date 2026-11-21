import jwt from 'jsonwebtoken';

export const adminAuth = (req, res, next) => {
    // 【修复点】获取 Authorization 头并检查是否存在
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.json({
            code: 4001001,
            message: '未登录或登录状态已过期',
            data: null,
            result: false
        });
    }

    // 【修复点】安全地分割字符串，防止格式错误导致崩溃
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.json({
            code: 4001001,
            message: '未登录或登录状态已过期',
            data: null,
            result: false
        });
    }

    const token = parts[1];

    const secret = process.env.JWT_ADMIN_SECRET || 'admin';

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return res.json({
                code: 4001001,
                message: '未登录或登录状态已过期',
                data: null,
                result: false
            });
        }
        // 根据业务需求，可能挂载到 req.admin 或 req.user
        req.admin = decoded; 
        next();
    });
};