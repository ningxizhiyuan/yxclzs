<template>
    <div class="inventory-management">
        <!-- 搜索区域 -->
        <el-card class="search-card" shadow="never">
            <el-form :inline="true" :model="searchForm" class="search-form">
                <el-form-item label="箱号">
                    <el-input v-model="searchForm.boxnumber" placeholder="请输入箱号" clearable style="width: 150px"
                        type="number" />
                </el-form-item>
                <el-form-item label="物料名称">
                    <el-input v-model="searchForm.name" placeholder="请输入物料名称" clearable style="width: 150px" />
                </el-form-item>
                <el-form-item label="区域">
                    <el-input v-model="searchForm.area" placeholder="请输入区域" clearable style="width: 150px" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
                    <el-button :icon="Search" @click="handleReset">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <!-- 操作按钮区域 -->
        <el-card class="operation-card" shadow="never">
            <div class="operation-buttons">
                <el-button type="primary" :icon="Plus" @click="handleAdd">添加库存记录</el-button>
                <el-button type="danger" :icon="Delete" @click="handleBatchDelete"
                    :disabled="multipleSelection.length === 0">
                    批量删除
                </el-button>
                <el-button :icon="Upload" @click="handleImport">批量导入</el-button>

            </div>
        </el-card>

        <!-- 表格区域 -->
        <el-card class="table-card" shadow="never">
            <el-table :data="tableData" v-loading="loading" border stripe @selection-change="handleSelectionChange"
                style="width: 100%">
                <el-table-column type="selection" width="55" />
                <el-table-column prop="boxnumber" label="箱号" min-width="100" />
                <el-table-column prop="name" label="物料名称" min-width="150" />
                <el-table-column prop="Remaining" label="剩余数量" min-width="100" />
                <el-table-column prop="quota" label="定额" min-width="80" />
                <el-table-column prop="alert_threshold" label="预警阈值" min-width="100" />
                <el-table-column prop="area" label="区域" min-width="100" />
                <el-table-column label="库存状态" min-width="100">
                    <template #default="{ row }">
                        <el-tag v-if="row.Remaining <= row.alert_threshold" type="danger" size="small">库存不足</el-tag>
                        <el-tag v-else type="success" size="small">库存充足</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="操作" min-width="140" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">编辑</el-button>
                        <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 分页 -->
            <div class="pagination-container">
                <el-pagination v-model:current-page="pagination.currentPage" v-model:page-size="pagination.pageSize"
                    :page-sizes="[10, 20, 50, 100]" :total="pagination.total"
                    layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
                    @size-change="handleSizeChange" />
            </div>
        </el-card>

        <!-- 添加/编辑对话框 -->
        <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false">
            <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
                <el-form-item label="箱号" prop="boxnumber">
                    <el-select v-model="formData.boxnumber" placeholder="请选择箱号" filterable clearable
                        @change="onBoxChange" style="width: 100%">
                        <el-option v-for="item in boxList" :key="item.boxnumber"
                            :label="`${item.boxnumber} (${item.location})`" :value="item.boxnumber" />
                    </el-select>
                </el-form-item>

                <el-form-item label="物料名称" prop="name">
                    <el-select v-model="formData.name" placeholder="请选择物料名称" filterable clearable style="width: 100%">
                        <el-option v-for="item in materialClassList" :key="item.name" :label="item.name"
                            :value="item.name" />
                    </el-select>
                </el-form-item>

                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="剩余数量" prop="Remaining">
                            <el-input-number v-model="formData.Remaining" :min="0" :step="1" style="width: 100%" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="定额" prop="quota">
                            <el-input-number v-model="formData.quota" :min="0" :step="1" style="width: 100%" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="预警阈值" prop="alert_threshold">
                            <el-input-number v-model="formData.alert_threshold" :min="1" :step="1" style="width: 100%"
                                placeholder="请输入预警阈值" />
                            <div style="font-size: 12px; color: #909399;">剩余数量低于此值时触发“库存不足”预警</div>
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="区域" prop="area">
                            <el-input v-model="formData.area" placeholder="区域将根据箱号自动填充" maxlength="100"
                                :disabled="!!formData.boxnumber" />
                        </el-form-item>
                    </el-col>
                </el-row>
            </el-form>

            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="handleCancel">取消</el-button>
                    <el-button type="primary" @click="handleSubmit">确定</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 批量导入对话框 -->
        <el-dialog v-model="importDialogVisible" title="批量导入库存数据" width="600px" :close-on-click-modal="false">
            <div class="import-container">
                <div class="import-tips">
                    <el-alert title="导入说明" type="info" :closable="false" show-icon>
                        <template #default>
                            <p>1. 请下载模板，按照模板格式填写数据</p>
                            <p>2. 必填字段：箱号、物料名称、剩余数量、定额、区域</p>
                            <p>3. 预警阈值必须设置</p>
                            <p>4. 如果箱号+物料名称已存在，则会更新其剩余数量、定额、区域；预警阈值若不填则保留原值</p>
                            <p>5. 新增记录必须填写预警阈值</p>
                        </template>
                    </el-alert>
                    <el-button type="primary" link @click="downloadTemplate" style="margin-top: 10px">
                        <el-icon>
                            <Download />
                        </el-icon>
                        下载导入模板
                    </el-button>
                </div>

                <el-upload ref="uploadRef" class="upload-demo" drag :auto-upload="false" :on-change="handleFileChange"
                    :file-list="importFileList" accept=".xlsx,.xls" :limit="1">
                    <el-icon class="el-icon--upload">
                        <UploadFilled />
                    </el-icon>
                    <div class="el-upload__text">
                        将文件拖到此处，或<em>点击上传</em>
                    </div>
                    <template #tip>
                        <div class="el-upload__tip">
                            只能上传 xlsx/xls 文件
                        </div>
                    </template>
                </el-upload>
            </div>

            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="cancelImport">取消</el-button>
                    <el-button type="primary" @click="confirmImport" :loading="importLoading"
                        :disabled="importFileList.length === 0">
                        确认导入
                    </el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Delete, Edit, Download, Upload, UploadFilled } from '@element-plus/icons-vue'
