<template>
  <div class="not-found-container">
    <div class="content-wrapper">
      <!-- 404 图形/文字展示 -->
      <div class="error-code">404</div>
      
      <!-- 提示信息 -->
      <h1 class="title">页面未找到</h1>
      <p class="description">
        抱歉，您访问的页面不存在或已被移除。<br>
        请检查网址是否正确，或点击下方按钮返回首页。
      </p>
      
      <!-- 操作按钮 -->
      <button class="home-btn" @click="goHome">
        返回首页
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  // 尝试跳转到根路径，如果失败则使用浏览器后退
  router.push('/').catch(() => {
    window.location.href = '/'
  })
}
</script>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f7fa; /* 浅灰背景，突出白色卡片 */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.content-wrapper {
  text-align: center;
  background-color: #ffffff;
  padding: 60px 40px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  max-width: 500px;
  width: 90%;
}

.error-code {
  font-size: 80px;
  font-weight: bold;
  color: #1a60b6; /* 主色调 */
  line-height: 1;
  margin-bottom: 20px;
  opacity: 0.9;
}

.title {
  font-size: 24px;
  color: #333;
  margin-bottom: 16px;
  font-weight: 600;
}

.description {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 32px;
}

.home-btn {
  background-color: #1a60b6; /* 主色调 */
  color: #ffffff;
  border: none;
  padding: 12px 32px;
  font-size: 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease;
  outline: none;
}

.home-btn:hover {
  background-color: #154d92; /* 稍微深一点的蓝色用于 hover 状态 */
}

.home-btn:active {
  transform: scale(0.98);
}
</style>