import { createRouter, createWebHistory } from 'vue-router'
import request from '../api/request'
import { useAdminStore } from '../stores/admin'  // 导入 admin store

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'index',
      component: () => import('../views/layout/layout.vue'),
      children: [
        {
          path: '',
          name: 'Home',
          component: () => import('../views/index.vue')
        },{
          path: 'user',
          name: 'User',
          component: () => import('../views/user.vue')
        },{
          path: 'types',
          name: 'Types',
          component: () => import('../views/types.vue')
        },{
          path: 'inventory',
          name: 'Inventory',
          component: () => import('../views/inventory.vue')
        },{
          path: 'boxlist',
          name: 'Boxlist',
          component: () => import('../views/boxlist.vue')
        },
        {
          path: 'feedback',
          name: 'Feedback',
          component: () => import('../views/feedback.vue')
        },
        {
          path: 'warning',
          name: 'Warning',
          component: () => import('../views/warning.vue')
        },
        {
          path: 'stats',
          name: 'Stats',
          component: () => import('../views/stats.vue')
        }
      ],
      meta: {
        islogin: true,
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/login.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/404.vue'),
    }
  ],
})

router.beforeEach(async (to, from) => {
  if (to.meta.islogin) {
    const token = sessionStorage.getItem('token')
    if (token) {
      try {
        const res = await request.get('/admin/verify')
        if (res.code === 2001001) {
          // ✅ 关键修改：验证通过后，将用户名恢复到 Pinia
          const adminStore = useAdminStore()
          if (res.data?.workshop) {
            adminStore.workshop = res.data.workshop
            // 同步更新 sessionStorage（可选，保持一致性）
            sessionStorage.setItem('admin_workshop', res.data.workshop)
          }
          return true
        } else {
          // token 无效，清除存储
          const adminStore = useAdminStore()
          adminStore.clearAdminInfo()
          return '/login'
        }
      } catch (error) {
        // 网络错误，清除存储
        const adminStore = useAdminStore()
        adminStore.clearAdminInfo()
        return '/login'
      }
    } else {
      return '/login'
    }
  } else {
    return true
  }
})

export default router