// 首先导入模拟环境
import './cloudflare-shims.ts'
// 修正导入语句，使用正确的模块导入方式
import chat from './api/controllers/chat.ts'
import logger from './lib/logger.ts'

// 确保在 Cloudflare Workers 环境中正确设置环境变量
process.env.CLOUDFLARE_WORKER = 'true'

export default {
  async fetch(request: Request) {
    try {
      const url = new URL(request.url)
      const path = url.pathname
      
      // 处理聊天补全接口
      if (path === '/v1/chat/completions') {
        // 获取认证信息
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({
              error: '认证失败',
              message: '缺少有效的 Authorization Bearer Token'
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
        
        const refreshToken = authHeader.replace('Bearer ', '')
        
        // 解析请求体
        let requestBody
        try {
          requestBody = await request.json()
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: '请求格式错误',
              message: '无法解析 JSON 请求体'
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
        
        const { model = 'kimi', messages, stream = false } = requestBody
        
        // 处理流式响应
        if (stream) {
          const streamResponse = await chat.createCompletionStream(model, messages, refreshToken)
          return new Response(streamResponse, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          })
        } else {
          // 处理普通响应 - 使用正确的函数名
          const response = await chat.createCompletion(model, messages, refreshToken)
          return new Response(
            JSON.stringify(response),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
      }
      
      // 处理健康检查接口
      if (path === '/health' || path === '/v1/health') {
        return new Response(
          JSON.stringify({ status: 'ok' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
      
      // 处理其他路由
      return new Response(
        JSON.stringify({ error: '路由未找到', message: `路径 ${path} 不存在` }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } catch (error) {
      logger.error('Cloudflare Worker 错误:', error)
      
      return new Response(
        JSON.stringify({
          error: '服务器内部错误',
          message: error.message || '未知错误'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }
  }
}