import express from 'express';
import { postgresql } from '../api/database.js';
import { logs } from '../api/logs.js';
import multer from 'multer';
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';

const router = express.Router();


// ==================== 通用验证 ====================
router.get('/verify', async (req, res) => {
    // adminAuth 中间件已解析 token，挂载了 req.admin
    return res.json({
        code: 2001001,
        message: '已登录',
        data: {
            username: req.admin.username,   // 必须返回用户名
            unit: req.admin.unit,
            workshop: req.admin.workshop
        },
        result: true
    });
});

// Multer 配置
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });


/**
 * 修改管理员密码
 * PUT /admin/change-password
 */
router.put('/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const { username, unit, workshop } = req.admin;

    if (!oldPassword || !newPassword) {
        return res.json({
            code: 4001009,
            message: '旧密码和新密码均不能为空',
            data: null,
            result: false
        });
    }
    if (newPassword.length < 6) {
        return res.json({
            code: 4001010,
            message: '新密码长度至少为6位',
            data: null,
            result: false
        });
    }

    try {
        const userResult = await postgresql.query(
            'SELECT password FROM admin WHERE username = $1 AND unit = $2 AND workshop = $3',
            [username, unit, workshop]
        );
        if (userResult.rows.length === 0) {
            return res.json({
                code: 4001011,
                message: '管理员不存在',
                data: null,
                result: false
            });
        }

        const currentPassword = userResult.rows[0].password;
        if (currentPassword !== oldPassword) {
            return res.json({
                code: 4001012,
                message: '旧密码错误',
                data: null,
                result: false
            });
        }

        await postgresql.query(
            'UPDATE admin SET password = $1 WHERE username = $2 AND unit = $3 AND workshop = $4',
            [newPassword, username, unit, workshop]
        );

        logs('info', `管理员 ${username} 修改了密码，IP：${req.ip}`);
        res.json({
            code: 2001018,
            message: '密码修改成功，请重新登录',
            data: null,
            result: true
        });
    } catch (error) {
        logs('error', `修改密码失败：${error.message}`);
        res.status(500).json({
            code: 5001018,
            message: '服务器错误',
            data: null,
            result: false
        });
    }
});
// ==================== 用户管理 ====================
// GET /users - 列表
router.get('/users', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, area, team, username } = req.query;
        const { unit, workshop } = req.admin;
        let conditions = [`unit = $1`, `workshop = $2`];
        let params = [unit, workshop];
        let idx = 3;
        if (area) { conditions.push(`area LIKE $${idx++}`); params.push(`%${area}%`); }
        if (team) { conditions.push(`team LIKE $${idx++}`); params.push(`%${team}%`); }
        if (username) { conditions.push(`username LIKE $${idx++}`); params.push(`%${username}%`); }
        const whereClause = conditions.join(' AND ');
        const countRes = await postgresql.query(`SELECT COUNT(*) FROM users WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].count);
        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT id, username, identity, unit, workshop, team, name, area
            FROM users WHERE ${whereClause}
            ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(parseInt(pageSize), offset);
        const dataRes = await postgresql.query(dataQuery, params);
        res.json({ code: 2001002, message: '获取用户列表成功', data: { list: dataRes.rows, total }, result: true });
    } catch (err) {
        logs('error', `获取用户列表失败：${err.message}`);
        res.status(500).json({ code: 5001002, message: '服务器错误', data: null, result: false });
    }
});


// POST /users - 添加（增加 security_pin 字段）
router.post('/users', async (req, res) => {
    const { username, name, identity = 0, area, team, security_pin } = req.body;
    const { unit, workshop } = req.admin;
    if (!username || !name || !area || !team) {
        return res.json({ code: 4001003, message: '必填项缺失', data: null, result: false });
    }
    if (username.length > 10) {
        return res.json({ code: 4001004, message: '员工编号不能超过10个字符', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM users WHERE username = $1', [username]);
        if (check.rows.length) {
            return res.json({ code: 4001005, message: '员工编号已存在', data: null, result: false });
        }
        // 插入时加入 security_pin
        const insert = await postgresql.query(
            `INSERT INTO users (username, name, identity, unit, workshop, area, team, security_pin)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, name, identity, area, team`,
            [username, name, parseInt(identity), unit, workshop, area, team, security_pin || null]
        );
        logs('info', `添加用户成功：${username} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001003, message: '添加成功', data: insert.rows[0], result: true });
    } catch (err) {
        logs('error', `添加用户失败：${err.message}`);
        res.status(500).json({ code: 5001003, message: '服务器错误', data: null, result: false });
    }
});

