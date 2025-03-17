import mime from 'mime';
import _ from 'lodash';

import Body from './Body.ts';
import util from '../util.ts';

export interface ResponseOptions {
    statusCode?: number;
    type?: string;
    headers?: Record<string, any>;
    redirect?: string;
    body?: any;
    size?: number;
    time?: number;
}

export default class Response {

    /** 响应HTTP状态码 */
    statusCode: number;
    /** 响应内容类型 */
    type: string;
    /** 响应headers */
    headers: Record<string, any>;
    /** 重定向目标 */
    redirect: string;
    /** 响应载荷 */
    body: any;
    /** 响应载荷大小 */
    size: number;
    /** 响应时间戳 */
    time: number;

    constructor(body: any, options: ResponseOptions = {}) {
        const { statusCode, type, headers, redirect, size, time } = options;
        this.statusCode = Number(_.defaultTo(statusCode, Body.isInstance(body) ? body.statusCode : undefined))
        this.type = type;
        this.headers = headers;
        this.redirect = redirect;
        this.size = size;
        this.time = Number(_.defaultTo(time, util.timestamp()));
        this.body = body;
    }

    injectTo(ctx) {
        // 确保存在有效的响应对象
        if (!ctx.response) {
            ctx.response = {
                status: 200,
                statusCode: 200,
                headers: {},
                body: null
            };
        }
        
        // 设置状态码（兼容Koa和Cloudflare两种方式）
        const statusCode = this.body?.statusCode || 200;
        ctx.response.status = statusCode;
        ctx.response.statusCode = statusCode;
        
        // 设置响应体
        ctx.body = this.body instanceof Body ? this.body.toObject() : this.body;
        
        // 处理响应头
        if (this.headers) {
            for (const [key, value] of Object.entries(this.headers)) {
                ctx.set(key, value);
            }
        }
    }

    static isInstance(value) {
        return value instanceof Response;
    }

}