import request from '@/api/request'

// 搜索表单
const searchForm = reactive({
    boxnumber: '',
    name: '',
    area: ''
})

// 表格数据
const tableData = ref([])
const loading = ref(false)
const multipleSelection = ref([])

// 分页
const pagination = reactive({
    currentPage: 1,
    pageSize: 10,
    total: 0
})

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const formRef = ref(null)

// 表单数据（预警阈值初始为 null，无默认值）
const formData = reactive({
    id: null,
    boxnumber: null,
    name: '',
    Remaining: 0,
    quota: 0,
    alert_threshold: null,
    area: ''
})

// 下拉选项数据
const boxList = ref([])
const materialClassList = ref([])

// 导入相关
const importDialogVisible = ref(false)
const uploadRef = ref(null)
const importFileList = ref([])
const importLoading = ref(false)

// 表单验证规则
const rules = {
    boxnumber: [
        { required: true, message: '请选择箱号', trigger: 'change' }
    ],
    name: [
        { required: true, message: '请选择物料名称', trigger: 'change' }
    ],
    Remaining: [
        { required: true, message: '请输入剩余数量', trigger: 'blur' },
        { type: 'number', min: 0, message: '剩余数量不能小于0', trigger: 'blur' }
    ],
    quota: [
        { required: true, message: '请输入定额', trigger: 'blur' },
        { type: 'number', min: 0, message: '定额不能小于0', trigger: 'blur' }
    ],
    alert_threshold: [
        { required: true, message: '请输入预警阈值', trigger: 'blur' },
        { type: 'number', min: 1, message: '预警阈值不能小于1', trigger: 'blur' }
    ],
    area: [
        { required: true, message: '请输入区域', trigger: 'blur' }
    ]
}