// PUT /users/:username - 更新（支持更新 security_pin）
router.put('/users/:username', async (req, res) => {
    const { username } = req.params;
    const { name, identity, area, team, security_pin } = req.body;
    if (!name || !area || !team) {
        return res.json({ code: 4001006, message: '必填项缺失', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM users WHERE username = $1', [username]);
        if (!check.rows.length) {
            return res.json({ code: 4001007, message: '用户不存在', data: null, result: false });
        }
        // 动态构建更新语句
        const updates = [];
        const values = [];
        let paramIndex = 1;
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
        updates.push(`identity = $${paramIndex++}`);
        values.push(parseInt(identity));
        updates.push(`area = $${paramIndex++}`);
        values.push(area);
        updates.push(`team = $${paramIndex++}`);
        values.push(team);

        // 如果 security_pin 字段在请求体中存在，则更新（可以为 null）
        if (security_pin !== undefined) {
            updates.push(`security_pin = $${paramIndex++}`);
            values.push(security_pin || null);
        }

        updates.push(`username = $${paramIndex++}`);
        values.push(username);

        const query = `UPDATE users SET ${updates.join(', ')} RETURNING id, username, name, identity, area, team`;
        const update = await postgresql.query(query, values);
        logs('info', `更新用户成功：${username} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001004, message: '编辑成功', data: update.rows[0], result: true });
    } catch (err) {
        logs('error', `更新用户失败：${err.message}`);
        res.status(500).json({ code: 5001004, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /users/batch - 批量删除
router.delete('/users/batch', async (req, res) => {
    const { usernames } = req.body;
    if (!usernames?.length) {
        return res.json({ code: 4001008, message: '请选择要删除的用户', data: null, result: false });
    }
    try {
        const result = await postgresql.query('DELETE FROM users WHERE username = ANY($1::varchar[])', [usernames]);
        logs('info', `批量删除用户成功：${result.rowCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001005, message: `成功删除 ${result.rowCount} 条数据`, data: { count: result.rowCount }, result: true });
    } catch (err) {
        logs('error', `批量删除用户失败：${err.message}`);
        res.status(500).json({ code: 5001005, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /users/:username - 删除单个
router.delete('/users/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const result = await postgresql.query('DELETE FROM users WHERE username = $1', [username]);
        if (result.rowCount === 0) {
            return res.json({ code: 4001009, message: '用户不存在', data: null, result: false });
        }
        logs('info', `删除用户成功：${username} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001006, message: '删除成功', data: null, result: true });
    } catch (err) {
        logs('error', `删除用户失败：${err.message}`);
        res.status(500).json({ code: 5001006, message: '服务器错误', data: null, result: false });
    }
});

// ==================== 物料种类 ====================
// GET /class
router.get('/class', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, area, name } = req.query;
        const { unit, workshop } = req.admin;
        let conditions = [`unit = $1`, `workshop = $2`];
        let params = [unit, workshop];
        let idx = 3;
        if (area) { conditions.push(`area ILIKE $${idx++}`); params.push(`%${area}%`); }
        if (name) { conditions.push(`name ILIKE $${idx++}`); params.push(`%${name}%`); }
        const whereClause = conditions.join(' AND ');
        const countRes = await postgresql.query(`SELECT COUNT(*) FROM class WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].count);
        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT id, name, unit, workshop, area
            FROM class WHERE ${whereClause}
            ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(parseInt(pageSize), offset);
        const dataRes = await postgresql.query(dataQuery, params);
        res.json({ code: 2001007, message: '获取物料种类列表成功', data: { list: dataRes.rows, total }, result: true });
    } catch (err) {
        logs('error', `获取物料种类失败：${err.message}`);
        res.status(500).json({ code: 5001007, message: '服务器错误', data: null, result: false });
    }
});

// POST /class
router.post('/class', async (req, res) => {
    const { name, area } = req.body;
    const { unit, workshop } = req.admin;
    if (!name || !area) {
        return res.json({ code: 4001010, message: '物料名称和区域为必填项', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM class WHERE name=$1 AND unit=$2 AND workshop=$3 AND area=$4', [name, unit, workshop, area]);
        if (check.rows.length) {
            return res.json({ code: 4001011, message: '该区域下已存在相同的物料名称', data: null, result: false });
        }
        const insert = await postgresql.query(
            'INSERT INTO class (name, unit, workshop, area) VALUES ($1,$2,$3,$4) RETURNING id,name,unit,workshop,area',
            [name, unit, workshop, area]
        );
        logs('info', `添加物料种类成功：${name} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001008, message: '添加成功', data: insert.rows[0], result: true });
    } catch (err) {
        logs('error', `添加物料种类失败：${err.message}`);
        res.status(500).json({ code: 5001008, message: '服务器错误', data: null, result: false });
    }
});

// PUT /class/:originalName
router.put('/class/:originalName', async (req, res) => {
    const { originalName } = req.params;
    const { name, area } = req.body;
    const { unit, workshop } = req.admin;
    if (!name || !area) {
        return res.json({ code: 4001012, message: '物料名称和区域为必填项', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM class WHERE name=$1 AND unit=$2 AND workshop=$3', [originalName, unit, workshop]);
        if (!check.rows.length) {
            return res.json({ code: 4001013, message: '原记录不存在', data: null, result: false });
        }
        if (name !== originalName) {
            const dup = await postgresql.query('SELECT id FROM class WHERE name=$1 AND unit=$2 AND workshop=$3', [name, unit, workshop]);
            if (dup.rows.length) {
                return res.json({ code: 4001014, message: '该物料名称已存在', data: null, result: false });
            }
        }
        await postgresql.query('UPDATE class SET name=$1, area=$2 WHERE name=$3 AND unit=$4 AND workshop=$5', [name, area, originalName, unit, workshop]);
        logs('info', `更新物料种类成功：${originalName} -> ${name} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001009, message: '编辑成功', data: null, result: true });
    } catch (err) {
        logs('error', `更新物料种类失败：${err.message}`);
        res.status(500).json({ code: 5001009, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /class/batch
router.delete('/class/batch', async (req, res) => {
    const { names } = req.body;
    const { unit, workshop } = req.admin;
    if (!names?.length) {
        return res.json({ code: 4001015, message: '请选择要删除的记录', data: null, result: false });
    }
    try {
        const result = await postgresql.query('DELETE FROM class WHERE name = ANY($1::varchar[]) AND unit=$2 AND workshop=$3', [names, unit, workshop]);
        logs('info', `批量删除物料种类成功：${result.rowCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001010, message: `成功删除 ${result.rowCount} 条数据`, data: { count: result.rowCount }, result: true });
    } catch (err) {
        logs('error', `批量删除物料种类失败：${err.message}`);
        res.status(500).json({ code: 5001010, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /class/:name
router.delete('/class/:name', async (req, res) => {
    const { name } = req.params;
    const { unit, workshop } = req.admin;
    try {
        const result = await postgresql.query('DELETE FROM class WHERE name=$1 AND unit=$2 AND workshop=$3', [name, unit, workshop]);
        if (result.rowCount === 0) {
            return res.json({ code: 4001016, message: '记录不存在', data: null, result: false });
        }
        logs('info', `删除物料种类成功：${name} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001011, message: '删除成功', data: null, result: true });
    } catch (err) {
        logs('error', `删除物料种类失败：${err.message}`);
        res.status(500).json({ code: 5001011, message: '服务器错误', data: null, result: false });
    }
});

// ==================== 箱号管理 ====================
// GET /boxlist (下拉)
router.get('/boxlist', async (req, res) => {
    const { unit, workshop } = req.admin;
    try {
        const result = await postgresql.query('SELECT id, boxnumber, location, area FROM boxlist WHERE unit=$1 AND workshop=$2 ORDER BY boxnumber ASC', [unit, workshop]);
        res.json({ code: 2001012, message: '获取箱号列表成功', data: { list: result.rows }, result: true });
    } catch (err) {
        logs('error', `获取箱号列表失败：${err.message}`);
        res.status(500).json({ code: 5001012, message: '服务器错误', data: null, result: false });
    }
});

// GET /boxlist/manage (分页管理)
router.get('/boxlist/manage', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, boxnumber, area, location } = req.query;
        const { unit, workshop } = req.admin;
        let conditions = [`unit = $1`, `workshop = $2`];
        let params = [unit, workshop];
        let idx = 3;
        if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(parseInt(boxnumber)); }
        if (area) { conditions.push(`area ILIKE $${idx++}`); params.push(`%${area}%`); }
        if (location) { conditions.push(`location ILIKE $${idx++}`); params.push(`%${location}%`); }
        const whereClause = conditions.join(' AND ');
        const countRes = await postgresql.query(`SELECT COUNT(*) FROM boxlist WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].count);
        const offset = (page - 1) * pageSize;
        const dataQuery = `SELECT id, boxnumber, area, location FROM boxlist WHERE ${whereClause} ORDER BY boxnumber ASC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(pageSize), offset);
        const dataRes = await postgresql.query(dataQuery, params);
        res.json({ code: 2001013, message: '获取箱号列表成功', data: { list: dataRes.rows, total }, result: true });
    } catch (err) {
        logs('error', `获取箱号列表失败：${err.message}`);
        res.status(500).json({ code: 5001013, message: '服务器错误', data: null, result: false });
    }
});

// POST /boxlist
router.post('/boxlist', async (req, res) => {
    const { boxnumber, area, location } = req.body;
    const { unit, workshop } = req.admin;
    if (!boxnumber || !area || !location) {
        return res.json({ code: 4001017, message: '箱号、区域、位置为必填项', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM boxlist WHERE boxnumber=$1 AND unit=$2 AND workshop=$3 AND area=$4', [boxnumber, unit, workshop, area]);
        if (check.rows.length) {
            return res.json({ code: 4001018, message: '该箱号在此区域内已存在', data: null, result: false });
        }
        const insert = await postgresql.query('INSERT INTO boxlist (boxnumber, unit, workshop, area, location) VALUES ($1,$2,$3,$4,$5) RETURNING id', [boxnumber, unit, workshop, area, location]);
        logs('info', `添加箱号成功：${boxnumber} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001014, message: '添加成功', data: { id: insert.rows[0].id }, result: true });
    } catch (err) {
        logs('error', `添加箱号失败：${err.message}`);
        res.status(500).json({ code: 5001014, message: '服务器错误', data: null, result: false });
    }
});

// PUT /boxlist/:id
router.put('/boxlist/:id', async (req, res) => {
    const { id } = req.params;
    const { boxnumber, area, location } = req.body;
    const { unit, workshop } = req.admin;
    if (!boxnumber || !area || !location) {
        return res.json({ code: 4001019, message: '箱号、区域、位置为必填项', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM boxlist WHERE id=$1 AND unit=$2 AND workshop=$3', [id, unit, workshop]);
        if (!check.rows.length) {
            return res.json({ code: 4001020, message: '记录不存在或无权限', data: null, result: false });
        }
        const dup = await postgresql.query('SELECT id FROM boxlist WHERE boxnumber=$1 AND unit=$2 AND workshop=$3 AND area=$4 AND id!=$5', [boxnumber, unit, workshop, area, id]);
        if (dup.rows.length) {
            return res.json({ code: 4001021, message: '该箱号在此区域内已存在', data: null, result: false });
        }
        await postgresql.query('UPDATE boxlist SET boxnumber=$1, area=$2, location=$3 WHERE id=$4 AND unit=$5 AND workshop=$6', [boxnumber, area, location, id, unit, workshop]);
        logs('info', `编辑箱号成功：ID ${id} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001015, message: '编辑成功', data: null, result: true });
    } catch (err) {
        logs('error', `编辑箱号失败：${err.message}`);
        res.status(500).json({ code: 5001015, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /boxlist/batch
router.delete('/boxlist/batch', async (req, res) => {
    const { ids } = req.body;
    const { unit, workshop } = req.admin;
    if (!ids?.length) {
        return res.json({ code: 4001022, message: '请选择要删除的记录', data: null, result: false });
    }
    const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (!numericIds.length) {
        return res.json({ code: 4001023, message: '无效的ID列表', data: null, result: false });
    }
    try {
        const result = await postgresql.query('DELETE FROM boxlist WHERE id = ANY($1::int[]) AND unit=$2 AND workshop=$3', [numericIds, unit, workshop]);
        logs('info', `批量删除箱号成功：${result.rowCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001016, message: `成功删除 ${result.rowCount} 条记录`, data: { count: result.rowCount }, result: true });
    } catch (err) {
        logs('error', `批量删除箱号失败：${err.message}`);
        res.status(500).json({ code: 5001016, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /boxlist/:id
router.delete('/boxlist/:id', async (req, res) => {
    const { id } = req.params;
    const { unit, workshop } = req.admin;
    try {
        const result = await postgresql.query('DELETE FROM boxlist WHERE id=$1 AND unit=$2 AND workshop=$3', [id, unit, workshop]);
        if (result.rowCount === 0) {
            return res.json({ code: 4001024, message: '记录不存在或无权限', data: null, result: false });
        }
        logs('info', `删除箱号成功：ID ${id} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001017, message: '删除成功', data: null, result: true });
    } catch (err) {
        logs('error', `删除箱号失败：${err.message}`);
        res.status(500).json({ code: 5001017, message: '服务器错误', data: null, result: false });
    }
});

// ==================== 库存管理 ====================
// GET /inventory
router.get('/inventory', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, boxnumber, name, area } = req.query;
        const { unit, workshop } = req.admin;
        let conditions = [`unit = $1`, `workshop = $2`];
        let params = [unit, workshop];
        let idx = 3;
        if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(parseInt(boxnumber)); }
        if (name) { conditions.push(`name ILIKE $${idx++}`); params.push(`%${name}%`); }
        if (area) { conditions.push(`area ILIKE $${idx++}`); params.push(`%${area}%`); }
        const whereClause = conditions.join(' AND ');
        const countRes = await postgresql.query(`SELECT COUNT(*) FROM inventory WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].count);
        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT id, boxnumber, name, "Remaining", quota, area, alert_threshold
            FROM inventory WHERE ${whereClause}
            ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(parseInt(pageSize), offset);
        const dataRes = await postgresql.query(dataQuery, params);
        res.json({ code: 2001018, message: '获取库存列表成功', data: { list: dataRes.rows, total }, result: true });
    } catch (err) {
        logs('error', `获取库存列表失败：${err.message}`);
        res.status(500).json({ code: 5001018, message: '服务器错误', data: null, result: false });
    }
});

// POST /inventory
router.post('/inventory', async (req, res) => {
    const { boxnumber, name, Remaining, quota, area, alert_threshold = 5 } = req.body;
    const { unit, workshop } = req.admin;
    if (!boxnumber || !name || Remaining === undefined || quota === undefined || !area) {
        return res.json({ code: 4001025, message: '必填项缺失', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM inventory WHERE boxnumber=$1 AND name=$2 AND unit=$3 AND workshop=$4', [boxnumber, name, unit, workshop]);
        if (check.rows.length) {
            return res.json({ code: 4001026, message: '该箱号下已存在此物料库存记录', data: null, result: false });
        }
        const insert = await postgresql.query(
            `INSERT INTO inventory (boxnumber, name, "Remaining", quota, unit, workshop, area, alert_threshold)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [parseInt(boxnumber), name, parseInt(Remaining), parseInt(quota), unit, workshop, area, parseInt(alert_threshold)]
        );
        logs('info', `添加库存记录成功：箱号 ${boxnumber}，物料 ${name} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001019, message: '添加成功', data: { id: insert.rows[0].id }, result: true });
    } catch (err) {
        logs('error', `添加库存记录失败：${err.message}`);
        res.status(500).json({ code: 5001019, message: '服务器错误', data: null, result: false });
    }
});

// PUT /inventory/:id
router.put('/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { boxnumber, name, Remaining, quota, area, alert_threshold } = req.body;
    const { unit, workshop } = req.admin;
    if (!boxnumber || !name || Remaining === undefined || quota === undefined || !area) {
        return res.json({ code: 4001027, message: '必填项缺失', data: null, result: false });
    }
    try {
        const check = await postgresql.query('SELECT id FROM inventory WHERE id=$1 AND unit=$2 AND workshop=$3', [id, unit, workshop]);
        if (!check.rows.length) {
            return res.json({ code: 4001028, message: '记录不存在或无权限', data: null, result: false });
        }
        const conflict = await postgresql.query('SELECT id FROM inventory WHERE boxnumber=$1 AND name=$2 AND unit=$3 AND workshop=$4 AND id!=$5', [boxnumber, name, unit, workshop, id]);
        if (conflict.rows.length) {
            return res.json({ code: 4001029, message: '该箱号下已存在此物料库存记录', data: null, result: false });
        }
        await postgresql.query(
            `UPDATE inventory SET boxnumber=$1, name=$2, "Remaining"=$3, quota=$4, area=$5, alert_threshold=$6 WHERE id=$7 AND unit=$8 AND workshop=$9`,
            [parseInt(boxnumber), name, parseInt(Remaining), parseInt(quota), area, parseInt(alert_threshold), id, unit, workshop]
        );
        logs('info', `编辑库存记录成功：ID ${id} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001020, message: '编辑成功', data: null, result: true });
    } catch (err) {
        logs('error', `编辑库存记录失败：${err.message}`);
        res.status(500).json({ code: 5001020, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /inventory/batch
router.delete('/inventory/batch', async (req, res) => {
    const { ids } = req.body;
    const { unit, workshop } = req.admin;
    if (!ids?.length) {
        return res.json({ code: 4001030, message: '请选择要删除的记录', data: null, result: false });
    }
    const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (!numericIds.length) {
        return res.json({ code: 4001031, message: '无效的ID列表', data: null, result: false });
    }
    try {
        const result = await postgresql.query('DELETE FROM inventory WHERE id = ANY($1::int[]) AND unit=$2 AND workshop=$3', [numericIds, unit, workshop]);
        logs('info', `批量删除库存记录成功：${result.rowCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001021, message: `成功删除 ${result.rowCount} 条记录`, data: { count: result.rowCount }, result: true });
    } catch (err) {
        logs('error', `批量删除库存记录失败：${err.message}`);
        res.status(500).json({ code: 5001021, message: '服务器错误', data: null, result: false });
    }
});

// DELETE /inventory/:id
router.delete('/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { unit, workshop } = req.admin;
    try {
        const result = await postgresql.query('DELETE FROM inventory WHERE id=$1 AND unit=$2 AND workshop=$3', [id, unit, workshop]);
        if (result.rowCount === 0) {
            return res.json({ code: 4001032, message: '记录不存在或无权限', data: null, result: false });
        }
        logs('info', `删除库存记录成功：ID ${id} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001022, message: '删除成功', data: null, result: true });
    } catch (err) {
        logs('error', `删除库存记录失败：${err.message}`);
        res.status(500).json({ code: 5001022, message: '服务器错误', data: null, result: false });
    }
});

// ==================== 预警管理 ====================
// GET /inventory/warnings
router.get('/inventory/warnings', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, boxnumber, name, area, limit } = req.query;
        const { unit, workshop } = req.admin;
        let conditions = [`unit = $1`, `workshop = $2`, `"Remaining" <= alert_threshold`];
        let params = [unit, workshop];
        let idx = 3;
        if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(parseInt(boxnumber)); }
        if (name) { conditions.push(`name ILIKE $${idx++}`); params.push(`%${name}%`); }
        if (area) { conditions.push(`area ILIKE $${idx++}`); params.push(`%${area}%`); }
        const whereClause = conditions.join(' AND ');
        if (limit) {
            const dataQuery = `SELECT id, boxnumber, name, "Remaining", quota, area, alert_threshold FROM inventory WHERE ${whereClause} ORDER BY boxnumber ASC LIMIT $${idx++}`;
            params.push(parseInt(limit));
            const dataRes = await postgresql.query(dataQuery, params);
            return res.json({ code: 2001023, message: '获取成功', data: { list: dataRes.rows }, result: true });
        }
        const countRes = await postgresql.query(`SELECT COUNT(*) FROM inventory WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].count);
        const offset = (page - 1) * pageSize;
        const dataQuery = `SELECT id, boxnumber, name, "Remaining", quota, area, alert_threshold FROM inventory WHERE ${whereClause} ORDER BY boxnumber ASC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(pageSize), offset);
        const dataRes = await postgresql.query(dataQuery, params);
        res.json({ code: 2001023, message: '获取成功', data: { list: dataRes.rows, total }, result: true });
    } catch (err) {
        logs('error', `获取预警列表失败：${err.message}`);
        res.status(500).json({ code: 5001023, message: '服务器错误', data: null, result: false });
    }
});

// GET /inventory/warnings/export
router.get('/inventory/warnings/export', async (req, res) => {
    try {
        const { unit, workshop } = req.admin;
        const { boxnumber, name, area } = req.query;
        let conditions = [`unit = $1`, `workshop = $2`, `"Remaining" <= alert_threshold`];
        let params = [unit, workshop];
        let idx = 3;
        if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(parseInt(boxnumber)); }
        if (name) { conditions.push(`name ILIKE $${idx++}`); params.push(`%${name}%`); }
        if (area) { conditions.push(`area ILIKE $${idx++}`); params.push(`%${area}%`); }
        const whereClause = conditions.join(' AND ');
        const query = `
            SELECT boxnumber, name, "Remaining", quota, area
            FROM inventory WHERE ${whereClause}
            ORDER BY boxnumber ASC
        `;
        const result = await postgresql.query(query, params);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('预警记录');
        worksheet.columns = [
            { header: '箱号', key: 'boxnumber', width: 12 },
            { header: '物料名称', key: 'name', width: 25 },
            { header: '剩余数量', key: 'Remaining', width: 12 },
            { header: '定额', key: 'quota', width: 12 },
            { header: '区域', key: 'area', width: 15 },
        ];
        const headerRow = worksheet.getRow(1);
        headerRow.height = 22;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a60b6' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        result.rows.forEach(row => {
            const dataRow = worksheet.addRow({
                boxnumber: row.boxnumber,
                name: row.name,
                Remaining: row.Remaining,
                quota: row.quota,
                area: row.area
            });
            dataRow.height = 20;
            dataRow.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=warnings.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        logs('info', `导出预警记录成功 / 操作者：${req.admin.username} / IP：${req.ip}`);
    } catch (err) {
        logs('error', `导出预警记录失败：${err.message}`);
        res.status(500).json({ code: 5001024, message: '导出失败', data: null, result: false });
    }
});

// ==================== 反馈管理 ====================
// GET /feedback
router.get('/feedback', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, boxnumber, type, status, startDate, endDate } = req.query;
        const { unit, workshop } = req.admin;
        let conditions = [`unit = $1`, `workshop = $2`];
        let params = [unit, workshop];
        let idx = 3;
        if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(boxnumber); }
        if (type) { conditions.push(`type = $${idx++}`); params.push(type); }
        if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
        if (startDate && endDate) { conditions.push(`created_at::date BETWEEN $${idx++} AND $${idx++}`); params.push(startDate, endDate); }
        const whereClause = conditions.join(' AND ');
        const countRes = await postgresql.query(`SELECT COUNT(*) FROM feedback WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].count);
        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT id, boxnumber, type, description, area, status, created_at, updated_at
            FROM feedback WHERE ${whereClause}
            ORDER BY (status = 'pending') DESC, created_at DESC
            LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(parseInt(pageSize), offset);
        const dataRes = await postgresql.query(dataQuery, params);
        res.json({ code: 2001025, message: '获取反馈列表成功', data: { list: dataRes.rows, total }, result: true });
    } catch (err) {
        logs('error', `获取反馈列表失败：${err.message}`);
        res.status(500).json({ code: 5001025, message: '服务器错误', data: null, result: false });
    }
});

// GET /feedback/pending
router.get('/feedback/pending', async (req, res) => {
    const { unit, workshop } = req.admin;
    const { limit = 20 } = req.query;
    try {
        const query = `SELECT id, boxnumber, type, description, created_at, status FROM feedback WHERE unit=$1 AND workshop=$2 AND status='pending' ORDER BY created_at DESC LIMIT $3`;
        const result = await postgresql.query(query, [unit, workshop, parseInt(limit)]);
        res.json({ code: 2001026, message: '获取待处理反馈成功', data: { list: result.rows }, result: true });
    } catch (err) {
        logs('error', `获取待处理反馈失败：${err.message}`);
        res.status(500).json({ code: 5001026, message: '服务器错误', data: null, result: false });
    }
});

// PUT /feedback/:id/resolve
router.put('/feedback/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const { unit, workshop } = req.admin;
    try {
        const update = await postgresql.query('UPDATE feedback SET status = $1, updated_at = NOW() WHERE id = $2 AND unit = $3 AND workshop = $4 AND status = $5 RETURNING id', ['resolved', id, unit, workshop, 'pending']);
        if (update.rowCount === 0) {
            return res.json({ code: 4001033, message: '反馈不存在或已处理', data: null, result: false });
        }
        logs('info', `反馈 ${id} 已处理 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001027, message: '操作成功', data: null, result: true });
    } catch (err) {
        logs('error', `处理反馈失败：${err.message}`);
        res.status(500).json({ code: 5001027, message: '服务器错误', data: null, result: false });
    }
});

