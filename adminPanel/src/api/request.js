import axios from 'axios'
import router from '@/router'
import { ElMessage } from 'element-plus'

// 创建 axios 实例
const service = axios.create({
  baseURL: '/api',
  timeout: 5000
})

// 请求拦截器：自动携带 Token
service.interceptors.request.use(
  config => {
    const token = sessionStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data

    if (res.code === 4001001) {
      handleLogout()
      return Promise.reject(new Error(res.message || '登录已过期'))
    }

    return res
  },
  error => {
    let message = '网络异常'
    if (error.response) {
      switch (error.response.status) {
        case 500:
          message = '服务器内部错误'
          break
        case 502:
        case 503:
        case 504:
          message = '服务不可用，请稍后重试'
          break
        default:
          message = `连接错误(${error.response.status})`
      }
    } else if (error.message.includes('timeout')) {
      message = '请求超时'
    } else if (error.message.includes('Network Error')) {
      message = '网络连接失败'
    }

    ElMessage.error(message)
    return Promise.reject(error)
  }
)

/**
 * 统一登出处理
 */
function handleLogout() {
  // 防止在登录页重复跳转或重复提示
  if (router.currentRoute.value.path === '/login') return

  localStorage.removeItem('token')
  ElMessage.error('未登录或登录状态已过期')
  
  router.replace({
    path: '/login',
  })
}

export default service