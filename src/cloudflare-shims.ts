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
  readFileSync: () => '',
  existsSync: () => false,
  writeFileSync: () => {},
  appendFileSync: () => {},
  mkdirSync: () => {},
  readdirSync: () => [],
  statSync: () => ({ isDirectory: () => false }),
  ensureDirSync: () => {},
  pathExistsSync: () => false
};

// 模拟 path 模块
const mockPath = {
  join: (...args) => args.join('/'),
  resolve: (...args) => args.join('/'),
  dirname: (p) => p.split('/').slice(0, -1).join('/')
};

// 注入模拟模块
// @ts-ignore
globalThis.require = function(mod) {
  if (mod === 'fs' || mod === 'fs-extra') {
    return mockFs;
  }
  if (mod === 'path') {
    return mockPath;
  }
  throw new Error(`模块 ${mod} 不可用`);
};