// PUT /feedback/batch-resolve
router.put('/feedback/batch-resolve', async (req, res) => {
    const { ids } = req.body;
    const { unit, workshop } = req.admin;
    if (!ids?.length) {
        return res.json({ code: 4001034, message: '请选择要处理的反馈', data: null, result: false });
    }
    try {
        const result = await postgresql.query('UPDATE feedback SET status = $1, updated_at = NOW() WHERE id = ANY($2::int[]) AND unit = $3 AND workshop = $4 AND status = $5', ['resolved', ids, unit, workshop, 'pending']);
        logs('info', `批量处理反馈成功：${result.rowCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001028, message: `成功处理 ${result.rowCount} 条反馈`, data: { count: result.rowCount }, result: true });
    } catch (err) {
        logs('error', `批量处理反馈失败：${err.message}`);
        res.status(500).json({ code: 5001028, message: '服务器错误', data: null, result: false });
    }
});

// ==================== 反馈删除相关 ====================

// 批量删除反馈（任意状态，但只删除属于当前 unit/workshop 的）
router.delete('/feedback/batch', async (req, res) => {
    const { ids } = req.body;
    const { unit, workshop } = req.admin;
    if (!ids?.length) {
        return res.json({ code: 4001045, message: '请选择要删除的反馈', data: null, result: false });
    }
    try {
        const result = await postgresql.query(
            'DELETE FROM feedback WHERE id = ANY($1::int[]) AND unit = $2 AND workshop = $3 RETURNING id',
            [ids, unit, workshop]
        );
        logs('info', `批量删除反馈成功：${result.rowCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001037, message: `成功删除 ${result.rowCount} 条反馈`, data: { count: result.rowCount }, result: true });
    } catch (err) {
        logs('error', `批量删除反馈失败：${err.message}`);
        res.status(500).json({ code: 5001037, message: '服务器错误', data: null, result: false });
    }
});
// 快速清理（删除所有已处理的反馈）
router.delete('/feedback/clean', async (req, res) => {
    const { unit, workshop } = req.admin;
    try {
        const result = await postgresql.query(
            'DELETE FROM feedback WHERE unit = $1 AND workshop = $2 AND status = $3 RETURNING id',
            [unit, workshop, 'resolved']
        );
        logs('info', `快速清理已处理反馈成功：${result.rowCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001039, message: `已清理 ${result.rowCount} 条已处理反馈`, data: { count: result.rowCount }, result: true });
    } catch (err) {
        logs('error', `快速清理失败：${err.message}`);
        res.status(500).json({ code: 5001039, message: '服务器错误', data: null, result: false });
    }
});
// 删除单个反馈
router.delete('/feedback/:id', async (req, res) => {
    const { id } = req.params;
    const { unit, workshop } = req.admin;
    try {
        const result = await postgresql.query(
            'DELETE FROM feedback WHERE id = $1 AND unit = $2 AND workshop = $3 RETURNING id',
            [id, unit, workshop]
        );
        if (result.rowCount === 0) {
            return res.json({ code: 4001046, message: '反馈不存在或无权限', data: null, result: false });
        }
        logs('info', `删除反馈成功：ID ${id} / 操作者：${req.admin.username} / IP：${req.ip}`);
        res.json({ code: 2001038, message: '删除成功', data: null, result: true });
    } catch (err) {
        logs('error', `删除反馈失败：${err.message}`);
        res.status(500).json({ code: 5001038, message: '服务器错误', data: null, result: false });
    }
});


// ==================== 综合统计 ====================
// GET /statistics/overview
router.get('/statistics/overview', async (req, res) => {
    const { unit, workshop } = req.admin;
    let { startTime, endTime, boxnumber, material_name, team, area } = req.query;
    if (!startTime || !endTime) {
        return res.json({ code: 4001035, message: '请选择时间范围', data: null, result: false });
    }
    let conditions = [`unit = $1`, `workshop = $2`, `usage_time BETWEEN $3 AND $4`];
    let params = [unit, workshop, startTime, endTime];
    let idx = 5;
    if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(parseInt(boxnumber)); }
    if (material_name) { conditions.push(`material_name ILIKE $${idx++}`); params.push(`%${material_name}%`); }
    if (team) { conditions.push(`team ILIKE $${idx++}`); params.push(`%${team}%`); }
    if (area) { conditions.push(`area ILIKE $${idx++}`); params.push(`%${area}%`); }
    const whereClause = conditions.join(' AND ');
    const query = `
        SELECT 
          COALESCE(SUM(quantity),0) as totalQuantity,
          COALESCE(COUNT(DISTINCT material_name),0) as materialTypes,
          COALESCE(COUNT(DISTINCT team),0) as teams,
          COALESCE(COUNT(DISTINCT boxnumber),0) as boxes
        FROM records WHERE ${whereClause}
    `;
    try {
        const result = await postgresql.query(query, params);
        res.json({ code: 2001029, message: '获取统计概览成功', data: result.rows[0], result: true });
    } catch (err) {
        logs('error', `统计概览失败：${err.message}`);
        res.status(500).json({ code: 5001029, message: '服务器错误', data: null, result: false });
    }
});

// GET /statistics/material-summary
router.get('/statistics/material-summary', async (req, res) => {
    const { unit, workshop } = req.admin;
    const { startTime, endTime, boxnumber, area } = req.query;
    if (!startTime || !endTime) {
        return res.json({ code: 4001036, message: '请选择时间范围', data: null, result: false });
    }
    let conditions = [`unit = $1`, `workshop = $2`, `usage_time BETWEEN $3 AND $4`];
    let params = [unit, workshop, startTime, endTime];
    let idx = 5;
    if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(parseInt(boxnumber)); }
    if (area) { conditions.push(`area = $${idx++}`); params.push(area); }
    const whereClause = conditions.join(' AND ');
    const query = `
        SELECT material_name, SUM(quantity) as total_quantity, COUNT(DISTINCT boxnumber) as used_boxes
        FROM records WHERE ${whereClause}
        GROUP BY material_name ORDER BY total_quantity DESC
    `;
    try {
        const result = await postgresql.query(query, params);
        res.json({ code: 2001030, message: '获取物料汇总成功', data: { list: result.rows }, result: true });
    } catch (err) {
        logs('error', `物料汇总失败：${err.message}`);
        res.status(500).json({ code: 5001030, message: '服务器错误', data: null, result: false });
    }
});

// GET /statistics/box-details
router.get('/statistics/box-details', async (req, res) => {
    const { unit, workshop } = req.admin;
    const { startTime, endTime, page = 1, pageSize = 10, boxnumber, material_name, team, area } = req.query;
    if (!startTime || !endTime) {
        return res.json({ code: 4001037, message: '请选择时间范围', data: null, result: false });
    }
    let conditions = [`unit = $1`, `workshop = $2`, `usage_time BETWEEN $3 AND $4`];
    let params = [unit, workshop, startTime, endTime];
    let idx = 5;
    if (boxnumber) { conditions.push(`boxnumber = $${idx++}`); params.push(parseInt(boxnumber)); }
    if (material_name) { conditions.push(`material_name ILIKE $${idx++}`); params.push(`%${material_name}%`); }
    if (team) { conditions.push(`team ILIKE $${idx++}`); params.push(`%${team}%`); }
    if (area) { conditions.push(`area ILIKE $${idx++}`); params.push(`%${area}%`); }
    const whereClause = conditions.join(' AND ');
    try {
        const countRes = await postgresql.query(`SELECT COUNT(*) FROM records WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].count);
        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT id, username, team, boxnumber, material_name, quantity, usage_time, area
            FROM records WHERE ${whereClause}
            ORDER BY usage_time DESC
            LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(parseInt(pageSize), offset);
        const dataRes = await postgresql.query(dataQuery, params);
        res.json({ code: 2001031, message: '获取箱号明细成功', data: { list: dataRes.rows, total }, result: true });
    } catch (err) {
        logs('error', `箱号明细失败：${err.message}`);
        res.status(500).json({ code: 5001031, message: '服务器错误', data: null, result: false });
    }
});

