// stores/admin.js
import { defineStore } from 'pinia'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    workshop: '',    // 初始为空，由登录接口写入
    token: ''        // 初始为空，由登录接口写入
  }),
  actions: {
    // 登录成功后设置管理员信息（同时写入 sessionStorage）
    setAdminInfo(workshop, token) {
      this.workshop = workshop
      this.token = token
      sessionStorage.setItem('token', token)
      // 注意：为了显示用户名，仍需要存 sessionStorage，因为刷新页面时 store 会重置
      // 但您可以通过路由守卫重新从后端获取，或者保留此存储仅用于显示
      // 为了保持用户体验（刷新不丢名字），还是保留 sessionStorage 存储用户名
      sessionStorage.setItem('admin_workshop', workshop)
    },
    // 退出登录清除信息
    clearAdminInfo() {
      this.workshop = ''
      this.token = ''
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('admin_workshop')
    }
  }
})