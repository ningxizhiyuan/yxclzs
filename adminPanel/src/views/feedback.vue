<template>
  <div class="feedback-management">
    <!-- 搜索筛选区域 -->
    <el-card class="search-card" shadow="never">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="箱号"><el-input v-model="searchForm.boxnumber" placeholder="请输入箱号" clearable style="width:150px" /></el-form-item>
        <el-form-item label="反馈类型"><el-select v-model="searchForm.type" placeholder="请选择类型" clearable style="width:120px"><el-option label="材料不足" value="shortage" /><el-option label="材料破损" value="damage" /><el-option label="其他问题" value="other" /></el-select></el-form-item>
        <el-form-item label="处理状态"><el-select v-model="searchForm.status" placeholder="请选择状态" clearable style="width:120px"><el-option label="待处理" value="pending" /><el-option label="已处理" value="resolved" /></el-select></el-form-item>
        <el-form-item label="反馈时间"><el-date-picker v-model="searchForm.dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:240px" /></el-form-item>
        <el-form-item><el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button><el-button :icon="Refresh" @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </el-card>

    <!-- 操作按钮区域 -->
    <el-card class="operation-card" shadow="never">
      <div class="operation-buttons">
        <div class="btn-left">
          <el-button type="primary" :icon="Refresh" @click="fetchFeedbackList">刷新</el-button>
          <el-button type="success" :icon="CircleCheck" @click="handleBatchResolve" :disabled="selectedRows.length === 0 || !selectedRows.some(r => r.status === 'pending')">批量处理</el-button>
          <el-button type="danger" :icon="Delete" @click="handleBatchDelete" :disabled="selectedRows.length === 0 || !selectedRows.some(r => r.status === 'resolved')">批量删除</el-button>
          <el-button type="warning" :icon="Delete" @click="handleCleanResolved">快速清理</el-button>
        </div>
        <div class="btn-right">
          <el-button type="info" :icon="Download" @click="handleExport">导出</el-button>
        </div>
      </div>
    </el-card>

    <!-- 表格区域 -->
    <el-card class="table-card" shadow="never">
      <el-table :data="tableData" v-loading="loading" border stripe @selection-change="handleSelectionChange" row-key="id">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="boxnumber" label="箱号" width="120" />
        <el-table-column prop="typeText" label="反馈类型" width="100"><template #default="{ row }"><el-tag :type="row.type==='shortage'?'danger':(row.type==='damage'?'warning':'info')" size="small">{{ row.typeText }}</el-tag></template></el-table-column>
        <el-table-column prop="description" label="反馈内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="area" label="区域" width="100" />
        <el-table-column prop="status" label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status==='pending'?'warning':'success'" size="small">{{ row.status==='pending'?'待处理':'已处理' }}</el-tag></template></el-table-column>
        <el-table-column prop="created_at" label="反馈时间" width="160"><template #default="{ row }">{{ formatLocalTime(row.created_at, 'full') }}</template></el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="openDetail(row)">查看详情</el-button>
            <el-button v-if="row.status === 'pending'" type="success" link :icon="CircleCheck" @click="handleResolve(row)">标记处理</el-button>
            <el-button v-else type="danger" link :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-container">
        <el-pagination v-model:current-page="pagination.currentPage" v-model:page-size="pagination.pageSize" :page-sizes="[10,20,50,100]" :total="pagination.total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div>
    </el-card>

    <!-- 详情对话框（保持不变） -->
    <el-dialog v-model="detailVisible" title="反馈详情" width="550px" :close-on-click-modal="false">
      <div v-if="currentFeedback" class="feedback-detail">
        <div class="detail-row"><span class="label">箱号：</span><span class="value">{{ currentFeedback.boxnumber }}</span></div>
        <div class="detail-row"><span class="label">反馈类型：</span><span class="value"><el-tag :type="currentFeedback.type==='shortage'?'danger':(currentFeedback.type==='damage'?'warning':'info')" size="small">{{ currentFeedback.typeText }}</el-tag></span></div>
        <div class="detail-row"><span class="label">区域：</span><span class="value">{{ currentFeedback.area }}</span></div>
        <div class="detail-row"><span class="label">反馈时间：</span><span class="value">{{ formatLocalTime(currentFeedback.created_at, 'full') }}</span></div>
        <div class="detail-row full-width"><span class="label">详细描述：</span><div class="description-box">{{ currentFeedback.description }}</div></div>
        <div class="detail-row" v-if="currentFeedback.status === 'resolved'"><span class="label">处理时间：</span><span class="value">{{ formatLocalTime(currentFeedback.updated_at, 'full') }}</span></div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="currentFeedback && currentFeedback.status === 'pending'" type="primary" @click="handleResolveFromDialog" :loading="resolving">确认处理</el-button>
        <el-button v-else type="danger" @click="handleDeleteFromDialog" :loading="deleting">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, View, CircleCheck, Delete } from '@element-plus/icons-vue'