// GET /statistics/trend
router.get('/statistics/trend', async (req, res) => {
    const { unit, workshop } = req.admin;
    const { startTime, endTime, granularity = 'day' } = req.query;
    if (!startTime || !endTime) {
        return res.json({ code: 4001038, message: '请选择时间范围', data: null, result: false });
    }
    const dateFormat = granularity === 'hour' ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD';
    const query = `
        SELECT TO_CHAR(usage_time, '${dateFormat}') as time_point, SUM(quantity) as total_quantity
        FROM records WHERE unit=$1 AND workshop=$2 AND usage_time BETWEEN $3 AND $4
        GROUP BY time_point ORDER BY time_point
    `;
    try {
        const result = await postgresql.query(query, [unit, workshop, startTime, endTime]);
        res.json({ code: 2001032, message: '获取趋势数据成功', data: { list: result.rows }, result: true });
    } catch (err) {
        logs('error', `趋势数据失败：${err.message}`);
        res.status(500).json({ code: 5001032, message: '服务器错误', data: null, result: false });
    }
});

// GET /statistics/box-summary
router.get('/statistics/box-summary', async (req, res) => {
    const { unit, workshop } = req.admin;
    const { startTime, endTime } = req.query;
    if (!startTime || !endTime) {
        return res.json({ code: 4001039, message: '请选择时间范围', data: null, result: false });
    }
    const query = `
        SELECT boxnumber, material_name, SUM(quantity) as total_quantity
        FROM records WHERE unit=$1 AND workshop=$2 AND usage_time BETWEEN $3 AND $4
        GROUP BY boxnumber, material_name ORDER BY boxnumber, total_quantity DESC
    `;
    try {
        const result = await postgresql.query(query, [unit, workshop, startTime, endTime]);
        res.json({ code: 2001033, message: '获取箱号汇总成功', data: { list: result.rows }, result: true });
    } catch (err) {
        logs('error', `箱号汇总失败：${err.message}`);
        res.status(500).json({ code: 5001033, message: '服务器错误', data: null, result: false });
    }
});

