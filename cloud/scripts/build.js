const esbuild = require('esbuild');
const path = require('path');

async function build() {
  // 打包 gateway
  await esbuild.build({
    entryPoints: ['functions/gateway/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/functions/gateway/index.js',
    external: ['mysql2'],
    format: 'cjs',
    sourcemap: false,
    minify: false,
  });
  console.log('Gateway built successfully');

  // 打包 authCallback
  await esbuild.build({
    entryPoints: ['functions/authCallback/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/functions/authCallback/index.js',
    external: ['mysql2'],
    format: 'cjs',
    sourcemap: false,
    minify: false,
  });
  console.log('AuthCallback built successfully');

  // 打包 dataSync
  await esbuild.build({
    entryPoints: ['functions/dataSync/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/functions/dataSync/index.js',
    external: ['mysql2'],
    format: 'cjs',
    sourcemap: false,
    minify: false,
  });
  console.log('DataSync built successfully');

  // 打包 initAdmin
  await esbuild.build({
    entryPoints: ['functions/initAdmin/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/functions/initAdmin/index.js',
    external: ['mysql2'],
    format: 'cjs',
    sourcemap: false,
    minify: false,
  });
  console.log('InitAdmin built successfully');
}

build().catch(console.error);
