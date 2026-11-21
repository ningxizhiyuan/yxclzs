<template>
    <div class="box-management">
        <!-- 搜索区域 -->
        <el-card class="search-card" shadow="never">
            <el-form :inline="true" :model="searchForm" class="search-form">
                <el-form-item label="箱号">
                    <el-input 
                        v-model="searchForm.boxnumber" 
                        placeholder="请输入箱号" 
                        clearable
                        style="width: 150px"
                        type="number"
                    />
                </el-form-item>
                <el-form-item label="区域">
                    <el-input 
                        v-model="searchForm.area" 
                        placeholder="请输入区域" 
                        clearable
                        style="width: 150px"
                    />
                </el-form-item>
                <el-form-item label="位置">
                    <el-input 
                        v-model="searchForm.location" 
                        placeholder="请输入位置" 
                        clearable
                        style="width: 150px"
                    />
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
                <el-button type="primary" :icon="Plus" @click="handleAdd">添加材料箱</el-button>
                <el-button type="danger" :icon="Delete" @click="handleBatchDelete" 
                    :disabled="multipleSelection.length === 0">
                    批量删除
                </el-button>
                <el-button :icon="Upload" @click="handleImport">批量导入</el-button>
            </div>
        </el-card>

        <!-- 表格区域 -->
        <el-card class="table-card" shadow="never">
            <el-table 
                :data="tableData" 
                v-loading="loading"
                border
                stripe
                @selection-change="handleSelectionChange"
                style="width: 100%"
            >
                <el-table-column type="selection" width="55" />
                <el-table-column prop="boxnumber" label="箱号" min-width="100" />
                <el-table-column prop="area" label="区域" min-width="120" />
                <el-table-column prop="location" label="位置" min-width="200" />
                <el-table-column label="操作" min-width="140" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">编辑</el-button>
                        <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 分页 -->
            <div class="pagination-container">
                <el-pagination
                    v-model:current-page="pagination.currentPage"
                    v-model:page-size="pagination.pageSize"
                    :page-sizes="[10, 20, 50, 100]"
                    :total="pagination.total"
                    layout="total, sizes, prev, pager, next, jumper"
                    @current-change="handlePageChange"
                    @size-change="handleSizeChange"
                />
            </div>
        </el-card>

        <!-- 添加/编辑对话框 -->
        <el-dialog 
            v-model="dialogVisible" 
            :title="dialogTitle" 
            width="500px"
            :close-on-click-modal="false"
        >
            <el-form 
                ref="formRef" 
                :model="formData" 
                :rules="rules" 
                label-width="80px"
            >
                <el-form-item label="箱号" prop="boxnumber">
                    <el-input-number 
                        v-model="formData.boxnumber" 
                        :min="1" 
                        :step="1"
                        style="width: 100%"
                        placeholder="请输入箱号"
                    />
                </el-form-item>
                <el-form-item label="区域" prop="area">
                    <el-input 
                        v-model="formData.area" 
                        placeholder="请输入区域"
                        maxlength="100"
                    />
                </el-form-item>
                <el-form-item label="位置" prop="location">
                    <el-input 
                        v-model="formData.location" 
                        placeholder="请输入详细位置"
                        maxlength="100"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="handleCancel">取消</el-button>
                    <el-button type="primary" @click="handleSubmit">确定</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 批量导入对话框 -->
        <el-dialog v-model="importDialogVisible" title="批量导入箱号" width="600px" :close-on-click-modal="false">
            <div class="import-container">
                <div class="import-tips">
                    <el-alert title="导入说明" type="info" :closable="false" show-icon>
                        <template #default>
                            <p>1. 请下载模板，按照模板格式填写数据</p>
                            <p>2. 必填字段：箱号、区域、位置</p>
                            <p>3. 同一箱号+单位+车间+区域内不能重复（会跳过）</p>
                            <p>4. 导入将自动关联当前管理员的单位/车间</p>
                        </template>
                    </el-alert>
                    <el-button type="primary" link @click="downloadTemplate" style="margin-top: 10px">
                        <el-icon><Download /></el-icon>
                        下载导入模板
                    </el-button>
                </div>

                <el-upload 
                    ref="uploadRef" 
                    class="upload-demo" 
                    drag 
                    :auto-upload="false" 
                    :on-change="handleFileChange"
                    :file-list="importFileList" 
                    accept=".xlsx,.xls" 
                    :limit="1"
                >
                    <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
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
// 如需动态生成模板，请安装 xlsx 并取消注释
// import * as XLSX from 'xlsx'

