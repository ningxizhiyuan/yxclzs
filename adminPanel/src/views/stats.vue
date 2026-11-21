<template>
  <div class="statistics-container">
    <!-- 筛选区域（不变） -->
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filters.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始日期时间"
            end-placeholder="结束日期时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 380px"
            @change="handleDateRangeChange"
          />
        </el-form-item>
        <el-form-item label="时间点">
          <el-select v-model="filters.timeType" style="width: 150px" @change="handleTimeTypeChange">
            <el-option label="今日8:00至今" value="today8" />
            <el-option label="今日0:00至今" value="today0" />
            <el-option label="本周" value="week" />
            <el-option label="本月" value="month" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="箱号">
          <el-input v-model="filters.boxnumber" placeholder="请输入箱号" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="filters.material_name" placeholder="请输入物料名称" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="班组">
          <el-input v-model="filters.team" placeholder="请输入班组" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="区域">
          <el-input v-model="filters.area" placeholder="请输入区域" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="refreshAll">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片（不变） -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="6" v-for="card in statCards" :key="card.title">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-card-content">
            <div class="stat-icon" :style="{ backgroundColor: card.color + '20', color: card.color }">
              <el-icon><component :is="card.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ card.value }}</div>
              <div class="stat-title">{{ card.title }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域（不变） -->
    <el-row :gutter="20" class="chart-row">
      <el-col :xs="24" :lg="14">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>使用数量趋势</span>
              <el-radio-group v-model="trendGranularity" size="small" @change="fetchTrend">
                <el-radio-button value="day">按天</el-radio-button>
                <el-radio-button value="hour">按小时</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" style="height: 350px" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card class="chart-card">
          <template #header>
            <span>物料使用占比</span>
          </template>
          <div ref="pieChartRef" style="height: 350px" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row">
      <el-col :xs="24">
        <el-card class="chart-card">
          <template #header>
            <span>使用量排行</span>
          </template>
          <div ref="barChartRef" style="height: 300px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 箱号使用汇总表格（替代原物料汇总） -->
    <el-card class="table-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>使用汇总</span>
          <el-button type="primary" link :icon="Download" @click="exportSummary">导出汇总</el-button>
        </div>
      </template>
      <el-table :data="boxSummaryList" v-loading="summaryLoading" border stripe>
        <el-table-column prop="boxnumber" label="箱号" width="100" sortable />
        <el-table-column prop="material_name" label="物料名称" min-width="150" />
        <el-table-column prop="total_quantity" label="使用总数量" width="120" sortable />
      </el-table>
    </el-card>

    <!-- 箱号使用明细表格（保留，但删除导出按钮） -->
    <el-card class="table-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>使用明细</span>
          <!-- 删除导出按钮 -->
        </div>
      </template>
      <el-table :data="boxDetails.list" v-loading="detailLoading" border stripe>
        <el-table-column prop="boxnumber" label="箱号" width="100" />
        <el-table-column prop="material_name" label="物料名称" min-width="150" />
        <el-table-column prop="quantity" label="使用数量" width="100" sortable />
        <el-table-column prop="username" label="员工编号" width="120" />
        <el-table-column prop="team" label="班组" width="120" />
        <el-table-column prop="area" label="区域" width="100" />
        <el-table-column prop="usage_time" label="使用时间" width="160">
          <template #default="{ row }">
            {{ formatLocalTime(row.usage_time, 'short') }}
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="boxDetails.page"
          v-model:page-size="boxDetails.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="boxDetails.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchBoxDetails"
          @size-change="handleDetailSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Download, TrendCharts, PieChart, Histogram } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import request from '@/api/request'
import { formatLocalTime } from '@/api/date'

// 筛选条件
const filters = reactive({
  dateRange: [],
  timeType: 'today8',
  boxnumber: '',
  material_name: '',
  team: '',
  area: ''
})

// 时间点变化：非自定义时清空时间范围
const handleTimeTypeChange = (val) => {
  if (val !== 'custom') {
    filters.dateRange = []
  }
}

// 时间范围变化：有值时自动切换到自定义
const handleDateRangeChange = (val) => {
  if (val && val.length === 2) {
    filters.timeType = 'custom'
  }
}

// 统计卡片数据
const statCards = ref([
  { title: '使用总数量', value: 0, icon: 'TrendCharts', color: '#1a60b6' },
  { title: '物料种类数', value: 0, icon: 'PieChart', color: '#67c23a' },
  { title: '参与班组数', value: 0, icon: 'Histogram', color: '#e6a23c' },
  { title: '使用箱数', value: 0, icon: 'Box', color: '#f56c6c' }
])
const totalQuantity = ref(0)

// 图表实例
let trendChart = null
let pieChart = null
let barChart = null
const trendChartRef = ref(null)
const pieChartRef = ref(null)
const barChartRef = ref(null)

// 箱号汇总数据
const boxSummaryList = ref([])
const summaryLoading = ref(false)

// 箱号明细
const boxDetails = reactive({
  list: [],
  page: 1,
  pageSize: 10,
  total: 0
})
const detailLoading = ref(false)

const trendGranularity = ref('day')

// 根据时间类型获取起止时间（返回 ISO 字符串）
const getTimeRange = (type, customRange) => {
  const now = new Date()
  if (type === 'today8') {
    const start = new Date(now)
    start.setHours(8, 0, 0, 0)
    return { startTime: start.toISOString(), endTime: now.toISOString() }
  } else if (type === 'today0') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { startTime: start.toISOString(), endTime: now.toISOString() }
  } else if (type === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return { startTime: start.toISOString(), endTime: now.toISOString() }
  } else if (type === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    return { startTime: start.toISOString(), endTime: now.toISOString() }
  } else if (type === 'custom' && customRange && customRange.length === 2) {
    const start = new Date(customRange[0])
    const end = new Date(customRange[1])
    return { startTime: start.toISOString(), endTime: end.toISOString() }
  }
  return { startTime: '', endTime: '' }
}

