import express from 'express'
import 'dotenv/config';
import cors from 'cors';
import { logs } from './api/logs.js'
import { postgresql } from './api/database.js'
import normalRouter from './router/normal.js'
import adminRouter from './router/admin.js'
import userRouter from './router/user.js'
import { userAuth } from './mid/userAuth.js';
import { adminAuth } from './mid/adminAuth.js';
const service = express();
service.use(cors());
service.disable('x-powered-by');
service.set('trust proxy', true);
service.use(express.json());
service.use(express.urlencoded({ extended: true }));

service.use('/normal', normalRouter);
service.use('/admin',adminAuth , adminRouter);
service.use('/user', userAuth, userRouter);



service.listen(process.env.SERVICE_PORT, () => logs("", `宁溪致远材料助手后端服务器启动成功！ 运行端口： http://localhost:${process.env.SERVICE_PORT}`));