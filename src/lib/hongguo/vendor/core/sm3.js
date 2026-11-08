'use strict';
/**
 * SM3 纯 JS 实现（GB/T 32905-2016）。
 *
 * 用于 Node 运行时缺少 OpenSSL SM3 支持的环境（如精简构建的 serverless 镜像），
 * 输出与 crypto.createHash('sm3') 字节级一致。
 */
const IV = [
  0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
  0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
];

function rotl(x, n) {
  const k = n & 31;
  return ((x << k) | (x >>> ((32 - k) & 31))) | 0;
}

function p0(x) {
  return (x ^ rotl(x, 9) ^ rotl(x, 17)) | 0;
}

function p1(x) {
  return (x ^ rotl(x, 15) ^ rotl(x, 23)) | 0;
}

function ff(x, y, z, j) {
  return j < 16 ? (x ^ y ^ z) | 0 : ((x & y) | (x & z) | (y & z)) | 0;
}

function gg(x, y, z, j) {
  return j < 16 ? (x ^ y ^ z) | 0 : ((x & y) | (~x & z)) | 0;
}

const T0 = 0x79cc4519;
const T1 = 0x7a879d8a;

function compress(v, block, off) {
  const w = new Int32Array(68);
  const w1 = new Int32Array(64);
  for (let i = 0; i < 16; i++) {
    w[i] = (block[off + i * 4] << 24) | (block[off + i * 4 + 1] << 16)
      | (block[off + i * 4 + 2] << 8) | block[off + i * 4 + 3];
  }
  for (let j = 16; j < 68; j++) {
    w[j] = p1(w[j - 16] ^ w[j - 9] ^ rotl(w[j - 3], 15))
      ^ rotl(w[j - 13], 7) ^ w[j - 6];
  }
  for (let j = 0; j < 64; j++) w1[j] = w[j] ^ w[j + 4];

  let a = v[0], b = v[1], c = v[2], d = v[3];
  let e = v[4], f = v[5], g = v[6], h = v[7];

  for (let j = 0; j < 64; j++) {
    const t = (j < 16 ? T0 : T1) | 0;
    const tRot = rotl(t, j) | 0;
    const ss1 = rotl((rotl(a, 12) + e + tRot) | 0, 7);
    const ss2 = ss1 ^ rotl(a, 12);
    const tt1 = (ff(a, b, c, j) + d + ss2 + w1[j]) | 0;
    const tt2 = (gg(e, f, g, j) + h + ss1 + w[j]) | 0;
    d = c;
    c = rotl(b, 9);
    b = a;
    a = tt1;
    h = g;
    g = rotl(f, 19);
    f = e;
    e = p0(tt2);
  }

  v[0] = (v[0] ^ a) | 0;
  v[1] = (v[1] ^ b) | 0;
  v[2] = (v[2] ^ c) | 0;
  v[3] = (v[3] ^ d) | 0;
  v[4] = (v[4] ^ e) | 0;
  v[5] = (v[5] ^ f) | 0;
  v[6] = (v[6] ^ g) | 0;
  v[7] = (v[7] ^ h) | 0;
}

/** 计算 SM3 摘要，返回 32 字节 Buffer。 */
function sm3(data) {
  const msg = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = msg.length;
  const blocks = Math.floor(len / 64);
  const v = IV.slice();

  for (let i = 0; i < blocks; i++) compress(v, msg, i * 64);

  // 填充：剩余部分 + 0x80 + 0x00... + 64 位大端消息长度（比特）
  const rest = len - blocks * 64;
  const padLen = rest < 56 ? 64 : 128;
  const tail = Buffer.alloc(padLen);
  msg.copy(tail, 0, blocks * 64);
  tail[rest] = 0x80;
  const bits = BigInt(len) * 8n;
  tail[padLen - 8] = Number((bits >> 56n) & 0xffn);
  tail[padLen - 7] = Number((bits >> 48n) & 0xffn);
  tail[padLen - 6] = Number((bits >> 40n) & 0xffn);
  tail[padLen - 5] = Number((bits >> 32n) & 0xffn);
  tail[padLen - 4] = Number((bits >> 24n) & 0xffn);
  tail[padLen - 3] = Number((bits >> 16n) & 0xffn);
  tail[padLen - 2] = Number((bits >> 8n) & 0xffn);
  tail[padLen - 1] = Number(bits & 0xffn);

  for (let i = 0; i < padLen / 64; i++) compress(v, tail, i * 64);

  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) out.writeInt32BE(v[i], i * 4);
  return out;
}

module.exports = sm3;
