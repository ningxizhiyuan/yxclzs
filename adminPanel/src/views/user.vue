<template>
    <div class="user-management">
        <!-- 搜索区域 -->
        <el-card class="search-card" shadow="never">
            <el-form :inline="true" :model="searchForm" class="search-form">
                <el-form-item label="区域">
                    <el-input v-model="searchForm.area" placeholder="请输入区域" clearable style="width: 150px" />
                </el-form-item>
                <el-form-item label="班组">
                    <el-input v-model="searchForm.team" placeholder="请输入班组" clearable style="width: 150px" />
                </el-form-item>
                <el-form-item label="员工编号">
                    <el-input v-model="searchForm.username" placeholder="请输入员工编号" clearable style="width: 150px" />
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
                <el-button type="primary" :icon="Plus" @click="handleAdd">添加员工</el-button>
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
                <el-table-column prop="username" label="员工编号" min-width="100" />
                <el-table-column prop="name" label="姓名" min-width="80" />
                <el-table-column prop="identity" label="身份" min-width="80">
                    <template #default="{ row }">
                        <el-tag :type="row.identity === 2 ? 'danger' : row.identity === 1 ? 'warning' : 'info'"
                            size="small">
                            {{ identityOptions.find(opt => opt.value === row.identity)?.label || '未知' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="area" label="区域" min-width="100" />
                <el-table-column prop="team" label="班组" min-width="100" />
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
                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="员工编号" prop="username" required>
                            <el-input v-model="formData.username" placeholder="请输入员工编号" maxlength="10"
                                :disabled="isEdit" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="姓名" prop="name" required>
                            <el-input v-model="formData.name" placeholder="请输入姓名" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="身份" prop="identity" required>
                            <el-select v-model="formData.identity" placeholder="请选择身份" style="width: 100%"
                                @change="onIdentityChange">
                                <el-option v-for="item in identityOptions" :key="item.value" :label="item.label"
                                    :value="item.value" />
                            </el-select>
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="区域" prop="area" required>
                            <el-input v-model="formData.area" placeholder="请输入区域" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="班组" prop="team" required>
                            <el-input v-model="formData.team" placeholder="请输入班组" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <!-- 二次验证密码输入（仅当身份为管理员时显示） -->
                <el-form-item 
                    v-if="formData.identity === 2" 
                    label="安全密码" 
                    prop="securityPin"
                    :required="formData.identity === 2 && !isEdit"
                >
                    <el-input 
                        v-model="formData.securityPin" 
                        :placeholder="isEdit ? '留空则不修改' : '请设置二次验证密码（至少4位）'"
                        maxlength="20" 
                        show-password 
                    />
                    <div style="font-size: 12px; color: #909399;">
                        {{ isEdit ? '若不修改密码，请留空' : '该密码用于移动端管理员修改库存时的二次验证' }}
                    </div>
                </el-form-item>
            </el-form>

            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="handleCancel">取消</el-button>
                    <el-button type="primary" @click="handleSubmit">确定</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 批量导入对话框（保持不变） -->
        <el-dialog v-model="importDialogVisible" title="批量导入员工" width="600px" :close-on-click-modal="false">
            <div class="import-container">
                <div class="import-tips">
                    <el-alert title="导入说明" type="info" :closable="false" show-icon>
                        <template #default>
                            <p>1. 请下载模板，按照模板格式填写数据</p>
                            <p>2. 必填字段：员工编号(数字)、姓名、区域、班组</p>
                            <p>3. 身份字段（按要求填写数字）：0-普通用户，1-班组长，2-管理员（默认为0）</p>
                            <p>4. 员工编号：3（单位代码）03（车间代码）001（员工代码）</p>
                        </template>
                    </el-alert>
                    <el-button type="primary" link @click="downloadTemplate" style="margin-top: 10px">
                        <el-icon><Download /></el-icon> 下载导入模板
                    </el-button>
                </div>

                <el-upload ref="uploadRef" class="upload-demo" drag :auto-upload="false" :on-change="handleFileChange"
                    :file-list="importFileList" accept=".xlsx,.xls" :limit="1">
                    <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                    <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
                    <template #tip>
                        <div class="el-upload__tip">只能上传 xlsx/xls 文件</div>
                    </template>
                </el-upload>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="cancelImport">取消</el-button>
                    <el-button type="primary" @click="confirmImport" :loading="importLoading"
                        :disabled="importFileList.length === 0">确认导入</el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Delete, Edit, Download, Upload, UploadFilled } from '@element-plus/icons-vue'
import request from '@/api/request'

// ---- 搜索表单 ----
const searchForm = reactive({
    area: '',
    team: '',
    username: ''
})

// ---- 表格数据 ----
const tableData = ref([])
const loading = ref(false)
const multipleSelection = ref([])

// ---- 分页 ----
const pagination = reactive({
    currentPage: 1,
    pageSize: 10,
    total: 0
})

// ---- 对话框 ----
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const formRef = ref(null)

// ---- 表单数据 ----
const formData = reactive({
    id: null,
    username: '',
    identity: 0,
    team: '',
    name: '',
    area: '',
    securityPin: ''   // 二次验证密码
})

// ---- 身份选项 ----
const identityOptions = [
    { label: '普通用户', value: 0 },
    { label: '班组长', value: 1 },
    { label: '管理员', value: 2 }
]

// ---- 导入相关 ----
const importDialogVisible = ref(false)
const uploadRef = ref(null)
const importFileList = ref([])
const importLoading = ref(false)

// ---- 二次验证密码校验器 ----
const validateSecurityPin = (rule, value, callback) => {
    if (formData.identity === 2) {
        if (isEdit.value) {
            // 编辑模式：如果有值，则至少4位；无值则忽略
            if (value && value.length < 4) {
                callback(new Error('二次验证密码至少4位'))
            } else {
                callback()
            }
        } else {
            // 添加模式：必填，至少4位
            if (!value || value.length < 4) {
                callback(new Error('二次验证密码至少4位'))
            } else {
                callback()
            }
        }
    } else {
        callback()
    }
}

// ---- 表单验证规则 ----
const rules = {
    username: [
        { required: true, message: '请输入员工编号', trigger: 'blur' },
        { max: 10, message: '员工编号不能超过10个字符', trigger: 'blur' }
    ],
    name: [
        { required: true, message: '请输入姓名', trigger: 'blur' }
    ],
    area: [
        { required: true, message: '请输入区域', trigger: 'blur' }
    ],
    team: [
        { required: true, message: '请输入班组', trigger: 'blur' }
    ],
    securityPin: [
        { validator: validateSecurityPin, trigger: 'blur' }
    ]
}

// ---- 身份变化时清空密码 ----
const onIdentityChange = (val) => {
    if (val !== 2) {
        formData.securityPin = ''
    }
    if (formRef.value) {
        formRef.value.clearValidate('securityPin')
    }
}

// ---- 获取用户列表 ----
const getUserList = async () => {
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
        const res = await request.get('/admin/users', { params })
        tableData.value = res.data.list || []
        pagination.total = res.data.total || 0
    } catch (error) {
        ElMessage.error('获取用户列表失败')
    } finally {
        loading.value = false
    }
}