// 刷新所有数据
const refreshAll = async () => {
  const range = getTimeRange(filters.timeType, filters.dateRange)
  if (!range.startTime || !range.endTime) {
    ElMessage.warning('请选择有效的时间范围')
    return
  }
  if (boxDetails.page !== 1) boxDetails.page = 1
  await Promise.all([
    fetchOverview(range),
    fetchBoxSummary(range),      // 获取箱号汇总
    fetchBoxDetails(range),
    fetchTrend(range),
    fetchPieData(range),
    fetchBarData(range)
  ])
}

// 获取概览（携带所有筛选条件）
const fetchOverview = async (range) => {
  const params = { ...range, ...filters }
  delete params.dateRange
  delete params.timeType
  const res = await request.get('/admin/statistics/overview', { params })
  if (res.result === true) {
    const data = res.data
    statCards.value[0].value = data.totalQuantity || 0
    statCards.value[1].value = data.materialTypes || 0
    statCards.value[2].value = data.teams || 0
    statCards.value[3].value = data.boxes || 0
    totalQuantity.value = data.totalQuantity || 0
  }
}

// 获取箱号汇总（按箱号+物料分组，按箱号排序）
const fetchBoxSummary = async (range) => {
  summaryLoading.value = true
  try {
    const params = { ...range, ...filters }
    delete params.dateRange
    delete params.timeType
    const res = await request.get('/admin/statistics/box-summary', { params })
    if (res.result === true) {
      boxSummaryList.value = res.data.list || []
    }
  } finally {
    summaryLoading.value = false
  }
}

// 箱号明细（分页）
const fetchBoxDetails = async (range) => {
  detailLoading.value = true
  try {
    const params = {
      ...range,
      ...filters,
      page: boxDetails.page,
      pageSize: boxDetails.pageSize
    }
    delete params.dateRange
    delete params.timeType
    const res = await request.get('/admin/statistics/box-details', { params })
    if (res.result === true) {
      boxDetails.list = res.data.list || []
      boxDetails.total = res.data.total || 0
    }
  } finally {
    detailLoading.value = false
  }
}