import request from '@/api/request'
import { formatLocalTime } from '@/api/date'

const searchForm = reactive({ boxnumber: '', type: '', status: '', dateRange: [] })
const tableData = ref([]), loading = ref(false), selectedRows = ref([])
const pagination = reactive({ currentPage: 1, pageSize: 10, total: 0 })
const detailVisible = ref(false), currentFeedback = ref(null)
const resolving = ref(false), deleting = ref(false)
const typeMap = { shortage: '材料不足', damage: '材料破损', other: '其他问题' }

const fetchFeedbackList = async () => {
  loading.value = true
  try {
    const params = { page: pagination.currentPage, pageSize: pagination.pageSize, ...searchForm }
    if (searchForm.boxnumber) params.boxnumber = searchForm.boxnumber
    if (searchForm.type) params.type = searchForm.type
    if (searchForm.status) params.status = searchForm.status
    if (searchForm.dateRange?.length===2) { params.startDate = searchForm.dateRange[0]; params.endDate = searchForm.dateRange[1] }
    Object.keys(params).forEach(k => { if (params[k]===''||params[k]===null||params[k]===undefined) delete params[k] })
    const res = await request.get('/admin/feedback', { params })
    if (res.result === true) {
      tableData.value = (res.data.list || []).map(item => ({ ...item, typeText: typeMap[item.type]||item.type }))
      pagination.total = res.data.total || 0
    } else ElMessage.error(res.message || '获取反馈列表失败')
  } catch (error) { ElMessage.error('网络错误') } finally { loading.value = false }
}

// 搜索、重置、分页（不变）
const handleSearch = () => { pagination.currentPage = 1; fetchFeedbackList() }
const handleReset = () => { searchForm.boxnumber = ''; searchForm.type = ''; searchForm.status = ''; searchForm.dateRange = []; handleSearch() }
const handlePageChange = (page) => { pagination.currentPage = page; fetchFeedbackList() }
const handleSizeChange = (size) => { pagination.pageSize = size; pagination.currentPage = 1; fetchFeedbackList() }
const handleSelectionChange = (selection) => { selectedRows.value = selection }
const openDetail = (row) => { currentFeedback.value = { ...row }; detailVisible.value = true }

// 单个标记处理（与之前相同）
const handleResolve = (row) => {
  ElMessageBox.confirm(`确定将箱号 ${row.boxnumber} 的反馈标记为已处理吗？`, '提示', { confirmButtonText:'确定', cancelButtonText:'取消', type:'warning' })
    .then(() => confirmResolve([row.id]))
    .catch(() => {})
}
const handleResolveFromDialog = async () => { if (currentFeedback.value) await confirmResolve([currentFeedback.value.id]) }

// 批量处理（只处理选中的待处理）
const handleBatchResolve = () => {
  const pendingIds = selectedRows.value.filter(r => r.status === 'pending').map(r => r.id)
  if (pendingIds.length === 0) {
    ElMessage.warning('请选择待处理的反馈')
    return
  }
  ElMessageBox.confirm(`确定将选中的 ${pendingIds.length} 条待处理反馈标记为已处理吗？`, '提示', { confirmButtonText:'确定', cancelButtonText:'取消', type:'warning' })
    .then(() => confirmResolve(pendingIds))
    .catch(() => {})
}

