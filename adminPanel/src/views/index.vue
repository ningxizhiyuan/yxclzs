<template>
  <div class="dashboard-container">
    <!-- 上半部分：功能快捷入口 -->
    <el-row :gutter="20" class="function-section">
      <el-col :xs="12" :sm="8" :md="6" :lg="4" v-for="(item, index) in functionList" :key="index" class="col-gap-fix">
        <el-card shadow="hover" class="function-card" @click="handleNav(item.path)">
          <div class="card-content">
            <div class="icon-box" :style="{ backgroundColor: item.color + '20', color: item.color }">
              <component :is="item.icon" />
            </div>
            <div class="info">
              <span class="title">{{ item.title }}</span>
              <span class="desc">{{ item.desc }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 下半部分：左右布局监控区 -->
    <el-row :gutter="20" class="monitor-section">
      <!-- 左侧：库存预警 -->
      <el-col :xs="24" :lg="12" class="col-gap-fix">
        <el-card class="monitor-card">
          <template #header>
            <div class="card-header">
              <span class="header-title"><el-icon color="#1a60b6"><Warning /></el-icon>库存预警</span>
              <el-button type="primary" link @click="router.push('/warning')">查看更多</el-button>
            </div>
          </template>
          <el-scrollbar class="table-scroll-container">
            <el-table :data="warningList" v-loading="warningLoading" style="width: 100%" class="warning-table" :show-header="true">
              <el-table-column prop="boxNo" label="箱号" width="70" />
              <el-table-column prop="name" label="材料名称" min-width="100" />
              <el-table-column prop="stock" label="剩余" width="60" />
              <el-table-column prop="status" label="状态" width="90">
                <template #default="scope"><el-tag type="danger" effect="light" size="small">{{ scope.row.status }}</el-tag></template>
              </el-table-column>
            </el-table>
          </el-scrollbar>
        </el-card>
      </el-col>

      <!-- 右侧：现场反馈 -->
      <el-col :xs="24" :lg="12" class="col-gap-fix">
        <el-card class="monitor-card">
          <template #header>
            <div class="card-header">
              <span class="header-title"><el-icon color="#1a60b6"><ChatDotRound /></el-icon>现场反馈</span>
              <el-button type="primary" link @click="router.push('/feedback')">查看更多</el-button>
            </div>
          </template>
          <el-scrollbar class="table-scroll-container">
            <el-table :data="feedbackList" v-loading="feedbackLoading" style="width: 100%" class="feedback-table" highlight-current-row :show-header="true" @row-click="openDetail">
              <el-table-column prop="content" label="反馈内容" min-width="120">
                <template #default="scope"><span class="feedback-text">{{ scope.row.content }}</span></template>
              </el-table-column>
              <el-table-column prop="time" label="时间" width="80">
                <template #default="scope"><span class="time-text">{{ scope.row.time }}</span></template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="80">
                <template #default="scope"><el-tag :type="scope.row.status === '已处理' ? 'success' : 'warning'" size="small">{{ scope.row.status }}</el-tag></template>
              </el-table-column>
            </el-table>
          </el-scrollbar>
        </el-card>
      </el-col>
    </el-row>

    <!-- 反馈详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="反馈详情" width="520px" :close-on-click-modal="false" class="feedback-dialog">
      <div class="feedback-detail">
        <div class="detail-item">
          <div class="detail-icon"><el-icon><Box /></el-icon></div>
          <div class="detail-content"><div class="detail-label">箱号</div><div class="detail-value">{{ currentFeedback.boxnumber }}</div></div>
        </div>
        <div class="detail-item">
          <div class="detail-icon"><el-icon><ChatDotRound /></el-icon></div>
          <div class="detail-content">
            <div class="detail-label">反馈类型</div>
            <div class="detail-value"><el-tag :type="currentFeedback.type === 'shortage' ? 'danger' : (currentFeedback.type === 'damage' ? 'warning' : 'info')" size="small">{{ currentFeedback.typeText }}</el-tag></div>
          </div>
        </div>
        <div class="detail-item">
          <div class="detail-icon"><el-icon><Document /></el-icon></div>
          <div class="detail-content"><div class="detail-label">详细描述</div><div class="detail-value description">{{ currentFeedback.description }}</div></div>
        </div>
        <div class="detail-item">
          <div class="detail-icon"><el-icon><Clock /></el-icon></div>
          <div class="detail-content"><div class="detail-label">反馈时间</div><div class="detail-value">{{ formatLocalTime(currentFeedback.created_at, 'short') }}</div></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleConfirmResolve" :loading="resolving">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Box, ShoppingCart, Document, TrendCharts, Setting, User, Warning, ChatDotRound, Clock } from '@element-plus/icons-vue'
import request from '@/api/request'
import { formatLocalTime, formatRelativeTime } from '@/api/date'

const router = useRouter()
const functionList = [
  { title: '料箱管理', desc: '箱子增删改查', icon: ShoppingCart, path: '/boxlist', color: '#1a60b6' },
  { title: '库存管理', desc: '统一库存调配', icon: Box, path: '/inventory', color: '#67c23a' },
  { title: '物料种类', desc: '材料分类维护', icon: Document, path: '/types', color: '#e6a23c' },
  { title: '预警查询', desc: '低库/过期监控', icon: Warning, path: '/warning', color: '#f56c6c' },
  { title: '现场反馈', desc: '问题上报处理', icon: ChatDotRound, path: '/feedback', color: '#409eff' },
  { title: '综合统计', desc: '多维数据分析', icon: TrendCharts, path: '/stats', color: '#909399' },
  { title: '人员管理', desc: '账号权限配置', icon: User, path: '/user', color: '#606266' },
]

// 库存预警
const warningList = ref([])
const warningLoading = ref(false)
const fetchWarningList = async () => {
  warningLoading.value = true
  try {
    const res = await request.get('/admin/inventory/warnings', { params: { limit: 20 } })
    if (res.result === true) {
      warningList.value = (res.data.list || []).map(item => ({
        boxNo: item.boxnumber,
        name: item.name,
        stock: item.Remaining,
        status: '库存不足'
      }))
    }
  } catch (error) { console.error(error) }
  finally { warningLoading.value = false }
}

// 现场反馈
const feedbackList = ref([])
const feedbackLoading = ref(false)
const detailDialogVisible = ref(false)
const currentFeedback = ref({})
const resolving = ref(false)
const typeMap = { shortage: '材料不足', damage: '材料破损', other: '其他问题' }

const fetchPendingFeedbacks = async () => {
  feedbackLoading.value = true
  try {
    const res = await request.get('/admin/feedback/pending', { params: { limit: 20 } })
    if (res.result === true) {
      feedbackList.value = (res.data.list || []).map(item => ({
        id: item.id,
        boxnumber: item.boxnumber,
        type: item.type,
        typeText: typeMap[item.type] || item.type,
        description: item.description,
        content: item.description,
        time: formatRelativeTime(item.created_at),
        status: item.status === 'pending' ? '待处理' : '已处理',
        created_at: item.created_at
      }))
    }
  } catch (error) { ElMessage.error('获取反馈列表失败') }
  finally { feedbackLoading.value = false }
}

const openDetail = (row) => {
  currentFeedback.value = { ...row }
  detailDialogVisible.value = true
}

const handleConfirmResolve = async () => {
  resolving.value = true
  try {
    const res = await request.put(`/admin/feedback/${currentFeedback.value.id}/resolve`)
    if (res.result === true) {
      ElMessage.success('已标记为已处理')
      detailDialogVisible.value = false
      await fetchPendingFeedbacks()
    } else ElMessage.error(res.message || '操作失败')
  } catch (error) { ElMessage.error('网络错误') }
  finally { resolving.value = false }
}

const handleNav = (path) => { if (path) router.push(path) }

onMounted(() => {
  fetchWarningList()
  fetchPendingFeedbacks()
})
</script>

<style scoped>
.dashboard-container { padding: 10px; }
.col-gap-fix { margin-bottom: 20px; }
.function-section { margin-bottom: 0; }
.function-card { cursor: pointer; transition: all 0.3s; border: none; height: 100%; border-radius: 12px; }
.function-card:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(26,96,182,0.15) !important; }
.card-content { display: flex; align-items: center; gap: 15px; padding: 15px 10px; }
.icon-box { width: 52px; height: 52px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 26px; flex-shrink: 0; }
.info { display: flex; flex-direction: column; }
.info .title { font-size: 16px; font-weight: bold; color: #303133; }
.info .desc { font-size: 12px; color: #909399; margin-top: 4px; }
.monitor-section { margin-top: 0; }
.monitor-card { height: 450px; display: flex; flex-direction: column; border-radius: 12px; }
:deep(.el-card__body) { flex: 1; overflow: hidden; padding: 0; display: flex; flex-direction: column; }
.table-scroll-container { flex: 1; }
:deep(.el-scrollbar__bar.is-vertical) { opacity: 0; transition: opacity 0.3s; width: 6px !important; }
:deep(.el-scrollbar__thumb) { background-color: #dcdfe6; }
.table-scroll-container:hover :deep(.el-scrollbar__bar.is-vertical) { opacity: 1; }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; flex-shrink: 0; }
.header-title { display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 16px; color: #303133; }
:deep(.el-table th.el-table__cell), :deep(.el-table td.el-table__cell) { padding: 8px 0; }
:deep(.el-table th.el-table__cell) { background-color: #f5f7fa; color: #606266; font-weight: 600; font-size: 13px; position: sticky; top: 0; z-index: 2; box-shadow: 0 1px 0 #ebeef5; }
:deep(.el-table__row) { height: 48px; cursor: pointer; }
.box-no, .material-name, .stock-num, .feedback-text, .time-text { font-size: 13px; }
.feedback-table :deep(.el-table__row):hover { background-color: #f5f7fa; }
.feedback-text { color: #606266; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 100%; cursor: pointer; }
.time-text { color: #909399; }
.feedback-dialog :deep(.el-dialog__header) { background-color: #f5f7fa; border-bottom: 1px solid #e4e7ed; padding: 16px 20px; }
.feedback-dialog :deep(.el-dialog__title) { font-size: 16px; font-weight: 600; color: #303133; }
.feedback-dialog :deep(.el-dialog__body) { padding: 24px 20px; }
.feedback-detail { display: flex; flex-direction: column; gap: 20px; }
.detail-item { display: flex; align-items: flex-start; gap: 16px; }
.detail-icon { width: 32px; height: 32px; background-color: #ecf5ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1a60b6; font-size: 16px; flex-shrink: 0; }
.detail-content { flex: 1; }
.detail-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.detail-value { font-size: 14px; color: #303133; font-weight: 500; word-break: break-word; }
.detail-value.description { background-color: #f5f7fa; padding: 10px 12px; border-radius: 8px; font-weight: normal; line-height: 1.5; color: #606266; }
</style>