// 获取库存列表
const getInventoryList = async () => {
    loading.value = true
    try {
        const params = {
            page: pagination.currentPage,
            pageSize: pagination.pageSize,
            ...searchForm
        }
        Object.keys(params).forEach(key => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) {
                delete params[key]
            }
        })

        const res = await request.get('/admin/inventory', { params })
        // 注意：列表接口返回格式为 { data: { list, total } }
        tableData.value = res.data.list || []
        pagination.total = res.data.total || 0
    } catch (error) {
        ElMessage.error(error.response?.data?.message || '获取库存列表失败')
    } finally {
        loading.value = false
    }
}

// 获取箱号列表
const getBoxList = async () => {
    try {
        const res = await request.get('/admin/boxlist')
        // 箱号列表返回格式 { data: { list } }
        boxList.value = res.data.list || []
    } catch (error) {
        console.error('获取箱号列表失败', error)
    }
}

// 获取物料种类列表
const getMaterialClassList = async (area = '') => {
    try {
        const params = area ? { area } : {}
        const res = await request.get('/admin/class', { params })
        // 物料种类返回格式 { data: { list } }
        materialClassList.value = res.data.list || []
    } catch (error) {
        console.error('获取物料种类列表失败', error)
    }
}

// 箱号变化时自动填充区域
const onBoxChange = (boxnumber) => {
    const selectedBox = boxList.value.find(item => item.boxnumber === boxnumber)
    if (selectedBox) {
        formData.area = selectedBox.area || ''
        getMaterialClassList(formData.area)
    } else {
        formData.area = ''
    }
}

// 搜索
const handleSearch = () => {
    pagination.currentPage = 1
    getInventoryList()
}

// 重置搜索
const handleReset = () => {
    searchForm.boxnumber = ''
    searchForm.name = ''
    searchForm.area = ''
    handleSearch()
}

// 打开添加对话框
const handleAdd = () => {
    dialogTitle.value = '添加库存记录'
    isEdit.value = false
    resetForm()
    getMaterialClassList()
    dialogVisible.value = true
}

// 打开编辑对话框
const handleEdit = (row) => {
    dialogTitle.value = '编辑库存记录'
    isEdit.value = true
    Object.assign(formData, {
        id: row.id,
        boxnumber: row.boxnumber,
        name: row.name,
        Remaining: row.Remaining,
        quota: row.quota,
        alert_threshold: row.alert_threshold,
        area: row.area
    })
    getMaterialClassList(row.area)
    dialogVisible.value = true
}

// 删除单个
const handleDelete = (row) => {
    ElMessageBox.confirm(`确定要删除库存记录（箱号: ${row.boxnumber}，物料: ${row.name}）吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            await request.delete(`/admin/inventory/${row.id}`)
            ElMessage.success('删除成功')
            getInventoryList()
        } catch (error) {
            ElMessage.error(error.response?.data?.message || '删除失败')
        }
    }).catch(() => { })
}

// 批量删除
const handleBatchDelete = () => {
    if (multipleSelection.value.length === 0) {
        ElMessage.warning('请先选择要删除的记录')
        return
    }

    const ids = multipleSelection.value.map(item => item.id).filter(id => id)

    if (ids.length === 0) {
        ElMessage.warning('所选记录中没有有效ID，无法删除')
        return
    }

    ElMessageBox.confirm(`确定要删除选中的 ${ids.length} 条库存记录吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            await request.delete('/admin/inventory/batch', { data: { ids } })
            ElMessage.success('批量删除成功')
            getInventoryList()
        } catch (error) {
            console.error('批量删除错误：', error)
            ElMessage.error(error.response?.data?.message || '批量删除失败')
        }
    }).catch(() => { })
}

// 提交表单
const handleSubmit = async () => {
    if (!formRef.value) return

    await formRef.value.validate(async (valid) => {
        if (valid) {
            try {
                if (isEdit.value) {
                    await request.put(`/admin/inventory/${formData.id}`, formData)
                    ElMessage.success('编辑成功')
                } else {
                    await request.post('/admin/inventory', formData)
                    ElMessage.success('添加成功')
                }
                dialogVisible.value = false
                getInventoryList()
            } catch (error) {
                ElMessage.error(error.response?.data?.message || (isEdit.value ? '编辑失败' : '添加失败'))
            }
        }
    })
}