// 趋势数据（不变）
const fetchTrend = async (range) => {
  const params = { ...range, granularity: trendGranularity.value }
  const res = await request.get('/admin/statistics/trend', { params })
  if (res.result === true && trendChart) {
    const data = res.data.list || []
    const xAxis = data.map(item => item.time_point)
    const series = data.map(item => item.total_quantity)
    trendChart.setOption({
      xAxis: { data: xAxis },
      series: [{ data: series }]
    })
  }
}

// 饼图数据（物料占比）
const fetchPieData = async (range) => {
  const res = await request.get('/admin/statistics/material-summary', { params: { ...range } })
  if (res.result === true && pieChart) {
    const data = (res.data.list || []).slice(0, 8).map(item => ({
      name: item.material_name,
      value: item.total_quantity
    }))
    pieChart.setOption({ series: [{ data }] })
  }
}

// 条形图数据（箱号排行）
const fetchBarData = async (range) => {
  const res = await request.get('/admin/statistics/box-summary', { params: { ...range } })
  if (res.result === true && barChart) {
    const data = (res.data.list || []).slice(0, 10)
    const xAxis = data.map(item => `${item.boxnumber} - ${item.material_name}`)
    const series = data.map(item => item.total_quantity)
    barChart.setOption({
      xAxis: { data: xAxis, axisLabel: { rotate: 30, interval: 0 } },
      series: [{ data: series }]
    })
  }
}

// 导出汇总（箱号汇总数据）
const exportSummary = async () => {
  const range = getTimeRange(filters.timeType, filters.dateRange)
  const params = {
    startTime: range.startTime,
    endTime: range.endTime,
    boxnumber: filters.boxnumber || '',
    material_name: filters.material_name || '',
    team: filters.team || '',
    area: filters.area || ''
  }
  Object.keys(params).forEach(k => {
    if (params[k] === undefined || params[k] === '') delete params[k]
  })
  try {
    const res = await request.get('/admin/statistics/export-box-summary', {
      params,
      responseType: 'blob'
    })
    let blob = res && res.data instanceof Blob ? res.data : res
    if (!(blob instanceof Blob)) {
      ElMessage.error('导出失败：响应格式错误')
      return
    }
    if (blob.type === 'application/json') {
      const text = await blob.text()
      try {
        const error = JSON.parse(text)
        ElMessage.error(error.message || '导出失败')
      } catch {
        ElMessage.error('导出失败')
      }
      return
    }
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `box_summary_${Date.now()}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出汇总失败', error)
    ElMessage.error('导出失败')
  }
}

// 初始化图表（不变）
const initCharts = () => {
  trendChart = echarts.init(trendChartRef.value)
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', name: '时间' },
    yAxis: { type: 'value', name: '使用数量' },
    series: [{ type: 'line', smooth: true, name: '使用数量', areaStyle: {} }]
  })
  pieChart = echarts.init(pieChartRef.value)
  pieChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{ type: 'pie', radius: '55%', label: { show: true, formatter: '{b}: {d}%' } }]
  })
  barChart = echarts.init(barChartRef.value)
  barChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', name: '箱号-物料' },
    yAxis: { type: 'value', name: '使用数量' },
    series: [{ type: 'bar', name: '使用数量' }]
  })
}

window.addEventListener('resize', () => {
  trendChart?.resize()
  pieChart?.resize()
  barChart?.resize()
})

// 重置筛选条件
const resetFilters = () => {
  filters.boxnumber = ''
  filters.material_name = ''
  filters.team = ''
  filters.area = ''
  filters.timeType = 'today8'
  filters.dateRange = []
  boxDetails.page = 1
  refreshAll()
}

const handleDetailSizeChange = (size) => {
  boxDetails.pageSize = size
  boxDetails.page = 1
  refreshAll()
}

onMounted(() => {
  initCharts()
  refreshAll()
})
</script>

<style scoped>
.statistics-container {
  padding: 10px;
}
.filter-card {
  margin-bottom: 20px;
}
.filter-form {
  margin: 0;
}
.stat-cards {
  margin-bottom: 20px;
}
.stat-card {
  cursor: default;
  border-radius: 12px;
}
.stat-card-content {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
}
.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.stat-info {
  flex: 1;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}
.stat-title {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}
.chart-row {
  margin-bottom: 20px;
}
.chart-card {
  height: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.table-card {
  margin-top: 20px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>