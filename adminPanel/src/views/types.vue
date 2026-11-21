<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Delete, Edit, Download, Upload } from '@element-plus/icons-vue'
import request from '@/api/request'

// 搜索表单（区域+物料名称）
const searchForm = reactive({
    area: '',
    name: ''
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

// 表单数据（编辑时需要记住原物料名称）
const formData = reactive({
    originalName: '',   // 编辑时用于定位的原始名称
    name: '',
    area: ''
})

// 表单验证规则
const rules = {
    name: [
        { required: true, message: '请输入物料名称', trigger: 'blur' },
        { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' }
    ],
    area: [
        { required: true, message: '请选择区域', trigger: 'change' }
    ]
}

// 获取物料种类列表
const getClassList = async () => {
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

        const res = await request.get('/admin/class', { params })
        
        // 直接使用后端返回的数据，不需要转换 id
        tableData.value = res.data.list || []
        pagination.total = res.data.total || 0
    } catch (error) {
        ElMessage.error(error.response?.data?.message || '获取物料种类列表失败')
    } finally {
        loading.value = false
    }
}

// 搜索
const handleSearch = () => {
    pagination.currentPage = 1
    getClassList()
}

// 重置搜索
const handleReset = () => {
    searchForm.area = ''
    searchForm.name = ''
    handleSearch()
}

// 打开添加对话框
const handleAdd = () => {
    dialogTitle.value = '添加物料种类'
    isEdit.value = false
    resetForm()
    dialogVisible.value = true
}

// 打开编辑对话框（传递物料名称和区域）
const handleEdit = (row) => {
    if (!row.name || !row.area) {
        ElMessage.error('物料名称或区域无效，无法编辑')
        return
    }
    dialogTitle.value = '编辑物料种类'
    isEdit.value = true
    formData.originalName = row.name
    formData.name = row.name
    formData.area = row.area
    dialogVisible.value = true
}

// 删除单个物料种类（使用物料名称）
const handleDelete = (row) => {
    if (!row.name) {
        ElMessage.error('物料名称无效，无法删除')
        return
    }
    
    ElMessageBox.confirm(`确定要删除物料种类 "${row.name}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            // 注意：后端接口需要改为 DELETE /admin/class/:name
            await request.delete(`/admin/class/${encodeURIComponent(row.name)}`)
            ElMessage.success('删除成功')
            getClassList()
        } catch (error) {
            ElMessage.error(error.response?.data?.message || '删除失败')
        }
    }).catch(() => { })
}

// 批量删除（使用物料名称数组）
const handleBatchDelete = () => {
    if (multipleSelection.value.length === 0) {
        ElMessage.warning('请先选择要删除的物料种类')
        return
    }

    // 提取有效的物料名称
    const names = multipleSelection.value
        .map(item => item.name)
        .filter(name => name && name.trim() !== '')

    if (names.length === 0) {
        ElMessage.warning('所选记录中没有有效的物料名称，无法删除')
        return
    }

    if (names.length !== multipleSelection.value.length) {
        ElMessage.warning(`所选 ${multipleSelection.value.length} 条记录中，有 ${multipleSelection.value.length - names.length} 条名称无效，将只删除有效的 ${names.length} 条`)
    }

    ElMessageBox.confirm(`确定要删除选中的 ${names.length} 种物料吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(async () => {
        try {
            // 注意：后端批量删除接口需要支持传递 names 数组
            await request.delete('/admin/class/batch', { data: { names } })
            ElMessage.success('批量删除成功')
            getClassList()
        } catch (error) {
            console.error('批量删除错误：', error)
            ElMessage.error(error.response?.data?.message || '批量删除失败')
        }
    }).catch(() => { })
}

// 提交表单（添加/编辑）
const handleSubmit = async () => {
    if (!formRef.value) return

    await formRef.value.validate(async (valid) => {
        if (valid) {
            try {
                if (isEdit.value) {
                    // 编辑：需要发送原始名称和新数据
                    await request.put(`/admin/class/${encodeURIComponent(formData.originalName)}`, {
                        name: formData.name,
                        area: formData.area
                    })
                    ElMessage.success('编辑成功')
                } else {
                    // 添加
                    await request.post('/admin/class', {
                        name: formData.name,
                        area: formData.area
                    })
                    ElMessage.success('添加成功')
                }
                dialogVisible.value = false
                getClassList()
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
        originalName: '',
        name: '',
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
    getClassList()
}

const handleSizeChange = (size) => {
    pagination.pageSize = size
    pagination.currentPage = 1
    getClassList()
}


onMounted(() => {
    getClassList()
})
</script>

<template>
    <div class="class-management">
        <!-- 搜索区域（不变） -->
        <el-card class="search-card" shadow="never">
            <el-form :inline="true" :model="searchForm" class="search-form">
                <el-form-item label="区域">
                    <el-input 
                        v-model="searchForm.area" 
                        placeholder="请输入区域" 
                        clearable
                        style="width: 150px"
                    />
                </el-form-item>
                <el-form-item label="物料名称">
                    <el-input 
                        v-model="searchForm.name" 
                        placeholder="请输入物料名称" 
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
                <el-button type="primary" :icon="Plus" @click="handleAdd">添加物料种类</el-button>
                <el-button type="danger" :icon="Delete" @click="handleBatchDelete" 
                    :disabled="multipleSelection.length === 0">
                    批量删除
                </el-button>

            </div>
        </el-card>

        <!-- 表格区域 - 移除 ID 列，操作列按钮传递物料名称 -->
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
                <el-table-column prop="name" label="物料名称" min-width="150" />
                <el-table-column prop="area" label="区域" min-width="100" />
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

        <!-- 添加/编辑对话框（去掉 id 字段） -->
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
                label-width="100px"
            >
                <el-form-item label="物料名称" prop="name">
                    <el-input 
                        v-model="formData.name" 
                        placeholder="请输入物料名称"
                        maxlength="100"
                    />
                </el-form-item>

                <el-form-item label="区域" prop="area">
                    <el-input 
                        v-model="formData.area" 
                        placeholder="请输入区域"
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
    </div>
</template>

<style scoped>
.class-management {
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
</style>