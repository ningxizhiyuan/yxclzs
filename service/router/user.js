import express from 'express';
import jwt from 'jsonwebtoken';
import { postgresql } from '../api/database.js';
import { logs } from '../api/logs.js';

const router = express.Router();
router.get('/verify', async (req, res) => { 
        return res.json({
            code: 2000001,
            message: '已登录',
            data: null,
            result: true,
        });
});

router.post('/boxlist', async (req, res) => {
    const { unit, workshop, area } = req.user;

    // 【优化点】参数校验：检查所有必要参数
    if (!unit || !workshop || !area) {
        return res.json({
            code: 4000003,
            message: '参数缺失',
            data: null,
            result: false
        });
    }

    try {
        const queryText = 'SELECT id , boxnumber, location FROM boxlist WHERE unit = $1 AND workshop = $2 AND area = $3';

        const result = await postgresql.query(queryText, [unit, workshop, area]);

        if (result.rows.length > 0) {
            res.json({
                code: 2000003,
                message: '查询成功',
                data: result.rows,
                result: true
            });
        } else {
            res.json({
                code: 4000003,
                message: '暂无数据',
                data: null,
                result: false
            });
        }
    } catch (error) {
        logs('error', `数据库查询错误: ${error.message}`);
        res.status(500).json({
            code: 5000003,
            message: '服务器错误',
            data: null,
            result: false
        });
    }
});


router.post('/class', async (req, res) => {
    const { unit, workshop, area } = req.user;
    if (!unit || !workshop || !area) {
        return res.json({
            code: 4000004,
            message: '参数缺失',
            data: null,
            result: false
        });
    }
    try {
        const queryText = 'SELECT id , name  FROM class WHERE unit = $1 AND workshop = $2 AND area = $3';
        const result = await postgresql.query(queryText, [unit, workshop, area]);
        if (result.rows.length > 0) {
            res.json({
                code: 2000004,
                message: '查询成功',
                data: result.rows,
                result: true
            });
        } else {
            res.json({
                code: 4000004,
                message: '暂无数据',
                data: null,
                result: false
            });
        }
    } catch (error) {
        logs('error', `数据库查询错误: ${error.message}`);
        res.status(500).json({
            code: 5000004,
            message: '服务器错误',
            data: null,
            result: false
        });
    }

});

router.post('/inventory', async (req, res) => {
    // 1. 从 JWT 获取用户归属信息 (用于数据权限隔离)
    const { unit, workshop, area } = req.user;
    
    // 2. 从请求体获取箱号
    const { boxnumber } = req.body; 

    // 3. 参数校验
    if (!unit || !workshop || !area) {
        return res.json({
            code: 4000005,
            message: '用户身份信息缺失',
            data: null,
            result: false
        });
    }

    if (!boxnumber) {
        return res.json({
            code: 4000005,
            message: '箱号不能为空',
            data: null,
            result: false
        });
    }

    try {
        // 4. 构建查询 SQL
        const queryText = 'SELECT id, name, "Remaining", quota FROM "inventory" WHERE "boxnumber" = $1 AND "unit" = $2 AND "workshop" = $3 AND "area" = $4';
        
        const result = await postgresql.query(queryText, [boxnumber, unit, workshop, area]);

        if (result.rows.length > 0) {
            res.json({
                code: 2000005,
                message: '查询成功',
                data: result.rows,
                result: true
            });
        } else {
            res.json({
                code: 4000005,
                message: '该箱子暂无库存记录',
                data: [],
                result: false
            });
        }
    } catch (error) {
        logs('error', `库存查询错误: ${error.message}`);
        res.status(500).json({
            code: 5000005,
            message: '服务器错误',
            data: null,
            result: false
        });
    }
});