// ---- 搜索/重置 ----
const handleSearch = () => {
    pagination.currentPage = 1
    getUserList()
}
const handleReset = () => {
    searchForm.area = ''
    searchForm.team = ''
    searchForm.username = ''
    handleSearch()
}

// ---- 打开添加对话框 ----
const handleAdd = () => {
    dialogTitle.value = '添加员工'
    isEdit.value = false
    resetForm()
    dialogVisible.value = true
    nextTick(() => {
        if (formRef.value) formRef.value.clearValidate()
    })
}

// ---- 打开编辑对话框 ----
const handleEdit = (row) => {
    dialogTitle.value = '编辑员工'
    isEdit.value = true
    Object.assign(formData, {
        id: row.id,
        username: row.username,
        identity: row.identity,
        team: row.team,
        name: row.name,
        area: row.area,
        securityPin: ''   // 不显示旧密码
    })
    dialogVisible.value = true
    nextTick(() => {
        if (formRef.value) formRef.value.clearValidate()
    })
}

// ---- 删除单个 ----
const handleDelete = (row) => {
    ElMessageBox.confirm(`确定要删除员工 "${row.name}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            await request.delete(`/admin/users/${row.username}`)
            ElMessage.success('删除成功')
            getUserList()
        } catch (error) {
            ElMessage.error('删除失败')
        }
    }).catch(() => {})
}

// ---- 批量删除 ----
const handleBatchDelete = () => {
    if (multipleSelection.value.length === 0) {
        ElMessage.warning('请先选择要删除的员工')
        return
    }
    const usernames = multipleSelection.value.map(item => item.username).filter(Boolean)
    if (usernames.length === 0) {
        ElMessage.error('选中的数据中没有有效的员工编号')
        return
    }
    ElMessageBox.confirm(`确定要删除选中的 ${usernames.length} 名员工吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            const res = await request.delete('/admin/users/batch', { data: { usernames } })
            ElMessage.success(res.message || '批量删除成功')
            getUserList()
        } catch (error) {
            ElMessage.error(error.response?.data?.message || '批量删除失败')
        }
    }).catch(() => {})
}

