import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from './App.vue'
import NotificationCenter from './views/NotificationCenter.vue'
const router = createRouter({history:createWebHashHistory(), routes:[
  {path:'/', redirect:'/notifications'},
  {path:'/notifications', name:'home', component:NotificationCenter},
]})
createApp(App).use(createPinia()).use(router).mount('#app')