router.post('/feedback', async (req, res) => {
    // 1. 从 JWT 获取用户归属信息
    const { unit, workshop, area } = req.user;
    
    // 2. 从请求体获取表单数据 (移除了 materialName 和 shortAmount)
    const { boxnumber, type, description } = req.body;

    // 3. 参数校验
    if (!unit || !workshop || !area) {
        return res.json({
            code: 4000006,
            message: '用户身份信息缺失',
            data: null,
            result: false
        });
    }

    // 只校验 boxnumber, type, description
    if (!boxnumber || !type || !description) {
        return res.json({
            code: 4000006,
            message: '必填参数缺失',
            data: null,
            result: false
        });
    }

    // 校验反馈类型是否合法
    const validTypes = ['shortage', 'damage', 'other'];
    if (!validTypes.includes(type)) {
        return res.json({
            code: 4000006,
            message: '无效的反馈类型',
            data: null,
            result: false
        });
    }

    try {
        // 4. 构建插入 SQL (移除了 material_name 和 short_amount)
        const queryText = `
            INSERT INTO "feedback" 
            ("boxnumber", "type", "description", "unit", "workshop", "area") 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id, created_at
        `;
        
        const values = [
            boxnumber,
            type,
            description,
            unit,
            workshop,
            area
        ];

        const result = await postgresql.query(queryText, values);

        if (result.rows.length > 0) {
            res.json({
                code: 2000006,
                message: '反馈提交成功',
                data: {
                    id: result.rows[0].id,
                    createdAt: result.rows[0].created_at
                },
                result: true
            });
        } else {
            throw new Error('Insert failed');
        }

    } catch (error) {
        logs('error', `反馈提交错误: ${error.message}`);
        res.status(500).json({
            code: 5000006,
            message: '服务器错误',
            data: null,
            result: false
        });
    }
});

