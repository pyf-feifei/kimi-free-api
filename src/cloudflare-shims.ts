// 模拟 Node.js 环境和文件系统
if (typeof globalThis.process === 'undefined') {
  // @ts-ignore
  globalThis.process = { env: {} };
}

// 设置环境变量
globalThis.process.env.CLOUDFLARE_WORKER = 'true';
globalThis.process.env.TZ = 'Asia/Shanghai';

// 模拟 fs 模块
const mockFs = {
  readFileSync: (path, options) => {
    console.log(`模拟读取文件: ${path}`);
    // 为配置文件返回默认配置
    if (typeof path === 'string') {
      if (path.includes('service.yml')) {
        return `
# 服务名称
name: kimi-free-api
# 服务绑定主机地址
host: '0.0.0.0'
# 服务绑定端口
port: 8000
`;
      }
      if (path.includes('system.yml')) {
        return `
# 是否开启请求日志
requestLog: true
# 临时目录路径
tmpDir: ./tmp
# 日志目录路径
logDirPath: ./logs
# 日志写入间隔(ms)
logWriteInterval: 1000
`;
      }
    }
    return '';
  },
  existsSync: (path) => {
    // 对配置文件返回true
    if (typeof path === 'string' && (path.includes('service.yml') || path.includes('system.yml'))) {
      return true;
    }
    return false;
  },
  writeFileSync: () => {},
  appendFileSync: () => {},
  mkdirSync: () => {},
  readdirSync: () => [],
  statSync: () => ({ isDirectory: () => false }),
  ensureDirSync: () => {},
  pathExistsSync: (path) => {
    // 对配置文件返回true
    if (typeof path === 'string' && (path.includes('service.yml') || path.includes('system.yml'))) {
      return true;
    }
    return false;
  },
  appendFile: () => Promise.resolve(),
  ensureDir: () => Promise.resolve()
};

// 模拟 path 模块
const mockPath = {
  join: (...args) => args.join('/'),
  resolve: (...args) => args.join('/'),
  dirname: (p) => p.split('/').slice(0, -1).join('/')
};

// 注入模拟模块到全局
// @ts-ignore
globalThis.require = function(mod) {
  if (mod === 'fs' || mod === 'fs-extra') {
    return mockFs;
  }
  if (mod === 'path') {
    return mockPath;
  }
  if (mod === 'yaml') {
    return {
      parse: (str) => {
        // 简单的YAML解析
        const result = {};
        const lines = str.split('\n');
        for (const line of lines) {
          if (line.trim() && !line.trim().startsWith('#')) {
            const parts = line.split(':');
            if (parts.length >= 2) {
              const key = parts[0].trim();
              const value = parts.slice(1).join(':').trim();
              if (key) {
                // 处理引号
                if (value.startsWith("'") && value.endsWith("'")) {
                  result[key] = value.slice(1, -1);
                } else if (!isNaN(Number(value))) {
                  result[key] = Number(value);
                } else if (value === 'true') {
                  result[key] = true;
                } else if (value === 'false') {
                  result[key] = false;
                } else {
                  result[key] = value;
                }
              }
            }
          }
        }
        return result;
      }
    };
  }
  throw new Error(`模块 ${mod} 不可用`);
};

// 特别处理 date-fns 库
// 拦截 date-fns 的 differenceInCalendarDays 模块
const originalImport = globalThis.import;
// @ts-ignore
globalThis.import = async function(...args) {
  const modulePath = args[0];
  if (typeof modulePath === 'string' && modulePath.includes('date-fns')) {
    // 如果是 date-fns 相关模块，提供一个不使用 fs 的版本
    if (modulePath.includes('differenceInCalendarDays')) {
      return {
        default: (date1, date2) => {
          const time1 = new Date(date1).getTime();
          const time2 = new Date(date2).getTime();
          const diffTime = Math.abs(time2 - time1);
          return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
      };
    }
  }
  return originalImport ? originalImport.apply(this, args) : undefined;
};

// 完整模拟 Buffer 实现
if (typeof globalThis.Buffer === 'undefined') {
  class MockBuffer {
    private data: Uint8Array;
    
    constructor(input: string | number | ArrayBuffer | Uint8Array) {
      if (typeof input === 'number') {
        this.data = new Uint8Array(input);
      } else if (typeof input === 'string') {
        this.data = new TextEncoder().encode(input);
      } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
        this.data = new Uint8Array(input);
      } else {
        this.data = new Uint8Array(0);
      }
    }

    toString(encoding?: string): string {
      return new TextDecoder().decode(this.data);
    }

    get length(): number {
      return this.data.length;
    }

    slice(start?: number, end?: number): MockBuffer {
      return new MockBuffer(this.data.slice(start, end));
    }

    subarray(start?: number, end?: number): MockBuffer {
      return new MockBuffer(this.data.subarray(start, end));
    }

    write(string: string, offset?: number): number {
      const encoded = new TextEncoder().encode(string);
      const actualOffset = offset || 0;
      this.data.set(encoded, actualOffset);
      return encoded.length;
    }

    toJSON(): { type: string; data: number[] } {
      return {
        type: 'Buffer',
        data: Array.from(this.data)
      };
    }

    static concat(buffers: MockBuffer[]): MockBuffer {
      // 计算总长度
      const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
      const result = new Uint8Array(totalLength);
      
      let offset = 0;
      for (const buf of buffers) {
        result.set(buf.data, offset);
        offset += buf.length;
      }
      
      return new MockBuffer(result);
    }

    static from(data: string | ArrayBuffer | Uint8Array): MockBuffer {
      return new MockBuffer(data);
    }
  }

  // @ts-ignore
  globalThis.Buffer = MockBuffer;
}

console.log('Cloudflare 环境模拟已加载');