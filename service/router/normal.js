import express from 'express';
import jwt from 'jsonwebtoken';
import { postgresql } from '../api/database.js';
import { logs } from '../api/logs.js';

const router = express.Router();

router.get('/version', async (req, res) => { 
    return res.json({
        code: 2009998,
        message: '获取版本成功',
        data: {
            version: process.env.APP_VERSION
        },
        result: true
    });
});

router.get('/update', async (req, res) => { 
    return res.json({
        code: 2009998,
        message: '获取更新包',
        data: {
            update:process.env.APP_UPDATE
        },
        result: true
    });   
});

router.post('/user/login', async (req, res) => {
    const { username } = req.body;

    // 基本校验
    if (!username) {
        return res.json({
            code: 4000002,
            message: '请输入员工编号',
            data: null,
            result: false
        });
    }

    try {
        const queryText = 'SELECT * FROM users WHERE username = $1';
        const result = await postgresql.query(queryText, [username]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            // 生成 Token
            const token = jwt.sign({
                id: user.id,
                username: user.username,      // 用户名
                identity: user.identity,       // 身份标识（0:普通用户, 1:班组长, 2:管理员等）
                unit: user.unit,//站段
                workshop: user.workshop,      // 车间
                area:user.area,        // 区域
                team: user.team,       // 班组
                name: user.name       // 姓名
            }, process.env.JWT_USER_SECRET, { expiresIn: parseInt(process.env.JWT_USER_EXPIRE_TIME) });

            return res.json({
                code: 2000002,
                message: '登陆成功',
                data: {
                    token: token,
                    userInfo: {
                        username: user.username,
                        identity: user.identity,
                        unit: user.unit,
                        workshop: user.workshop,
                        area:user.area,        
                        team: user.team,
                        name: user.name
                    }
                },
                result: true
            });
        } else {
            return res.json({
                code: 4000002,
                message: '员工编号错误',
                data: null,
                result: false
            });
        }
    } catch (err) {
        logs('error', "员工登录报错：" + err.message);
        res.status(500).json({
            code: 5000002,
            message: '服务器错误',
            data: null,
            result: false
        });
    }
});


router.post('/admin/login', async (req, res) => { 
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({
            code: 4001002,
            message: '请输入用户名和密码',
            data: null,
            result: false
        });
    }
    try {
        const queryText = 'SELECT * FROM admin WHERE username = $1 AND password = $2';
        const result = await postgresql.query(queryText, [username, password]);

        if (result.rows.length > 0) {
            const admin = result.rows[0];
            const token = jwt.sign({
                id: admin.id,
                username: admin.username,      // 用户名 
                unit: admin.unit,              //站段
                workshop: admin.workshop,      // 车间
            }, process.env.JWT_ADMIN_SECRET, { expiresIn:parseInt(process.env.JWT_ADMIN_EXPIRE_TIME) })
            return res.json({
                code: 2001002,
                message: '登陆成功',
                data: {
                    token: token,
                    adminInfo: {
                        username: admin.username,
                        unit: admin.unit,
                        workshop: admin.workshop,
                    }
                },
                result: true
            });
        }else {
            return res.json({
                code: 4001002,
                message: '用户名或密码错误',
                data: null,
                result: false
            });
        }
    }catch (err) {
        logs('error', "管理员登录报错：" + err.message);
        res.status(500).json({
            code: 5001002,
            message: '服务器错误',
            data: null,
            result: false
        });
    }
});
export default router;