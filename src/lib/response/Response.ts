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
        // 确保 ctx.response 存在
        if (!ctx.response) {
            ctx.response = {};
        }
        
        // 设置状态码
        ctx.response.status = this.body.statusCode;
        
        // 设置响应体
        if (this.body instanceof Body) {
            ctx.body = this.body.toObject();
        } else {
            ctx.body = this.body;
        }
        
        // 设置响应头
        if (this.headers) {
            for (let key in this.headers) {
                ctx.set(key, this.headers[key]);
            }
        }
    }

    static isInstance(value) {
        return value instanceof Response;
    }

}