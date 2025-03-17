import server from './lib/server.ts'

// 在 Workers 环境中模拟 fs 模块
if (typeof process.env.CLOUDFLARE_WORKER !== 'undefined') {
  // 防止 date-fns 使用 fs 模块
  globalThis.process = {
    ...globalThis.process,
    env: {
      ...globalThis.process?.env,
      TZ: 'UTC' // 设置默认时区为 UTC
    }
  };
}

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

    // 设置环境变量
    process.env.CLOUDFLARE_WORKER = 'true'
    
    try {
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
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}
