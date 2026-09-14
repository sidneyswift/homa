const { syncBuiltinESMExports } = require('node:module');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const dgram = require('node:dgram');

const attempts = [];
const deny = (kind) => function () { attempts.push(kind); throw Object.assign(new Error('NETWORK_DISABLED:' + kind), {code: 'NETWORK_DISABLED'}); };
globalThis.__startupNetworkAttempts = attempts;
globalThis.fetch = deny('fetch');
for (const [name, module] of Object.entries({http, https})) {
  module.request = deny(name + '.request');
  module.get = deny(name + '.get');
}
net.connect = deny('net.connect');
net.createConnection = deny('net.createConnection');
net.Socket.prototype.connect = deny('socket.connect');
tls.connect = deny('tls.connect');
for (const key of ['lookup','resolve','resolve4','resolve6','resolveAny']) {
  dns[key] = deny('dns.' + key);
  if(dns.promises[key]) dns.promises[key] = deny('dns.promises.' + key);
}
dgram.Socket.prototype.send = deny('dgram.send');
syncBuiltinESMExports();