// 1. 材料使用上报（扣减库存 + 插入记录）
router.post('/material/report', async (req, res) => {
    const { username, unit, workshop, area, team } = req.user;
    const { boxnumber, materialName, quantity, usageTime } = req.body;

    // 参数校验
    if (!boxnumber || !materialName || !quantity || !usageTime) {
        return res.json({ code: 4000007, message: '参数缺失', data: null, result: false });
    }
    if (quantity <= 0) {
        return res.json({ code: 4000007, message: '数量必须大于0', data: null, result: false });
    }

    const client = await postgresql.connect();
    try {
        await client.query('BEGIN');

        // 锁定并查询当前库存（防止超卖）
        const inventoryQuery = `
            SELECT "Remaining", quota FROM "inventory"
            WHERE "boxnumber" = $1 AND "name" = $2 AND "unit" = $3 AND "workshop" = $4 AND "area" = $5
            FOR UPDATE
        `;
        const invResult = await client.query(inventoryQuery, [boxnumber, materialName, unit, workshop, area]);
        if (invResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json({ code: 4000007, message: '该箱子内无此材料', data: null, result: false });
        }
        const { Remaining } = invResult.rows[0];
        if (Remaining < quantity) {
            await client.query('ROLLBACK');
            return res.json({ code: 4000007, message: '库存不足', data: null, result: false });
        }

        // 扣减库存
        const updateInventory = `
            UPDATE "inventory" SET "Remaining" = "Remaining" - $1
            WHERE "boxnumber" = $2 AND "name" = $3 AND "unit" = $4 AND "workshop" = $5 AND "area" = $6
        `;
        await client.query(updateInventory, [quantity, boxnumber, materialName, unit, workshop, area]);

        // 插入使用记录（包含 area 字段）
        const insertRecord = `
            INSERT INTO "records"
            ("username", "unit", "workshop", "area", "team", "boxnumber", "material_name", "quantity", "usage_time")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(insertRecord, [username, unit, workshop, area, team, boxnumber, materialName, quantity, new Date(usageTime)]);

        await client.query('COMMIT');
        res.json({ code: 2000007, message: '上报成功', data: null, result: true });
    } catch (error) {
        await client.query('ROLLBACK');
        logs('error', `上报错误: ${error.message}`);
        res.status(500).json({ code: 5000007, message: '服务器错误', data: null, result: false });
    } finally {
        client.release();
    }
});

// 2. 获取班次内材料统计（按材料分组汇总）
router.post('/material/statistics', async (req, res) => {
    const { username, unit, workshop, area, team, identity } = req.user;
    const { shiftStart, shiftEnd } = req.body;

    if (!shiftStart || !shiftEnd) {
        return res.json({ code: 4000008, message: '班次时间范围缺失', data: null, result: false });
    }

    try {
        const startDate = new Date(parseInt(shiftStart));
        const endDate = new Date(parseInt(shiftEnd));

        // 构建基础查询条件
        let baseConditions = `
            unit = $1 
            AND workshop = $2 
            AND area = $3 
            AND team = $4 
            AND usage_time >= $5 
            AND usage_time <= $6
        `;
        let params = [unit, workshop, area, team, startDate, endDate];
        let usernameCondition = '';

        // 班组长（identity === 1）查询全班组成员；普通用户（identity === 0）查询自己
        if (identity === 1) {
            // 班组长：不加 username 过滤，全班组成员
            usernameCondition = '';
        } else {
            // 普通用户：加上 username 过滤
            usernameCondition = ' AND username = $7';
            params.push(username);
        }

        const query = `
            SELECT 
                material_name, 
                SUM(quantity) as total_quantity
            FROM records
            WHERE ${baseConditions} ${usernameCondition}
            GROUP BY material_name
            ORDER BY total_quantity DESC
        `;
        const result = await postgresql.query(query, params);

        const stats = result.rows.map(row => ({
            materialName: row.material_name,
            totalQuantity: parseInt(row.total_quantity)
        }));

        res.json({ code: 2000008, message: '查询成功', data: stats, result: true });
    } catch (error) {
        logs('error', `统计错误: ${error.message}`);
        res.status(500).json({ code: 5000008, message: '服务器错误', data: null, result: false });
    }
});

// 3. 获取特定材料明细（箱子汇总 + 记录列表）
router.post('/material/details', async (req, res) => {
    const { username, unit, workshop, area, team, identity } = req.user;
    const { materialName, shiftStart, shiftEnd } = req.body;

    if (!materialName || !shiftStart || !shiftEnd) {
        return res.json({ code: 4000008, message: '参数缺失', data: null, result: false });
    }

    try {
        const startDate = new Date(parseInt(shiftStart));
        const endDate = new Date(parseInt(shiftEnd));

        // 公共基础条件
        let baseConditions = `
            r.unit = $1 
            AND r.workshop = $2 
            AND r.area = $3 
            AND r.team = $4 
            AND r.material_name = $5 
            AND r.usage_time >= $6 
            AND r.usage_time <= $7
        `;
        let params = [unit, workshop, area, team, materialName, startDate, endDate];
        let usernameCondition = '';
        let usernameParamIndex = params.length + 1;

        if (identity === 1) {
            usernameCondition = '';
        } else {
            usernameCondition = ' AND r.username = $' + usernameParamIndex;
            params.push(username);
        }

        // 箱子汇总
        const summaryQuery = `
            SELECT 
                r.boxnumber,
                b.location as box_name,
                SUM(r.quantity) as quantity
            FROM records r
            LEFT JOIN boxlist b ON r.boxnumber = b.boxnumber 
                AND b.unit = r.unit 
                AND b.workshop = r.workshop 
                AND b.area = r.area
            WHERE ${baseConditions} ${usernameCondition}
            GROUP BY r.boxnumber, b.location
            ORDER BY r.boxnumber
        `;
        const summaryResult = await postgresql.query(summaryQuery, params);
        const boxSummary = summaryResult.rows.map(item => ({
            boxId: item.boxnumber,
            boxName: item.box_name || `箱号${item.boxnumber}`,
            quantity: parseInt(item.quantity)
        }));

        // 记录明细列表（添加 boxnumber 字段）
        const detailsQuery = `
            SELECT 
                r.boxnumber,
                b.location as box_name,
                r.material_name,
                r.quantity,
                r.usage_time,
                r.username as worker_id
            FROM records r
            LEFT JOIN boxlist b ON r.boxnumber = b.boxnumber 
                AND b.unit = r.unit 
                AND b.workshop = r.workshop 
                AND b.area = r.area
            WHERE ${baseConditions} ${usernameCondition}
            ORDER BY r.usage_time ASC
        `;
        const detailsResult = await postgresql.query(detailsQuery, params);
        const detailList = detailsResult.rows.map(row => ({
            boxNumber: row.boxnumber,        // 新增箱号字段
            boxName: row.box_name || `箱号${row.boxnumber}`,
            materialName: row.material_name,
            workerId: row.worker_id,
            changeTime: row.usage_time.getTime(),
            quantity: row.quantity
        }));

        res.json({
            code: 2000008,
            message: '查询成功',
            data: { boxSummary, detailList },
            result: true
        });
    } catch (error) {
        logs('error', `明细查询错误: ${error.message}`);
        res.status(500).json({ code: 5008001, message: '服务器错误', data: null, result: false });
    }
});




/**
 * 更新库存（管理员专用）
 * POST /user/inventory/update
 * 请求体：{ boxnumber, updates: [{ materialId, newRemaining }] }
 * 权限：仅 identity === 2 的管理员
 */
router.post('/inventory/update', async (req, res) => {
  const { unit, workshop, area, identity, username } = req.user;
  const { boxnumber, updates, security_pin } = req.body; // 从请求体获取 PIN

  // 1. 身份校验
  if (identity !== 2) {
    return res.json({ code: 4030001, message: '权限不足，仅管理员可修改库存', data: null, result: false });
  }

  // 2. 参数校验
  if (!boxnumber || !updates || !Array.isArray(updates) || updates.length === 0) {
    return res.json({ code: 4000009, message: '参数缺失或无效', data: null, result: false });
  }
  for (const item of updates) {
    if (!item.materialId || typeof item.newRemaining !== 'number' || item.newRemaining < 0) {
      return res.json({ code: 4000009, message: '更新数据格式错误，需要 materialId 和 newRemaining（>=0）', data: null, result: false });
    }
  }
  if (!security_pin) {
    return res.json({ code: 4000009, message: '请输入安全PIN码', data: null, result: false });
  }

  const client = await postgresql.connect();
  try {
    await client.query('BEGIN');

    // 3. 验证箱子归属
    const boxCheck = await client.query(
      'SELECT id FROM boxlist WHERE boxnumber = $1 AND unit = $2 AND workshop = $3 AND area = $4',
      [boxnumber, unit, workshop, area]
    );
    if (boxCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ code: 4000009, message: '该箱子不属于您的管辖区域', data: null, result: false });
    }

    // 4. 验证管理员 PIN 码（明文比对）
    const userResult = await client.query(
      'SELECT security_pin FROM users WHERE username = $1 AND unit = $2 AND workshop = $3 AND identity = 2',
      [username, unit, workshop]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].security_pin) {
      await client.query('ROLLBACK');
      return res.json({ code: 4030002, message: '管理员未设置安全PIN码，请联系系统管理员', data: null, result: false });
    }
    const storedPin = userResult.rows[0].security_pin;
    if (storedPin !== security_pin) {
      await client.query('ROLLBACK');
      return res.json({ code: 4030002, message: '安全PIN码错误', data: null, result: false });
    }

    // 5. 执行更新
    const updatePromises = updates.map(async (item) => {
      // 检查材料是否属于该箱子
      const materialCheck = await client.query(
        `SELECT id, "Remaining" FROM inventory 
         WHERE id = $1 AND boxnumber = $2 AND unit = $3 AND workshop = $4 AND area = $5`,
        [item.materialId, boxnumber, unit, workshop, area]
      );
      if (materialCheck.rows.length === 0) {
        throw new Error(`材料 ID ${item.materialId} 不在该箱子下或不属于您的区域`);
      }
      // 更新
      await client.query(
        `UPDATE inventory SET "Remaining" = $1 WHERE id = $2`,
        [item.newRemaining, item.materialId]
      );
    });
    await Promise.all(updatePromises);

    await client.query('COMMIT');

    logs('info', `管理员 ${username} 修改了箱子 ${boxnumber} 的库存，更新 ${updates.length} 项，IP：${req.ip}`);

    res.json({
      code: 2000009,
      message: '库存更新成功',
      data: { updatedCount: updates.length },
      result: true
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logs('error', `更新库存失败：${error.message}`);
    res.status(500).json({
      code: 5000009,
      message: error.message || '服务器错误',
      data: null,
      result: false
    });
  } finally {
    client.release();
  }
});
export default router;