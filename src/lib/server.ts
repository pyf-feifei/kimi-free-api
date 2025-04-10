import Koa from 'koa'
import KoaRouter from 'koa-router'
import koaRange from 'koa-range'
import koaCors from 'koa2-cors'
import koaBody from 'koa-body'
import _ from 'lodash'

import Exception from './exceptions/Exception.ts'
import Request from './request/Request.ts'
import Response from './response/Response.js'
import FailureBody from './response/FailureBody.ts'
import EX from './consts/exceptions.ts'
import logger from './logger.ts'
import config from './config.ts'

class Server {
  app
  router

  // 在构造函数中增加请求转换中间件
  constructor() {
    this.app = new Koa()

    // 增强Cloudflare请求转换中间件
    this.app.use(async (ctx, next) => {
      if (process.env.CLOUDFLARE_WORKER === 'true') {
        // 确保请求对象结构完整
        if (!ctx.req) ctx.req = {}
        if (!ctx.req.headers) ctx.req.headers = {}

        // 处理content-type
        if (
          ctx.request.headers &&
          (ctx.request.headers['content-type'] === 'application/json' ||
            ctx.request.headers['Content-Type'] === 'application/json')
        ) {
          try {
            // 尝试解析JSON请求体
            if (typeof ctx.request.body === 'string') {
              ctx.request.body = JSON.parse(ctx.request.body)
            }
          } catch (e) {
            // 解析失败时保持原样
            logger.warn('JSON解析失败:', e)
          }
        }
      }
      await next()
    })
    
    // 添加Cloudflare环境错误处理中间件
    this.app.use(async (ctx, next) => {
      try {
        await next()
      } catch (err) {
        // 记录错误
        logger.error('请求处理错误:', err)

        // 检查是否在 Cloudflare 环境中
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined'

        // 设置状态码和响应
        if (err instanceof Exception) {
          // 确保 ctx.response 存在
          if (!ctx.response && isCloudflareEnv) {
            ctx.response = { status: 500, body: {} }
          }

          if (ctx.response) {
            ctx.response.status = err.httpStatusCode || 500
            ctx.body = {
              error: err.errmsg,
              message: err.message,
            }
          }
        } else {
          // 确保 ctx.response 存在
          if (!ctx.response && isCloudflareEnv) {
            ctx.response = { status: 500, body: {} }
          }

          if (ctx.response) {
            ctx.response.status = 500
            ctx.body = {
              error: '服务器内部错误',
              message: err.message || '未知错误',
            }
          }
        }
      }
    })
    
    this.app.use(koaCors())
    // 范围请求支持
    this.app.use(koaRange)
    this.router = new KoaRouter({ prefix: config.service.urlPrefix })
    // 前置处理异常拦截
    this.app.use(async (ctx: any, next: Function) => {
      if (
        ctx.request.type === 'application/xml' ||
        ctx.request.type === 'application/ssml+xml'
      )
        ctx.req.headers['content-type'] = 'text/xml'
      try {
        await next()
      } catch (err) {
        logger.error(err)
        const failureBody = new FailureBody(err)
        new Response(failureBody).injectTo(ctx)
      }
    })
    // 载荷解析器支持
    this.app.use(koaBody(_.clone(config.system.requestBody)))
    this.app.on('error', (err: any) => {
      // 忽略连接重试、中断、管道、取消错误
      if (
        ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECANCELED'].includes(err.code)
      )
        return
      logger.error(err)
    })
    logger.success('Server initialized')
  }

  /**
   * 附加路由
   *
   * @param routes 路由列表
   */
  attachRoutes(routes: any[]) {
    routes.forEach((route: any) => {
      const prefix = route.prefix || ''
      for (let method in route) {
        if (method === 'prefix') continue
        if (!_.isObject(route[method])) {
          logger.warn(`Router ${prefix} ${method} invalid`)
          continue
        }
        for (let uri in route[method]) {
          this.router[method](`${prefix}${uri}`, async (ctx) => {
            const { request, response } = await this.#requestProcessing(
              ctx,
              route[method][uri]
            )
            if (response != null && config.system.requestLog)
              logger.info(
                `<- ${request.method} ${request.url} ${
                  response.time - request.time
                }ms`
              )
          })
        }
      }
      logger.info(`Route ${config.service.urlPrefix || ''}${prefix} attached`)
    })
    this.app.use(this.router.routes())
    this.app.use((ctx: any) => {
      const request = new Request(ctx)
      logger.debug(
        `-> ${ctx.request.method} ${
          ctx.request.url
        } request is not supported - ${request.remoteIP || 'unknown'}`
      )
      // const failureBody = new FailureBody(new Exception(EX.SYSTEM_NOT_ROUTE_MATCHING, "Request is not supported"));
      // const response = new Response(failureBody);
      const message = `[请求有误]: 正确请求为 POST -> /v1/chat/completions，当前请求为 ${ctx.request.method} -> ${ctx.request.url} 请纠正`
      logger.warn(message)
      const failureBody = new FailureBody(new Error(message))
      const response = new Response(failureBody)
      response.injectTo(ctx)
      if (config.system.requestLog)
        logger.info(
          `<- ${request.method} ${request.url} ${
            response.time - request.time
          }ms`
        )
    })
  }

  /**
   * 请求处理
   *
   * @param ctx 上下文
   * @param routeFn 路由方法
   */
  #requestProcessing(ctx: any, routeFn: Function): Promise<any> {
    return new Promise((resolve) => {
      const request = new Request(ctx)
      try {
        if (config.system.requestLog)
          logger.info(`-> ${request.method} ${request.url}`)
        routeFn(request)
          .then((response) => {
            try {
              if (!Response.isInstance(response)) {
                const _response = new Response(response)
                _response.injectTo(ctx)
                return resolve({ request, response: _response })
              }
              response.injectTo(ctx)
              resolve({ request, response })
            } catch (err) {
              logger.error(err)
              const failureBody = new FailureBody(err)
              const response = new Response(failureBody)
              response.injectTo(ctx)
              resolve({ request, response })
            }
          })
          .catch((err) => {
            try {
              logger.error(err)
              const failureBody = new FailureBody(err)
              const response = new Response(failureBody)
              response.injectTo(ctx)
              resolve({ request, response })
            } catch (err) {
              logger.error(err)
              const failureBody = new FailureBody(err)
              const response = new Response(failureBody)
              response.injectTo(ctx)
              resolve({ request, response })
            }
          })
      } catch (err) {
        logger.error(err)
        const failureBody = new FailureBody(err)
        const response = new Response(failureBody)
        response.injectTo(ctx)
        resolve({ request, response })
      }
    })
  }

  /**
   * 监听端口
   */
  // 修改listen方法
  async listen() {
    if (process.env.CLOUDFLARE_WORKER === 'true') {
      logger.success('Running in Cloudflare Workers environment')
      return
    }

    const host = config.service.host
    const port = config.service.port
    await Promise.all([
      new Promise((resolve, reject) => {
        if (host === '0.0.0.0' || host === 'localhost' || host === '127.0.0.1')
          return resolve(null)
        this.app.listen(port, 'localhost', (err) => {
          if (err) return reject(err)
          resolve(null)
        })
      }),
      new Promise((resolve, reject) => {
        this.app.listen(port, host, (err) => {
          if (err) return reject(err)
          resolve(null)
        })
      }),
    ])
    logger.success(`Server listening on port ${port} (${host})`)
  }
}

export default new Server()