// 公共处理逻辑
const confirmResolve = async (ids) => {
  resolving.value = true
  try {
    const res = await request.put('/admin/feedback/batch-resolve', { ids })
    if (res.result === true) {
      ElMessage.success(`成功处理 ${res.data.count || ids.length} 条反馈`)
      detailVisible.value = false
      fetchFeedbackList()
    } else ElMessage.error(res.message || '操作失败')
  } catch (error) { ElMessage.error('网络错误') } finally { resolving.value = false }
}

// ==================== 新增删除功能 ====================

// 单个删除（仅用于已处理）
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除箱号 ${row.boxnumber} 的反馈（已处理）吗？此操作不可恢复！`, '警告', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'error'
  }).then(() => confirmDelete([row.id])).catch(() => {})
}
const handleDeleteFromDialog = async () => {
  if (currentFeedback.value) await confirmDelete([currentFeedback.value.id])
}

// 批量删除（只删除选中的已处理）
const handleBatchDelete = () => {
  const resolvedIds = selectedRows.value.filter(r => r.status === 'resolved').map(r => r.id)
  if (resolvedIds.length === 0) {
    ElMessage.warning('请选择已处理的反馈进行删除')
    return
  }
  ElMessageBox.confirm(`确定要删除选中的 ${resolvedIds.length} 条已处理反馈吗？此操作不可恢复！`, '警告', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'error'
  }).then(() => confirmDelete(resolvedIds)).catch(() => {})
}

// 快速清理（清理所有已处理）
const handleCleanResolved = () => {
  ElMessageBox.confirm('确定要一键清理所有已处理的反馈吗？此操作将永久删除所有已处理记录，不可恢复！', '危险操作', {
    confirmButtonText: '确定清理',
    cancelButtonText: '取消',
    type: 'error'
  }).then(async () => {
    try {
      const res = await request.delete('/admin/feedback/clean')
      if (res.result === true) {
        ElMessage.success(`已清理 ${res.data.count} 条已处理反馈`)
        fetchFeedbackList()
      } else ElMessage.error(res.message || '清理失败')
    } catch (error) {
      ElMessage.error('网络错误')
    }
  }).catch(() => {})
}

// 公共删除逻辑
const confirmDelete = async (ids) => {
  deleting.value = true
  try {
    const res = await request.delete('/admin/feedback/batch', { data: { ids } })
    if (res.result === true) {
      ElMessage.success(`成功删除 ${res.data.count || ids.length} 条反馈`)
      detailVisible.value = false
      fetchFeedbackList()
    } else ElMessage.error(res.message || '删除失败')
  } catch (error) { ElMessage.error('网络错误') } finally { deleting.value = false }
}

// 导出（暂不实现）
const handleExport = () => ElMessage.info('导出功能开发中...')

onMounted(() => fetchFeedbackList())
</script>

<style scoped>
.feedback-management { padding: 10px; }
.search-card,.operation-card,.table-card { margin-bottom: 15px; border-radius: 8px; }
.search-form { margin: 0; }
.operation-buttons { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
.btn-left, .btn-right { display: flex; gap: 10px; align-items: center; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.feedback-detail { display: flex; flex-direction: column; gap: 16px; }
.detail-row { display: flex; align-items: flex-start; }
.detail-row .label { width: 80px; color: #606266; font-weight: 500; flex-shrink: 0; }
.detail-row .value { color: #303133; word-break: break-word; flex:1; }
.detail-row.full-width { flex-direction: column; }
.detail-row.full-width .label { margin-bottom: 8px; }
.description-box { background-color: #f5f7fa; padding: 12px; border-radius: 8px; line-height: 1.5; color: #606266; width: 100%; word-wrap: break-word; white-space: pre-wrap; box-sizing: border-box; }
</style>