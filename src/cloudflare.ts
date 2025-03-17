import server from './lib/server.ts'

// 在 Workers 环境中模拟必要的环境变量和函数
if (typeof globalThis.process === 'undefined') {
  // @ts-ignore
  globalThis.process = { env: {} };
}

// 设置时区环境变量，避免 date-fns 读取系统时区
globalThis.process.env.TZ = 'Asia/Shanghai';

// 模拟 fs 模块以防止 date-fns 调用失败
// @ts-ignore
globalThis.require = function(mod) {
  if (mod === 'fs') {
    return {
      readFileSync: () => null
    };
  }
  throw new Error(`模块 ${mod} 不可用`);
};

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
    // 设置环境变量
    globalThis.process.env.CLOUDFLARE_WORKER = 'true';
    
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
