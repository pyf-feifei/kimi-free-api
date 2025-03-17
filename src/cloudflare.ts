// 首先导入模拟环境
import './cloudflare-shims.ts'
import server from './lib/server.ts'
import Body from './lib/response/Body.ts'

// 新增类型定义
interface KoaContext {
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body: string
    href?: string
    path?: string
    type?: string
  }
  response: {
    status?: number
    headers?: Record<string, string>
    body?: any
    statusCode?: number
  }
  req?: any
  res?: any
  set?: (key: string, value: string) => void
  body?: any
  query?: any
  params?: any
  ip?: string
}

// 确保在 Cloudflare Workers 环境中正确设置环境变量
process.env.CLOUDFLARE_WORKER = 'true'

export default {
  async fetch(request: Request) {
    try {
      // 创建Koa兼容的上下文对象
      const url = new URL(request.url)
      const koaCtx: KoaContext = {
        request: {
          method: request.method,
          url: request.url,
          href: request.url,
          path: url.pathname,
          type: request.headers.get('content-type') || '',
          headers: Object.fromEntries(request.headers),
          body: await request.text(),
        },
        response: {
          status: 200,
          statusCode: 200,
          headers: {},
          body: null,
        },
        req: {
          headers: Object.fromEntries(request.headers),
        },
        res: {},
        query: Object.fromEntries(url.searchParams),
        params: {},
        ip: request.headers.get('cf-connecting-ip') || '',
        // 添加set方法模拟Koa的ctx.set
        set: function (key: string, value: string) {
          if (!this.response.headers) this.response.headers = {}
          this.response.headers[key] = value
        },
      }

      // 执行Koa中间件链
      await server.app.callback()(koaCtx as any)

      // 统一响应处理
      const responseStatus =
        koaCtx.response.statusCode || koaCtx.response.status || 200

      return new Response(JSON.stringify(koaCtx.body ?? koaCtx.response.body), {
        status: responseStatus,
        headers: new Headers({
          'Content-Type': 'application/json',
          ...(koaCtx.response.headers || {}),
        }),
      })
    } catch (error) {
      console.error('Cloudflare Worker 错误:', error)

      // 返回一个有效的响应对象
      return new Response(
        JSON.stringify({
          error: '服务器内部错误',
          message: error.message || '未知错误',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }
  },
}
