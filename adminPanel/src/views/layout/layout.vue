<template>
  <div class="app-layout">
    <el-container direction="vertical">
      <el-header class="app-header">
        <div class="header-left">
          <div class="logo-area" @click="router.push('/')">
            <span class="system-name">宁溪致远材料助手库存管理平台</span>
          </div>
        </div>

        <div class="header-right">
          <div class="home-link" @click="router.push('/')">
            <el-icon><HomeFilled /></el-icon>
            <span>首页</span>
          </div>

          <el-dropdown trigger="click" @command="handleCommand">
            <span class="user-info">
              <span class="username">{{ adminStore.workshop || '管理员' }}</span>
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="changePassword">
                  <el-icon><Key /></el-icon> 修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>

    <!-- 修改密码对话框 -->
    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="450px"
      :close-on-click-modal="false"
      @close="resetPasswordForm"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            placeholder="请输入当前密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码（至少6位）"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitChangePassword" :loading="passwordLoading">
          确定修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { HomeFilled, ArrowDown, Key, SwitchButton } from '@element-plus/icons-vue'
import request from '@/api/request'
import { useAdminStore } from '@/stores/admin'


const router = useRouter()
const adminStore = useAdminStore()


// 修改密码对话框
const passwordDialogVisible = ref(false)
const passwordFormRef = ref(null)
const passwordLoading = ref(false)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 下拉菜单命令处理
const handleCommand = (command) => {
  if (command === 'changePassword') {
    passwordDialogVisible.value = true
    setTimeout(() => {
      if (passwordFormRef.value) {
        passwordFormRef.value.resetFields()
      }
    }, 100)
  } else if (command === 'logout') {
    handleLogout()
  }
}

// ---------- 退出登录 ----------
const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    // 清除管理员信息（Pinia + sessionStorage）
    adminStore.clearAdminInfo()

    router.push('/login')
    ElMessage.success('已退出登录')
  }).catch(() => {})
}

// ---------- 修改密码 ----------
const submitChangePassword = () => {
  if (!passwordFormRef.value) return
  passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      passwordLoading.value = true
      try {
        const res = await request.put('/admin/change-password', {
          oldPassword: passwordForm.value.oldPassword,
          newPassword: passwordForm.value.newPassword
        })
        if (res.result === true) {
          ElMessage.success('密码修改成功，请重新登录')
          passwordDialogVisible.value = false
          // 清除所有登录状态
          adminStore.clearAdminInfo()

          setTimeout(() => {
            router.push('/login')
          }, 1500)
        } else {
          ElMessage.error(res.message || '修改密码失败')
        }
      } catch (error) {
        ElMessage.error('网络错误，请重试')
      } finally {
        passwordLoading.value = false
      }
    }
  })
}

// 重置密码表单
const resetPasswordForm = () => {
  passwordForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
  if (passwordFormRef.value) {
    passwordFormRef.value.clearValidate()
  }
}
</script>

<style scoped>
.app-layout { height: 100vh; width: 100%; }
.app-header {
  background-color: #1a60b6;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}
.header-left { display: flex; align-items: center; }
.logo-area {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
}
.system-name { letter-spacing: 1px; }
.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}
.home-link {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.9;
  transition: opacity 0.3s;
}
.home-link:hover { opacity: 1; }
.user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
}
.username { font-weight: 500; }
.app-main {
  min-height: calc(100vh - 60px);
  background-color: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}
:deep(.el-dropdown-menu__item .el-icon) { margin-right: 8px; }
</style>