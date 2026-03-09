#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const script = path.join(__dirname, '..', 'index.js');

const child = spawn(process.execPath, [script, ...args], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => process.exit(code || 0));