// 取消对话框
const handleCancel = () => {
    dialogVisible.value = false
    resetForm()
}

// 重置表单（注意预警阈值重置为 null）
const resetForm = () => {
    Object.assign(formData, {
        id: null,
        boxnumber: null,
        name: '',
        Remaining: 0,
        quota: 0,
        alert_threshold: null,
        area: ''
    })
    if (formRef.value) {
        formRef.value.clearValidate()
    }
}

// 选择变化
const handleSelectionChange = (val) => {
    multipleSelection.value = val
}

// 分页变化
const handlePageChange = (page) => {
    pagination.currentPage = page
    getInventoryList()
}

const handleSizeChange = (size) => {
    pagination.pageSize = size
    pagination.currentPage = 1
    getInventoryList()
}

// ==================== 导入导出功能 ====================

// 批量导入
const handleImport = () => {
    importDialogVisible.value = true
    importFileList.value = []
    if (uploadRef.value) {
        uploadRef.value.clearFiles()
    }
}

// 文件选择变化
const handleFileChange = (file, fileList) => {
    importFileList.value = fileList
}

// 确认导入（修正响应判断）
const confirmImport = async () => {
    if (importFileList.value.length === 0) {
        ElMessage.warning('请先选择要上传的 Excel 文件')
        return
    }

    const file = importFileList.value[0].raw

    const fileName = file.name
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
    if (!['.xlsx', '.xls'].includes(fileExt)) {
        ElMessage.error('只能上传 xlsx 或 xls 格式的 Excel 文件')
        return
    }

    importLoading.value = true

    try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await request.post('/admin/inventory/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })

        // 关键修正：直接使用 res.result 判断业务成功
        if (res.result === true) {
            const { insertCount = 0, updateCount = 0, errorCount = 0, errors = [] } = res.data

            if (insertCount > 0 || updateCount > 0) {
                ElMessage.success(`导入完成：新增 ${insertCount} 条，更新 ${updateCount} 条，失败 ${errorCount} 条`)
            } else {
                ElMessage.warning('无数据变更')
            }

            if (errors && errors.length > 0) {
                console.warn('导入错误详情：', errors)
                // 可选：显示前几条错误
                ElMessageBox.alert(
                    errors.slice(0, 5).join('<br/>'),
                    '导入错误详情',
                    { dangerouslyUseHTMLString: true, confirmButtonText: '知道了' }
                )
            }

            importDialogVisible.value = false
            getInventoryList()
        } else {
            ElMessage.error(res.message || '导入失败')
        }
    } catch (error) {
        console.error('导入请求错误', error)
        ElMessage.error(error.response?.data?.message || '服务器错误')
    } finally {
        importLoading.value = false
    }
}

// 取消导入
const cancelImport = () => {
    importDialogVisible.value = false
    importFileList.value = []
    if (uploadRef.value) {
        uploadRef.value.clearFiles()
    }
}

// 下载导入模板（动态生成）
const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/download/inventory-import-template.xlsx'
    link.click()
    ElMessage.success('模板下载成功')
}



onMounted(() => {
    getInventoryList()
    getBoxList()
})
</script>

<style scoped>
.inventory-management {
    padding: 10px;
}

.search-card,
.operation-card,
.table-card {
    margin-bottom: 15px;
    border-radius: 8px;
}

.search-form {
    margin: 0;
}

.operation-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

:deep(.el-table) {
    font-size: 13px;
}

:deep(.el-table th) {
    background-color: #f5f7fa;
    color: #606266;
    font-weight: 600;
}

/* 导入对话框样式 */
.import-container {
    padding: 10px 0;
}

.import-tips {
    margin-bottom: 20px;
}

.import-tips p {
    margin: 5px 0;
    font-size: 13px;
    line-height: 1.6;
}

.upload-demo {
    margin: 20px 0;
}
</style>