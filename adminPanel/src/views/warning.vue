<template>
  <div class="warning-management">
    <el-card class="search-card" shadow="never">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="箱号"><el-input v-model="searchForm.boxnumber" placeholder="请输入箱号" clearable style="width: 150px" /></el-form-item>
        <el-form-item label="物料名称"><el-input v-model="searchForm.name" placeholder="请输入物料名称" clearable style="width: 150px" /></el-form-item>
        <el-form-item label="区域"><el-input v-model="searchForm.area" placeholder="请输入区域" clearable style="width: 120px" /></el-form-item>
        <el-form-item><el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button><el-button :icon="Refresh" @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card class="operation-card" shadow="never">
      <div class="operation-buttons">
        <div class="btn-left"><el-button type="primary" :icon="Refresh" @click="fetchWarningList">刷新</el-button></div>
        <div class="btn-right"><el-button type="warning" :icon="Download" @click="handleExport">导出</el-button></div>
      </div>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table :data="tableData" v-loading="loading" border stripe @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="boxnumber" label="箱号" width="100" />
        <el-table-column prop="name" label="物料名称" min-width="150" />
        <el-table-column prop="Remaining" label="剩余数量" width="100" />
        <el-table-column prop="alert_threshold" label="预警阈值" width="100"><template #default="{ row }"><el-tag :type="row.Remaining <= row.alert_threshold ? 'danger' : 'info'">{{ row.alert_threshold }}</el-tag></template></el-table-column>
        <el-table-column prop="quota" label="定额" width="80" />
        <el-table-column prop="area" label="区域" width="120" />
        <el-table-column label="库存状态" width="100"><template #default="{ row }"><el-tag :type="row.Remaining <= row.alert_threshold ? 'danger' : 'success'">{{ row.Remaining <= row.alert_threshold ? '库存不足' : '正常' }}</el-tag></template></el-table-column>
      </el-table>
      <div class="pagination-container"><el-pagination v-model:current-page="pagination.currentPage" v-model:page-size="pagination.pageSize" :page-sizes="[10,20,50,100]" :total="pagination.total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange" @size-change="handleSizeChange" /></div>
    </el-card>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Edit, Download } from '@element-plus/icons-vue'
import request from '@/api/request'

const searchForm = reactive({ boxnumber: '', name: '', area: '' })
const tableData = ref([])
const loading = ref(false)
const selectedRows = ref([])
const pagination = reactive({ currentPage: 1, pageSize: 10, total: 0 })


const fetchWarningList = async () => {
  loading.value = true
  try {
    const params = { page: pagination.currentPage, pageSize: pagination.pageSize, ...searchForm }
    Object.keys(params).forEach(k => { if (params[k]===''||params[k]===null||params[k]===undefined) delete params[k] })
    const res = await request.get('/admin/inventory/warnings', { params })
    if (res.result === true) { tableData.value = res.data.list || []; pagination.total = res.data.total || 0 }
    else ElMessage.error(res.message || '获取预警列表失败')
  } catch (error) { ElMessage.error('网络错误') }
  finally { loading.value = false }
}
const handleSearch = () => { pagination.currentPage = 1; fetchWarningList() }
const handleReset = () => { searchForm.boxnumber = ''; searchForm.name = ''; searchForm.area = ''; handleSearch() }
const handlePageChange = (page) => { pagination.currentPage = page; fetchWarningList() }
const handleSizeChange = (size) => { pagination.pageSize = size; pagination.currentPage = 1; fetchWarningList() }
const handleSelectionChange = (selection) => { selectedRows.value = selection }


const handleExport = async () => {
  try {
    const params = {}
    if (searchForm.boxnumber) params.boxnumber = searchForm.boxnumber
    if (searchForm.name) params.name = searchForm.name
    if (searchForm.area) params.area = searchForm.area
    const res = await request.get('/admin/inventory/warnings/export', { params, responseType: 'blob' })
    let blob = res && res.data instanceof Blob ? res.data : res
    if (!(blob instanceof Blob)) return ElMessage.error('导出失败：响应格式错误')
    if (blob.type === 'application/json') { const text = await blob.text(); const error = JSON.parse(text); return ElMessage.error(error.message || '导出失败') }
    const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `预警记录_${Date.now()}.xlsx`; document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url); ElMessage.success('导出成功')
  } catch (error) { ElMessage.error('导出失败') }
}
onMounted(() => fetchWarningList())
</script>
<style scoped>
.warning-management { padding: 10px; }
.search-card,.operation-card,.table-card { margin-bottom: 15px; border-radius: 8px; }
.search-form { margin: 0; }
.operation-buttons { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
.btn-left,.btn-right { display: flex; gap: 10px; align-items: center; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
</style>