import jwt from 'jsonwebtoken';

export const userAuth = (req, res, next) => {
    // 【优化点】获取 Authorization 头并检查是否存在
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.json({
            code: 4000001,
            message: '未登录或登录状态已过期',
            data: null,
            result: false
        });
    }

    // 【优化点】安全地分割字符串，防止格式错误导致崩溃
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.json({
            code: 4000001,
            message: '未登录或登录状态已过期',
            data: null,
            result: false
        });
    }

    const token = parts[1];

    jwt.verify(token, process.env.JWT_USER_SECRET, (err, decoded) => {
        if (err) {
            return res.json({
                code: 4000001,
                message: '账号未登录或登录状态已过期',
                data: null,
                result: false
            });
        }
        req.user = decoded;
        next();
    });
};