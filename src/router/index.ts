import { createRouter, createWebHistory } from 'vue-router'
import MapWorkbench from '@/views/MapWorkbench.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'workbench',
      component: MapWorkbench,
    },
  ],
})

export default router
