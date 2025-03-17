// 首先导入模拟环境
import './cloudflare-shims.ts';
import server from './lib/server.ts';
import Body from './lib/response/Body.ts';

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
process.env.CLOUDFLARE_WORKER = 'true';

export default {
  async fetch(request: Request) {
    try {
      // 创建Koa兼容的上下文对象
      const url = new URL(request.url);
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
          body: null
        },
        req: {
          headers: Object.fromEntries(request.headers)
        },
        res: {},
        query: Object.fromEntries(url.searchParams),
        params: {},
        ip: request.headers.get('cf-connecting-ip') || '',
        // 添加set方法模拟Koa的ctx.set
        set: function(key: string, value: string) {
          if (!this.response.headers) this.response.headers = {};
          this.response.headers[key] = value;
        }
      }
      
      // 执行Koa中间件链
      await server.app.callback()(koaCtx as any)
      
      // 转换响应格式 - 确保响应体是字符串或可序列化的对象
      let responseBody = koaCtx.body !== undefined ? koaCtx.body : koaCtx.response.body;
      
      // 如果响应体是对象，尝试序列化
      if (typeof responseBody === 'object' && responseBody !== null && !(responseBody instanceof ReadableStream)) {
        try {
          responseBody = JSON.stringify(responseBody);
        } catch (e) {
          console.error('响应体序列化失败:', e);
        }
      }
      
      return new Response(responseBody, {
        status: koaCtx.response.status || 200,
        headers: new Headers({
          ...koaCtx.response.headers || {},
          'Content-Type': 'application/json'
        })
      });
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