// 搜索表单
const searchForm = reactive({
    boxnumber: '',
    area: '',
    location: ''
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

// 表单数据
const formData = reactive({
    id: null,
    boxnumber: null,
    area: '',
    location: ''
})

// 导入相关
const importDialogVisible = ref(false)
const uploadRef = ref(null)
const importFileList = ref([])
const importLoading = ref(false)

// 表单验证规则
const rules = {
    boxnumber: [
        { required: true, message: '请输入箱号', trigger: 'blur' },
        { type: 'number', min: 1, message: '箱号必须大于0', trigger: 'blur' }
    ],
    area: [
        { required: true, message: '请输入区域', trigger: 'blur' }
    ],
    location: [
        { required: true, message: '请输入位置', trigger: 'blur' }
    ]
}

// 获取箱号列表
const getBoxList = async () => {
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

        const res = await request.get('/admin/boxlist/manage', { params })
        tableData.value = res.data.list || []
        pagination.total = res.data.total || 0
    } catch (error) {
        ElMessage.error(error.response?.data?.message || '获取箱号列表失败')
    } finally {
        loading.value = false
    }
}

// 搜索
const handleSearch = () => {
    pagination.currentPage = 1
    getBoxList()
}

// 重置搜索
const handleReset = () => {
    searchForm.boxnumber = ''
    searchForm.area = ''
    searchForm.location = ''
    handleSearch()
}

// 打开添加对话框
const handleAdd = () => {
    dialogTitle.value = '添加箱号'
    isEdit.value = false
    resetForm()
    dialogVisible.value = true
}

// 打开编辑对话框
const handleEdit = (row) => {
    dialogTitle.value = '编辑箱号'
    isEdit.value = true
    Object.assign(formData, {
        id: row.id,
        boxnumber: row.boxnumber,
        area: row.area,
        location: row.location
    })
    dialogVisible.value = true
}

// 删除单个
const handleDelete = (row) => {
    ElMessageBox.confirm(`确定要删除箱号 "${row.boxnumber}"（位置：${row.location}）吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            await request.delete(`/admin/boxlist/${row.id}`)
            ElMessage.success('删除成功')
            getBoxList()
        } catch (error) {
            ElMessage.error(error.response?.data?.message || '删除失败')
        }
    }).catch(() => { })
}

// 批量删除
const handleBatchDelete = () => {
    if (multipleSelection.value.length === 0) {
        ElMessage.warning('请先选择要删除的箱号')
        return
    }

    const ids = multipleSelection.value.map(item => item.id).filter(id => id)
    if (ids.length === 0) {
        ElMessage.warning('所选记录中没有有效ID，无法删除')
        return
    }

    ElMessageBox.confirm(`确定要删除选中的 ${ids.length} 个箱号吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            await request.delete('/admin/boxlist/batch', { data: { ids } })
            ElMessage.success('批量删除成功')
            getBoxList()
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
                    await request.put(`/admin/boxlist/${formData.id}`, formData)
                    ElMessage.success('编辑成功')
                } else {
                    await request.post('/admin/boxlist', formData)
                    ElMessage.success('添加成功')
                }
                dialogVisible.value = false
                getBoxList()
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

// 重置表单
const resetForm = () => {
    Object.assign(formData, {
        id: null,
        boxnumber: null,
        area: '',
        location: ''
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
    getBoxList()
}

const handleSizeChange = (size) => {
    pagination.pageSize = size
    pagination.currentPage = 1
    getBoxList()
}

// ==================== 导入导出功能 ====================

const handleImport = () => {
    importDialogVisible.value = true
    importFileList.value = []
    if (uploadRef.value) {
        uploadRef.value.clearFiles()
    }
}

const handleFileChange = (file, fileList) => {
    importFileList.value = fileList
}

const confirmImport = async () => {
    if (importFileList.value.length === 0) {
        ElMessage.warning('请先选择要上传的 Excel 文件')
        return
    }

    const file = importFileList.value[0].raw
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!['.xlsx', '.xls'].includes(fileExt)) {
        ElMessage.error('只能上传 xlsx 或 xls 格式的 Excel 文件')
        return
    }

    importLoading.value = true
    try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await request.post('/admin/boxlist/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })

        if (res.result === true) {
            const { insertCount, updateCount, errorCount, errors } = res.data
            if (insertCount > 0 || updateCount > 0) {
                ElMessage.success(`导入完成：新增 ${insertCount} 条，更新 ${updateCount} 条，失败 ${errorCount} 条`)
            } else {
                ElMessage.warning('无数据变更')
            }
            if (errors && errors.length > 0) {
                console.warn(errors)
                ElMessageBox.alert(errors.slice(0, 5).join('<br/>'), '导入错误详情', {
                    dangerouslyUseHTMLString: true,
                    confirmButtonText: '知道了'
                })
            }
            importDialogVisible.value = false
            getBoxList()
        } else {
            ElMessage.error(res.message || '导入失败')
        }
    } catch (error) {
        ElMessage.error(error.response?.data?.message || '服务器错误')
    } finally {
        importLoading.value = false
    }
}

const cancelImport = () => {
    importDialogVisible.value = false
    importFileList.value = []
    if (uploadRef.value) uploadRef.value.clearFiles()
}

const downloadTemplate = () => {
    // 推荐使用静态文件，放在 public/download/box-import-template.xlsx
    const link = document.createElement('a')
    link.href = '/download/box-import-template.xlsx'
    link.download = 'box-import-template.xlsx'
    link.click()
    ElMessage.success('模板下载成功')
}


onMounted(() => {
    getBoxList()
})
</script>

<style scoped>
.box-management {
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