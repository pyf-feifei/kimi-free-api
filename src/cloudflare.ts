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
  set?: (key: string, value: string) => void
  body?: any
}

// 确保在 Cloudflare Workers 环境中正确设置环境变量
process.env.CLOUDFLARE_WORKER = 'true';

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
        response: {
          status: 200,
          headers: {},
          body: null
        },
        req: {
          headers: Object.fromEntries(request.headers)
        },
        res: {},
        // 添加set方法模拟Koa的ctx.set
        set: function(key: string, value: string) {
          if (!this.response.headers) this.response.headers = {};
          this.response.headers[key] = value;
        }
      }
      
      // 执行Koa中间件链
      await server.app.callback()(koaCtx as any)
      
      // 转换响应格式
      return new Response(
        // 优先使用ctx.body，如果不存在则使用ctx.response.body
        koaCtx.body !== undefined ? koaCtx.body : koaCtx.response.body, 
        {
          status: koaCtx.response.status || 200,
          headers: new Headers(koaCtx.response.headers || {})
        }
      )
    } catch (error) {
      console.error('Cloudflare Worker 错误:', error)
      
      // 返回一个有效的响应对象
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
      );
    }
  }
};
