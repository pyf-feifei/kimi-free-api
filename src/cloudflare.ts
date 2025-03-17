// 首先导入模拟环境
import './cloudflare-shims.ts';
import server from './lib/server.ts';

// 新增类型定义
interface KoaContext {
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body: string
    href?: string
  }
  response: {
    status?: number
    headers?: Record<string, string>
    body?: any
  }
  req?: any
  res?: any
}

export default {
  async fetch(request: Request) {
    try {
      // 创建Koa兼容的上下文对象
      const koaCtx: KoaContext = {
        request: {
          method: request.method,
          url: request.url,
          href: request.url,
          headers: Object.fromEntries(request.headers),
          body: await request.text(),
        },
        response: {},
        req: {
          headers: Object.fromEntries(request.headers)
        },
        res: {}
      }
      
      // 执行Koa中间件链
      await server.app.callback()(koaCtx as any)
      
      // 转换响应格式
      return new Response(koaCtx.response.body, {
        status: koaCtx.response.status || 200,
        headers: new Headers(koaCtx.response.headers || {})
      })
    } catch (error) {
      console.error('Worker执行错误:', error)
      return new Response(JSON.stringify({
        error: '服务器内部错误',
        message: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}