// ---- 提交表单 ----
const handleSubmit = async () => {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
        if (valid) {
            try {
                const submitData = {
                    username: formData.username,
                    name: formData.name,
                    identity: formData.identity,
                    area: formData.area,
                    team: formData.team
                }
                // 二次验证密码处理
                if (formData.identity === 2) {
                    if (!isEdit.value) {
                        // 添加时必须传递密码（已由校验保证）
                        submitData.security_pin = formData.securityPin
                    } else {
                        // 编辑时，仅当用户填写了密码才传递，否则不传递（后端保持原值）
                        if (formData.securityPin && formData.securityPin.trim()) {
                            submitData.security_pin = formData.securityPin.trim()
                        }
                    }
                }
                if (isEdit.value) {
                    await request.put(`/admin/users/${formData.username}`, submitData)
                    ElMessage.success('编辑成功')
                } else {
                    await request.post('/admin/users', submitData)
                    ElMessage.success('添加成功')
                }
                dialogVisible.value = false
                getUserList()
            } catch (error) {
                ElMessage.error(error.response?.data?.message || (isEdit.value ? '编辑失败' : '添加失败'))
            }
        }
    })
}

// ---- 取消/重置 ----
const handleCancel = () => {
    dialogVisible.value = false
    resetForm()
}
const resetForm = () => {
    Object.assign(formData, {
        id: null,
        username: '',
        identity: 0,
        team: '',
        name: '',
        area: '',
        securityPin: ''
    })
    if (formRef.value) formRef.value.clearValidate()
}

// ---- 选择变化 ----
const handleSelectionChange = (val) => {
    multipleSelection.value = val
}

// ---- 分页 ----
const handlePageChange = (page) => {
    pagination.currentPage = page
    getUserList()
}
const handleSizeChange = (size) => {
    pagination.pageSize = size
    pagination.currentPage = 1
    getUserList()
}

// ---- 导入功能 ----
const handleImport = () => {
    importDialogVisible.value = true
    importFileList.value = []
    if (uploadRef.value) uploadRef.value.clearFiles()
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
        const res = await request.post('/admin/users/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        if (res.code === 2001003) {
            const { successCount, errorCount, errors } = res.data
            if (successCount > 0 && errorCount === 0) {
                ElMessage.success(`导入成功！共导入 ${successCount} 条数据`)
            } else if (successCount > 0 && errorCount > 0) {
                ElMessage.warning(`导入完成！成功 ${successCount} 条，失败 ${errorCount} 条`)
            } else {
                ElMessage.error(`导入失败！${errorCount} 条数据均失败`)
                if (errors && errors.length > 0) {
                    ElMessageBox.alert(errors.join('<br/>'), '导入错误详情', {
                        dangerouslyUseHTMLString: true,
                        confirmButtonText: '知道了'
                    })
                }
            }
            importDialogVisible.value = false
            getUserList()
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
    const link = document.createElement('a')
    link.href = '/download/user-import-template.xlsx'
    link.click()
    ElMessage.success('模板下载成功')
}

// ---- 生命周期 ----
onMounted(() => {
    getUserList()
})
</script>

<style scoped>
.user-management { padding: 10px; }
.search-card, .operation-card, .table-card { margin-bottom: 15px; border-radius: 8px; }
.search-form { margin: 0; }
.operation-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
:deep(.el-table) { font-size: 13px; }
:deep(.el-table th) { background-color: #f5f7fa; color: #606266; font-weight: 600; }
.import-container { padding: 10px 0; }
.import-tips { margin-bottom: 20px; }
.import-tips p { margin: 5px 0; font-size: 13px; line-height: 1.6; }
.upload-demo { margin: 20px 0; }
</style>