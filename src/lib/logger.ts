import path from 'path';
import _util from 'util';

import 'colors';
import _ from 'lodash';
import fs from 'fs-extra';
import { format as dateFormat } from 'date-fns';

import config from './config.ts';
import util from './util.ts';

const isVercelEnv = process.env.VERCEL;

class LogWriter {

    #buffers?: any[] = [];

    constructor() {
        // 在Cloudflare环境中不使用文件系统
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        if (!isVercelEnv && !isCloudflareEnv) {
            fs.ensureDirSync(config.system.logDirPath);
            this.work();
            // 只有在非Cloudflare环境中初始化buffers
            this.#buffers = [];
        }
    }

    // 修改writeSync方法
    writeSync(buffer) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        if (!isVercelEnv && !isCloudflareEnv) {
            fs.appendFileSync(path.join(config.system.logDirPath, `/${util.getDateString()}.log`), buffer);
        }
    }

    async write(buffer) {
        !isVercelEnv && await fs.appendFile(path.join(config.system.logDirPath, `/${util.getDateString()}.log`), buffer);
    }

    flush() {
        if(!this.#buffers.length) return;
        !isVercelEnv && fs.appendFileSync(path.join(config.system.logDirPath, `/${util.getDateString()}.log`), Buffer.concat(this.#buffers));
    }

    work() {
        if (!this.#buffers.length) return setTimeout(this.work.bind(this), config.system.logWriteInterval);
        const buffer = Buffer.concat(this.#buffers);
        this.#buffers = [];
        this.write(buffer)
        .finally(() => setTimeout(this.work.bind(this), config.system.logWriteInterval))
        .catch(err => console.error("Log write error:", err));
    }

    // 添加push方法
    push(content) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        if (isCloudflareEnv) {
            // 在Cloudflare环境中直接输出到控制台
            console.log(content);
            return;
        }
        
        // 确保buffers存在
        if (this.#buffers) {
            this.#buffers.push(Buffer.from(content));
        }
    }

    // 添加destroy方法（注意拼写）
    destroy() {
        // 清理资源
        if (this.#buffers) {
            this.flush();
            this.#buffers = [];
        }
    }
}

class LogText {

    /** @type {string} 日志级别 */
    level;
    /** @type {string} 日志文本 */
    text;
    /** @type {string} 日志来源 */
    source;
    /** @type {Date} 日志发生时间 */
    time = new Date();

    constructor(level, ...params) {
        this.level = level;
        this.text = _util.format.apply(null, params);
        this.source = this.#getStackTopCodeInfo();
    }

    #getStackTopCodeInfo() {
        const unknownInfo = { name: "unknown", codeLine: 0, codeColumn: 0 };
        const stackArray = new Error().stack.split("\n");
        const text = stackArray[4];
        if (!text)
            return unknownInfo;
        const match = text.match(/at (.+) \((.+)\)/) || text.match(/at (.+)/);
        if (!match || !_.isString(match[2] || match[1]))
            return unknownInfo;
        const temp = match[2] || match[1];
        const _match = temp.match(/([a-zA-Z0-9_\-\.]+)\:(\d+)\:(\d+)$/);
        if (!_match)
            return unknownInfo;
        const [, scriptPath, codeLine, codeColumn] = _match as any;
        return {
            name: scriptPath ? scriptPath.replace(/.js$/, "") : "unknown",
            path: scriptPath || null,
            codeLine: parseInt(codeLine || 0),
            codeColumn: parseInt(codeColumn || 0)
        };
    }

    toString() {
        return `[${dateFormat(this.time, "yyyy-MM-dd HH:mm:ss.SSS")}][${this.level}][${this.source.name}<${this.source.codeLine},${this.source.codeColumn}>] ${this.text}`;
    }

}

class Logger {

    /** @type {Object} 系统配置 */
    config = {};
    /** @type {Object} 日志级别映射 */
    static Level = {
        Success: "success",
        Info: "info",
        Log: "log",
        Debug: "debug",
        Warning: "warning",
        Error: "error",
        Fatal: "fatal"
    };
    /** @type {Object} 日志级别文本颜色樱色 */
    static LevelColor = {
        [Logger.Level.Success]: "green",
        [Logger.Level.Info]: "brightCyan",
        [Logger.Level.Debug]: "white",
        [Logger.Level.Warning]: "brightYellow",
        [Logger.Level.Error]: "brightRed",
        [Logger.Level.Fatal]: "red"
    };
    #writer?: LogWriter;

    constructor() {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        if (!isCloudflareEnv) {
            this.#writer = new LogWriter();
        }
    }

    header() {
        this.#writer.writeSync(Buffer.from(`\n\n===================== LOG START ${dateFormat(new Date(), "yyyy-MM-dd HH:mm:ss.SSS")} =====================\n\n`));
    }

    footer() {
        this.#writer.flush();  //将未写入文件的日志缓存写入
        this.#writer.writeSync(Buffer.from(`\n\n===================== LOG END ${dateFormat(new Date(), "yyyy-MM-dd HH:mm:ss.SSS")} =====================\n\n`));
    }

    success(...params) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        const content = new LogText(Logger.Level.Success, ...params).toString();
        console.info(content[Logger.LevelColor[Logger.Level.Success]]);
        if (!isCloudflareEnv && this.#writer) {
            this.#writer.push(content + "\n");
        }
    }

    info(...params) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        const content = new LogText(Logger.Level.Info, ...params).toString();
        console.info(content[Logger.LevelColor[Logger.Level.Info]]);
        if (!isCloudflareEnv && this.#writer) {
            this.#writer.push(content + "\n");
        }
    }

    log(...params) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        const content = new LogText(Logger.Level.Log, ...params).toString();
        console.log(content[Logger.LevelColor[Logger.Level.Log]]);
        if (!isCloudflareEnv && this.#writer) {
            this.#writer.push(content + "\n");
        }
    }

    debug(...params) {
        if(!config.system.debug) return;  //非调试模式忽略debug
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        const content = new LogText(Logger.Level.Debug, ...params).toString();
        console.debug(content[Logger.LevelColor[Logger.Level.Debug]]);
        if (!isCloudflareEnv && this.#writer) {
            this.#writer.push(content + "\n");
        }
    }

    warn(...params) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        const content = new LogText(Logger.Level.Warning, ...params).toString();
        console.warn(content[Logger.LevelColor[Logger.Level.Warning]]);
        if (!isCloudflareEnv && this.#writer) {
            this.#writer.push(content + "\n");
        }
    }

    error(...params) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        const content = new LogText(Logger.Level.Error, ...params).toString();
        console.error(content[Logger.LevelColor[Logger.Level.Error]]);
        if (!isCloudflareEnv && this.#writer) {
            this.#writer.push(content);
        }
    }

    fatal(...params) {
        const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
        const content = new LogText(Logger.Level.Fatal, ...params).toString();
        console.error(content[Logger.LevelColor[Logger.Level.Fatal]]);
        if (!isCloudflareEnv && this.#writer) {
            this.#writer.push(content);
        }
    }

    // 修正拼写错误
    destroy() {
        if (this.#writer) {
            this.#writer.destroy();
        }
    }
}

export default new Logger();