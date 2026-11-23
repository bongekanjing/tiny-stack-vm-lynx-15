// Runs each instance's program.bin on its input.bin under make.fun's tiny stack ISA v1, writing
// /output/<id>/stdout.bin and /output/<id>/exit.txt. Node built-ins only; no clock, no network.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// One byte per opcode: immediate width << 4 | values popped << 2 | values pushed. 255 = no opcode.
const SH = new Uint8Array(256).fill(255);
const set = (o: number, i: number, p: number, q: number) => { SH[o] = (i << 4) | (p << 2) | q; };
for (const r of [[0, 0, 0, 0], [1, 1, 0, 1], [2, 4, 0, 1], [3, 0, 1, 0], [4, 0, 1, 2], [5, 0, 2, 2],
  [6, 0, 2, 3], [7, 0, 3, 3], [64, 0, 1, 1], [65, 0, 2, 0], [82, 0, 0, 1], [83, 0, 1, 0]]) set(r[0], r[1], r[2], r[3]);
for (let o = 16; o < 35; o++) if (o !== 31) set(o, 0, o === 23 || o === 27 ? 1 : 2, 1);
for (let o = 48; o < 53; o++) set(o, o < 52 ? 2 : 0, o === 49 || o === 50 ? 1 : 0, 0);
for (let o = 80; o < 84; o++) set(o, 0, o === 82 ? 0 : 1, o === 82 ? 1 : 0);

/** The bytes `code` wrote and the code it ended with, running on `feed`. */
function run(code: Uint8Array, feed: Uint8Array) {
  const n = code.length;
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const B = new Uint8Array(65536);
  let sp = 0, cp = 0, ol = 0, rp = 0, pc = 0, st = 0;
  const end = (exit: number) => ({ bytes: B.subarray(0, ol), exit });
  for (;;) {
    if (st === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = code[pc], s = SH[op];
    if (s === 255) return end(5);
    const im = s >> 4, nx = pc + 1 + im;
    if (pc + im >= n) return end(9);
    const po = (s >> 2) & 3;
    if (sp < po) return end(2);
    if (sp - po + (s & 3) > 256) return end(3);
    st++;
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1: D[sp++] = (code[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = code[nx - 4] | (code[nx - 3] << 8) | (code[nx - 2] << 16) | (code[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const t = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = t; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 48:
      case 49:
      case 50: {
        const rel = ((code[nx - 2] | (code[nx - 1] << 8)) << 16) >> 16;
        if (op === 48) { pc = nx + rel; break; }
        const v = D[--sp];
        if (op === 49 ? v === 0 : v !== 0) pc = nx + rel;
        break;
      }
      case 51:
        if (cp === 64) return end(7);
        C[cp++] = nx;
        pc = code[nx - 2] | (code[nx - 1] << 8);
        break;
      case 52:
        if (cp === 0) return end(8);
        pc = C[--cp];
        break;
      case 64: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        D[sp - 1] = M[a];
        break;
      }
      case 65: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        M[a] = D[sp - 2];
        sp -= 2;
        break;
      }
      case 80: {
        const t = String(D[sp - 1]);
        if (ol + t.length > 65536) return end(11);
        sp--;
        for (let k = 0; k < t.length; k++) B[ol++] = t.charCodeAt(k);
        break;
      }
      case 81:
        if (ol === 65536) return end(11);
        B[ol++] = D[--sp] & 255;
        break;
      case 82: D[sp++] = rp < feed.length ? feed[rp++] : -1; break;
      case 83: return end(D[--sp] & 255);
      default: {
        const b = D[sp - 1], a = D[sp - 2];
        let v = 0;
        switch (op) {
          case 16: v = (a + b) | 0; break;
          case 17: v = (a - b) | 0; break;
          case 18: v = Math.imul(a, b); break;
          case 19: if (b === 0) return end(4); v = a === -2147483648 && b === -1 ? a : (a / b) | 0; break;
          case 20: if (b === 0) return end(4); v = b === -1 ? 0 : a % b | 0; break;
          case 21: if (b === 0) return end(4); v = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
          case 22: if (b === 0) return end(4); v = ((a >>> 0) % (b >>> 0)) | 0; break;
          case 24: v = a & b; break;
          case 25: v = a | b; break;
          case 26: v = a ^ b; break;
          case 28: v = a << (b & 31); break;
          case 29: v = a >> (b & 31); break;
          case 30: v = (a >>> (b & 31)) | 0; break;
          case 32: v = a === b ? 1 : 0; break;
          case 33: v = a < b ? 1 : 0; break;
          default: v = (a >>> 0) < (b >>> 0) ? 1 : 0;
        }
        D[sp - 2] = v;
        sp--;
      }
    }
  }
}

const ids = readdirSync(I).sort();
for (const id of ids) {
  const code = new Uint8Array(readFileSync(join(I, id, 'program.bin')));
  const feed = new Uint8Array(readFileSync(join(I, id, 'input.bin')));
  const r = run(code, feed), d = join(O, id);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'stdout.bin'), Buffer.from(r.bytes));
  writeFileSync(join(d, 'exit.txt'), String(r.exit) + '\n');
}