// GET /statistics/export-box-summary
// 导出箱号使用汇总（按箱号+物料+区域分组）
router.get('/statistics/export-box-summary', async (req, res) => {
    try {
        const { unit, workshop } = req.admin;
        let { startTime, endTime, boxnumber, material_name, team, area } = req.query;
        if (!startTime || !endTime) {
            return res.json({ code: 4001040, message: '请选择时间范围', data: null, result: false });
        }
        let conditions = [`unit = $1`, `workshop = $2`, `usage_time BETWEEN $3 AND $4`];
        let params = [unit, workshop, startTime, endTime];
        let idx = 5;
        if (boxnumber) {
            conditions.push(`boxnumber = $${idx++}`);
            params.push(parseInt(boxnumber));
        }
        if (material_name) {
            conditions.push(`material_name ILIKE $${idx++}`);
            params.push(`%${material_name}%`);
        }
        if (team) {
            conditions.push(`team ILIKE $${idx++}`);
            params.push(`%${team}%`);
        }
        if (area) {
            conditions.push(`area ILIKE $${idx++}`);
            params.push(`%${area}%`);
        }
        const whereClause = conditions.join(' AND ');
        // 修改点：增加 area 列，并加入 GROUP BY
        const query = `
            SELECT 
                boxnumber AS "箱号",
                material_name AS "物料名称",
                SUM(quantity) AS "使用总数量",
                area AS "区域"          -- 新增区域字段
            FROM records
            WHERE ${whereClause}
            GROUP BY boxnumber, material_name, area   -- 分组增加 area
            ORDER BY boxnumber ASC, "使用总数量" DESC
        `;
        const result = await postgresql.query(query, params);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('箱号使用汇总');
        worksheet.columns = [
            { header: '箱号', key: '箱号', width: 12 },
            { header: '物料名称', key: '物料名称', width: 25 },
            { header: '使用总数量', key: '使用总数量', width: 15 },
            { header: '区域', key: '区域', width: 12 }   // 新增列，放在后面
        ];

        // 表头样式（不变）
        const headerRow = worksheet.getRow(1);
        headerRow.height = 22;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a60b6' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // 数据行（遍历结果时保持顺序）
        result.rows.forEach(row => {
            const dataRow = worksheet.addRow({
                '箱号': row['箱号'],
                '物料名称': row['物料名称'],
                '使用总数量': row['使用总数量'],
                '区域': row['区域'] || ''   // 防止 null
            });
            dataRow.height = 20;
            dataRow.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=box_summary.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        logs('info', `导出材料使用汇总成功 / 操作者：${req.admin.username} / IP：${req.ip}`);
    } catch (err) {
        logs('error', `导出材料使用汇总失败：${err.message}`);
        res.status(500).json({ code: 5001034, message: '导出失败', data: null, result: false });
    }
});

// ==================== 导入（库存、箱号）====================
// POST /inventory/import
// POST /inventory/import - 导入库存（增加物料名称校验）
router.post('/inventory/import', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.json({ code: 4001041, message: '未检测到上传的文件', data: null, result: false });
    }
    const { unit, workshop } = req.admin;
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);
        if (jsonData.length === 0) {
            return res.json({ code: 4001042, message: 'Excel文件内容为空', data: null, result: false });
        }

        // -------- 新增：获取该区域所有有效物料名称 --------
        const classNamesResult = await postgresql.query(
            'SELECT name FROM class WHERE unit = $1 AND workshop = $2',
            [unit, workshop]
        );
        // 使用 Set 提高查找效率
        const validMaterialNames = new Set(classNamesResult.rows.map(row => row.name));
        if (validMaterialNames.size === 0) {
            return res.json({ code: 4001043, message: '当前区域未配置任何物料种类，无法导入', data: null, result: false });
        }
        // -------- 新增结束 --------

        const client = await postgresql.connect();
        try {
            await client.query('BEGIN');
            let insertCount = 0, updateCount = 0, errorCount = 0;
            const errors = [];
            for (const row of jsonData) {
                const boxnumber = row['箱号'] || row['boxnumber'];
                const name = row['物料名称'] || row['name'];
                let Remaining = row['剩余数量'] !== undefined ? row['剩余数量'] : row['Remaining'];
                let quota = row['定额'] !== undefined ? row['定额'] : row['quota'];
                const area = row['区域'] || row['area'];
                let alert_threshold = row['预警阈值'] !== undefined ? row['预警阈值'] : row['alert_threshold'];
                if (!boxnumber || !name || Remaining === undefined || quota === undefined || !area) {
                    errorCount++;
                    errors.push(`行数据缺失必填项: ${JSON.stringify(row)}`);
                    continue;
                }
                const boxNum = parseInt(boxnumber);
                const remainingNum = parseInt(Remaining);
                const quotaNum = parseInt(quota);
                let alertNum = alert_threshold !== undefined ? parseInt(alert_threshold) : null;
                if (isNaN(boxNum) || isNaN(remainingNum) || isNaN(quotaNum)) {
                    errorCount++;
                    errors.push(`数值字段无效: 箱号=${boxnumber}, 剩余数量=${Remaining}, 定额=${quota}`);
                    continue;
                }
                if (alertNum !== null && isNaN(alertNum)) {
                    errorCount++;
                    errors.push(`预警阈值无效: ${alert_threshold}`);
                    continue;
                }

                // -------- 新增：物料名称校验 --------
                if (!validMaterialNames.has(name)) {
                    errorCount++;
                    errors.push(`物料名称 "${name}" 不在当前区域的物料种类列表中，请先添加该物料种类`);
                    continue;
                }
                // -------- 新增结束 --------

                try {
                    // 检查库存记录是否存在（箱号 + 物料 + 单位 + 车间）
                    const checkRes = await client.query(
                        'SELECT id, alert_threshold FROM inventory WHERE boxnumber=$1 AND name=$2 AND unit=$3 AND workshop=$4',
                        [boxNum, name, unit, workshop]
                    );
                    if (checkRes.rows.length > 0) {
                        // 更新：保留原预警阈值，若新值有效则覆盖
                        const finalAlert = alertNum !== null ? alertNum : checkRes.rows[0].alert_threshold;
                        await client.query(
                            'UPDATE inventory SET "Remaining"=$1, quota=$2, area=$3, alert_threshold=$4 WHERE id=$5',
                            [remainingNum, quotaNum, area, finalAlert, checkRes.rows[0].id]
                        );
                        updateCount++;
                    } else {
                        // 新增：预警阈值必须提供
                        if (alertNum === null) {
                            errorCount++;
                            errors.push(`新增记录必须提供预警阈值: 箱号 ${boxNum}, 物料 ${name}`);
                            continue;
                        }
                        await client.query(
                            `INSERT INTO inventory (boxnumber, name, "Remaining", quota, unit, workshop, area, alert_threshold)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                            [boxNum, name, remainingNum, quotaNum, unit, workshop, area, alertNum]
                        );
                        insertCount++;
                    }
                } catch (err) {
                    errorCount++;
                    errors.push(`处理失败 (箱号 ${boxNum}, 物料 ${name}): ${err.message}`);
                }
            }
            await client.query('COMMIT');
            logs('info', `导入库存数据完成。新增 ${insertCount} 条，更新 ${updateCount} 条，失败 ${errorCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
            res.json({
                code: 2001035,
                message: `导入完成。新增 ${insertCount} 条，更新 ${updateCount} 条，失败 ${errorCount} 条`,
                data: { insertCount, updateCount, errorCount, errors: errors.slice(0, 20) },
                result: true
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        logs('error', `导入库存数据失败：${err.message}`);
        res.status(500).json({ code: 5001035, message: '导入处理失败: ' + err.message, data: null, result: false });
    }
});


// POST /boxlist/import
router.post('/boxlist/import', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.json({ code: 4001043, message: '未检测到上传的文件', data: null, result: false });
    }
    const { unit, workshop } = req.admin;
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);
        if (jsonData.length === 0) {
            return res.json({ code: 4001044, message: 'Excel文件内容为空', data: null, result: false });
        }
        const client = await postgresql.connect();
        try {
            await client.query('BEGIN');
            let insertCount = 0, updateCount = 0, errorCount = 0;
            const errors = [];
            for (const row of jsonData) {
                const boxnumber = row['箱号'] || row['boxnumber'];
                const area = row['区域'] || row['area'];
                const location = row['位置'] || row['location'];
                if (!boxnumber || !area || !location) {
                    errorCount++;
                    errors.push(`行数据缺失必填项: ${JSON.stringify(row)}`);
                    continue;
                }
                const boxNum = parseInt(boxnumber);
                if (isNaN(boxNum)) {
                    errorCount++;
                    errors.push(`箱号无效: ${boxnumber}`);
                    continue;
                }
                const checkRes = await client.query(
                    'SELECT id FROM boxlist WHERE boxnumber=$1 AND unit=$2 AND workshop=$3 AND area=$4',
                    [boxNum, unit, workshop, area]
                );
                if (checkRes.rows.length > 0) {
                    await client.query('UPDATE boxlist SET location=$1 WHERE id=$2', [location, checkRes.rows[0].id]);
                    updateCount++;
                } else {
                    await client.query(
                        'INSERT INTO boxlist (boxnumber, unit, workshop, area, location) VALUES ($1,$2,$3,$4,$5)',
                        [boxNum, unit, workshop, area, location]
                    );
                    insertCount++;
                }
            }
            await client.query('COMMIT');
            logs('info', `导入箱号完成。新增 ${insertCount} 条，更新 ${updateCount} 条，失败 ${errorCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
            res.json({
                code: 2001036,
                message: `导入完成。新增 ${insertCount} 条，更新 ${updateCount} 条，失败 ${errorCount} 条`,
                data: { insertCount, updateCount, errorCount, errors: errors.slice(0, 20) },
                result: true
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        logs('error', `导入箱号失败：${err.message}`);
        res.status(500).json({ code: 5001036, message: '导入处理失败', data: null, result: false });
    }
});
// ==================== 用户导入 ====================
// POST /admin/users/import - 批量导入员工
router.post('/users/import', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.json({ code: 4001047, message: '未检测到上传的文件', data: null, result: false });
    }
    const { unit, workshop } = req.admin;
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);
        if (jsonData.length === 0) {
            return res.json({ code: 4001048, message: 'Excel文件内容为空', data: null, result: false });
        }

        const client = await postgresql.connect();
        try {
            await client.query('BEGIN');
            let insertCount = 0, errorCount = 0;
            const errors = [];

            for (const row of jsonData) {
                // 解析字段（支持中文列名和英文字段名）
                const username = row['员工编号'] || row['username'];
                const name = row['姓名'] || row['name'];
                const identity = row['身份'] !== undefined ? parseInt(row['身份']) : 0;
                const area = row['区域'] || row['area'];
                const team = row['班组'] || row['team'];

                // 校验必填项
                if (!username || !name || !area || !team) {
                    errorCount++;
                    errors.push(`行数据缺失必填项: ${JSON.stringify(row)}`);
                    continue;
                }

                // 校验员工编号长度
                if (username.length > 10) {
                    errorCount++;
                    errors.push(`员工编号 "${username}" 不能超过10个字符`);
                    continue;
                }

                // 校验身份值是否合法
                if (![0, 1, 2].includes(identity)) {
                    errorCount++;
                    errors.push(`身份值 "${identity}" 无效，必须为0(普通),1(班组长),2(管理员)`);
                    continue;
                }

                try {
                    // 检查用户是否已存在
                    const checkRes = await client.query(
                        'SELECT id FROM users WHERE username = $1',
                        [username]
                    );
                    if (checkRes.rows.length > 0) {
                        errorCount++;
                        errors.push(`员工编号 "${username}" 已存在，跳过`);
                        continue;
                    }

                    // 插入新用户（security_pin 设置为 NULL，管理员需手动设置）
                    await client.query(
                        `INSERT INTO users (username, name, identity, unit, workshop, area, team, security_pin)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
                        [username, name, identity, unit, workshop, area, team]
                    );
                    insertCount++;
                } catch (err) {
                    errorCount++;
                    errors.push(`处理失败 (员工编号 ${username}): ${err.message}`);
                }
            }

            await client.query('COMMIT');
            logs('info', `导入员工数据完成。新增 ${insertCount} 条，失败 ${errorCount} 条 / 操作者：${req.admin.username} / IP：${req.ip}`);
            res.json({
                code: 2001003,
                message: `导入完成。新增 ${insertCount} 条，失败 ${errorCount} 条`,
                data: { successCount: insertCount, errorCount, errors: errors.slice(0, 20) },
                result: true
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        logs('error', `导入员工数据失败：${err.message}`);
        res.status(500).json({ code: 5001003, message: '导入处理失败: ' + err.message, data: null, result: false });
    }
});
export default router;