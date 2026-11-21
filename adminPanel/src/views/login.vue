<template>
  <div class="login-container">
    <div class="login-card">
      <!-- 头部 -->
      <div class="login-header">
        <div class="logo-box">
          <img src="../assets/logo.svg" width="120px" alt="logo"></img>
        </div>
        <h2 class="title">宁溪致远材料助手</h2>
        <p class="subtitle">库存材料管理端</p>
      </div>

      <!-- 表单区域 -->
      <el-form ref="loginFormRef" :model="loginForm" :rules="rules" class="login-form" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" size="large" prefix-icon="User" clearable />
        </el-form-item>

        <el-form-item prop="password">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" size="large" prefix-icon="Lock"
            show-password />
        </el-form-item>

        <div class="form-options">
          <el-checkbox v-model="loginForm.remember">记住账号</el-checkbox>
          <el-link type="primary" underline="never">忘记密码？</el-link>
        </div>

        <el-form-item>
          <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        &copy; 2026 宁溪致远
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/api/request'
import { useAdminStore } from '@/stores/admin'


const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)

const adminStore = useAdminStore()


const loginForm = reactive({
  username: '',
  password: '',
  remember: true
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

loginForm.username = localStorage.getItem('username') || ''

const handleLogin = async () => {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate((valid) => {
    if (valid) {
      loading.value = true
      request.post('/normal/admin/login', loginForm)
        .then(res => {
          if (res.code === 2001002) {
            ElMessage.success(res.message)
            // 存储管理员信息到 Pinia（同时写入 sessionStorage）
            adminStore.setAdminInfo(res.data.workshop, res.data.token)
            // 记住账号
            if (loginForm.remember) {
              localStorage.setItem('username', loginForm.username)
            } else {
              localStorage.removeItem('username')
            }
            router.push('/')
            loginForm.password = ''
          } else {
            ElMessage.error(res.message)
          }
          loading.value = false
        })
        .catch(err => {
          ElMessage.error(err.message || '登录失败')
          loginForm.password = ''
          loading.value = false
        })
    }
  })
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  background-image: radial-gradient(#e6efff 1px, transparent 1px);
  background-size: 20px 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(26, 96, 182, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo-box {
  margin-bottom: 15px;
  display: flex;
  justify-content: center;
}

.title {
  color: #1a60b6;
  font-size: 24px;
  margin: 0 0 8px;
  font-weight: 600;
}

.subtitle {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.login-form {
  margin-top: 20px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.login-btn {
  width: 100%;
  background-color: #1a60b6;
  border-color: #1a60b6;
  font-weight: 500;
  letter-spacing: 2px;
}

.login-btn:hover {
  background-color: #154d92;
  border-color: #154d92;
}

.login-footer {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  margin-top: 20px;
}

/* 覆盖 Element Plus 默认样式以匹配主色调 */
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #1a60b6 inset !important;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #1a60b6;
  border-color: #1a60b6;
}
</style>