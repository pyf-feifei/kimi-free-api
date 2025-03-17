import path from 'path';

import fs from 'fs-extra';
import minimist from 'minimist';
import _ from 'lodash';

const cmdArgs = minimist(process.argv.slice(2));  //获取命令行参数
const envVars = process.env;  //获取环境变量

class Environment {

    /** 命令行参数 */
    cmdArgs: any;
    /** 环境变量 */
    envVars: any;
    /** 环境名称 */
    env?: string;
    /** 服务名称 */
    name?: string;
    /** 服务地址 */
    host?: string;
    /** 服务端口 */
    port?: number;
    /** 包参数 */
    package: any;

    constructor(options: any = {}) {
        const { cmdArgs, envVars, package: _package } = options;
        this.cmdArgs = cmdArgs;
        this.envVars = envVars;
        this.env = _.defaultTo(cmdArgs.env || envVars.SERVER_ENV, 'dev');
        this.name = cmdArgs.name || envVars.SERVER_NAME || undefined;
        this.host = cmdArgs.host || envVars.SERVER_HOST || undefined;
        this.port = Number(cmdArgs.port || envVars.SERVER_PORT) ? Number(cmdArgs.port || envVars.SERVER_PORT) : undefined;
        this.package = _package;
    }

}

export default new Environment({
    cmdArgs,
    envVars,
    package: JSON.parse(fs.readFileSync(path.join(path.resolve(), "package.json")).toString())
});


export function loadConfig() {
  // 检查是否在Cloudflare环境中
  const isCloudflareEnv = typeof process.env.CLOUDFLARE_WORKER !== 'undefined';
  
  if (isCloudflareEnv) {
    // 在Cloudflare环境中使用硬编码配置
    return {
      service: {
        name: 'kimi-free-api',
        host: '0.0.0.0',
        port: 8000,
        urlPrefix: ''
      },
      system: {
        requestLog: true,
        tmpDir: './tmp',
        logDirPath: './logs',
        logWriteInterval: 200,
        logFileExpires: 2626560000,
        publicDir: './public',
        tmpFileExpires: 86400000,
        requestBody: {
          // 请求体配置
          multipart: true,
          formidable: {
            maxFileSize: 200 * 1024 * 1024
          }
        }
      }
    };
  } else {
    // 在非Cloudflare环境中正常读取文件
    // 原有的文件读取逻辑
    // ...
  }
}