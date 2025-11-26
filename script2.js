(() => {
const Game = window.Game || (window.Game = {});

// ----------------- Konfiguracja świata i dnia -----------------
const WORLD = {
SIZE_X: 90000000,
SIZE_Z: 90000000,
SIZE_Y: 256,
SEA_LEVEL: 48,
SEED: 1337,
CHUNK_X: 16,
CHUNK_Y: 256,
CHUNK_Z: 16,
VIEW_RADIUS_CHUNKS: 5,
REACH: 6.0
};
const BOUNDS = {
HALF_X: WORLD.SIZE_X/2,
HALF_Z: WORLD.SIZE_Z/2,
MAX_CX: Math.floor((WORLD.SIZE_X/2) / WORLD.CHUNK_X),
MAX_CZ: Math.floor((WORLD.SIZE_Z/2) / WORLD.CHUNK_Z),
};
const DAY = { LENGTH_SEC: 1200, t: 0, doDayCycle: true };

const HOTBAR_SIZE = 9;
const MODE = { SURVIVAL:'survival', CREATIVE:'creative' };

const MULTI = { enabled:false, id:null, nick:null, room:'public', chan:null, peers:new Map(), lastState:0 };

// Zasięg poziomego rozlewania cieczy – logika jest w fluid_and_physics_water_lava.js
const FLUID = {
WATER_SPREAD_RADIUS: 16,
LAVA_SPREAD_RADIUS: 18
};

Object.assign(Game, {
WORLD,
BOUNDS,
DAY,
HOTBAR_SIZE,
MODE,
MULTI,
FLUID
});

Game.NETHER_Y_OFFSET = Game.NETHER_Y_OFFSET ?? -540;
Game.currentDimension = Game.currentDimension ?? 0;

// ----------------- Bloki -----------------
const BLOCK = {
AIR: 0,
GRASS: 1,
DIRT: 2,
STONE: 3,
DIORITE: 4,
ANDESITE: 5,
WATER: 6,
LOG: 7,
LEAVES: 8,
SAND: 9,
GRAVEL: 10,
OBSIDIAN: 11,
LAVA: 12,
BIRCH_LOG: 13,
BIRCH_PLANKS: 14,
ACACIA_LOG: 15,
ACACIA_PLANKS: 16,
CHERRY_LOG: 17,
CHERRY_PLANKS: 18,
MANGROVE_LOG: 19,
MANGROVE_PLANKS: 20,
SPRUCE_LOG: 21,
SPRUCE_PLANKS: 22,
TORCH: 23,
BIRCH_LEAVES: 24,
ACACIA_LEAVES: 25,
CHERRY_LEAVES: 26,
MANGROVE_LEAVES: 27,
SPRUCE_LEAVES: 28
};
const BLOCK_INFO = {
0: { name:'Powietrze', solid:false, transparent:true },
1: { name:'Trawa', solid:true, transparent:false },
2: { name:'Ziemia', solid:true, transparent:false },
3: { name:'Kamień', solid:true, transparent:false },
4: { name:'Dioryt', solid:true, transparent:false },
5: { name:'Andezyt', solid:true, transparent:false },
6: { name:'Woda', solid:false, transparent:true },
7: { name:'Pień', solid:true, transparent:false },
8: { name:'Liście', solid:true, transparent:false },
9: { name:'Piach', solid:true, transparent:false },
10: { name:'Żwir', solid:true, transparent:false },
11: { name:'Obsydian', solid:true, transparent:false },
12: { name:'Lawa', solid:false, transparent:true, emissive:15 },
13: { name:'Pień brzozowy', solid:true, transparent:false },
14: { name:'Deski brzozowe', solid:true, transparent:false },
15: { name:'Pień akacjowy', solid:true, transparent:false },
16: { name:'Deski akacjowe', solid:true, transparent:false },
17: { name:'Pień wiśniowy', solid:true, transparent:false },
18: { name:'Deski wiśniowe', solid:true, transparent:false },
19: { name:'Pień namorzynowy', solid:true, transparent:false },
20: { name:'Deski namorzynowe', solid:true, transparent:false },
21: { name:'Pień świerkowy', solid:true, transparent:false },
22: { name:'Deski świerkowe', solid:true, transparent:false },
23: { name:'Pochodnia', solid:false, transparent:true, emissive:15 },
24: { name:'Liście brzozowe', solid:true, transparent:false },
25: { name:'Liście akacjowe', solid:true, transparent:false },
26: { name:'Liście wiśniowe', solid:true, transparent:false },
27: { name:'Liście namorzynowe', solid:true, transparent:false },
28: { name:'Liście świerkowe', solid:true, transparent:false }
};
function isTransparent(id){ return BLOCK_INFO[id]?.transparent; }
function isSolid(id){ return BLOCK_INFO[id]?.solid; }
function isCollectible(id){ return id!==BLOCK.AIR && id!==BLOCK.WATER && id!==BLOCK.LAVA; }

// ----------------- Stacki i ekwipunek -----------------
function makeStack(id, count){ return {id, count}; }
function addToInventory(inv, id, count){
for (let i=0;i<inv.slots.length && count>0;i++){
const s=inv.slots[i];
if (s && s.id===id && s.count<64){
const take = Math.min(64 - s.count, count);
s.count += take; count -= take;
}
}
for (let i=0;i<inv.slots.length && count>0;i++){
if (!inv.slots[i]){
const put = Math.min(64, count);
inv.slots[i] = makeStack(id, put);
count -= put;
}
}
return count;
}

const inventory = {
slots: new Array(36).fill(null),
cursor: null
};
inventory.slots[0] = makeStack(BLOCK.SPRUCE_PLANKS, 32);
inventory.slots[1] = makeStack(BLOCK.TORCH, 16);

// ----------------- DOM / WebGL -----------------
const gameEl = document.getElementById('game');
const glCanvas = document.getElementById('gl');
const hudCanvas= document.getElementById('hud');
const overlay = document.getElementById('overlay');
const spBtn = document.getElementById('spBtn');
const mpBtn = document.getElementById('mpBtn');
const joinBtn = document.getElementById('joinBtn');
const mpForm = document.getElementById('mpForm');
const nickInput= document.getElementById('nickInput');
const mpHint = document.getElementById('mpHint');

const invEl = document.getElementById('inv');
const invGrid = document.getElementById('invGrid');
const invWrap = document.getElementById('survWrap');
const hotbarRow= document.getElementById('hotbarRow');
const bagGrid = document.getElementById('bagGrid');
const invTitle = document.getElementById('invTitle');
const invHelp = document.getElementById('invHelp');
const invClose = document.getElementById('invClose');

const cursorEl = document.getElementById('cursorStack');
const cursorCv = document.getElementById('cursorCanvas');
const cursorCtx = cursorCv.getContext('2d');
const cursorCnt = document.getElementById('cursorCount');

const chatLogEl = document.getElementById('chatLog');
const chatWrapEl = document.getElementById('chatWrap');
const chatInput = document.getElementById('chatInput');

const gl = glCanvas.getContext('webgl', { antialias:true, alpha:false, premultipliedAlpha:false });
if (!gl) { alert('WebGL jest wymagany.'); return; }

Game.gl = gl;

function resize() {
const rect = gameEl.getBoundingClientRect();
const dpr = Math.min(2, window.devicePixelRatio || 1);
glCanvas.width = Math.max(2, Math.floor(rect.width * dpr));
glCanvas.height = Math.max(2, Math.floor(rect.height * dpr));
hudCanvas.width = glCanvas.width;
hudCanvas.height = glCanvas.height;
gl.viewport(0,0,glCanvas.width, glCanvas.height);
}
window.addEventListener('resize', resize);

// ----------------- Matryce / math -----------------
function mat4Perspective(fovy, aspect, near, far) {
const f = 1.0 / Math.tan(fovy/2);
const nf = 1/(near - far);
const out = new Float32Array(16);
out[0] = f/aspect; out[1]=0; out[2]=0; out[3]=0;
out[4] = 0; out[5]=f; out[6]=0; out[7]=0;
out[8] = 0; out[9]=0; out[10]=(far+near)nf; out[11]=-1;
out[12]=0; out[13]=0; out[14]=(2farnear)nf; out[15]=0;
return out;
}
function mat4LookAt(eye, center, up) {
const [ex,ey,ez] = eye, [cx,cy,cz] = center;
let zx = ex - cx, zy = ey - cy, zz = ez - cz;
let len = Math.hypot(zx,zy,zz); zx/=len; zy/=len; zz/=len;
let xx = up[1]zz - up[2]zy;
let xy = up[2]zx - up[0]zz;
let xz = up[0]zy - up[1]zx;
len = Math.hypot(xx,xy,xz); xx/=len; xy/=len; xz/=len;
let yx = zyxz - zzxy;
let yy = zzxx - zxxz;
let yz = zxxy - zyxx;
const out = new Float32Array(16);
out[0]=xx; out[1]=yx; out[2]=zx; out[3]=0;
out[4]=xy; out[5]=yy; out[6]=zy; out[7]=0;
out[8]=xz; out[9]=yz; out[10]=zz; out[11]=0;
out[12]=-(xxex + xyey + xzez);
out[13]=-(yxex + yyey + yzez);
out[14]=-(zxex + zyey + zz*ez);
out[15]=1;
return out;
}

function matMul(a,b){
const out = new Float32Array(16);
for (let c=0;c<4;c++){
for (let r=0;r<4;r++){
out[c4 + r] =
a[04 + r]b[c4 + 0] +
a[14 + r]b[c4 + 1] +
a[24 + r]b[c4 + 2] +
a[3*4 + r]b[c4 + 3];
}
}
return out;
}

function transformVec4(m, v){
const x=v[0],y=v[1],z=v[2],w=v[3];
return [
m[0]*x + m[4]*y + m[8]*z + m[12]*w,
m[1]*x + m[5]*y + m[9]*z + m[13]*w,
m[2]*x + m[6]*y + m[10]*z + m[14]*w,
m[3]*x + m[7]*y + m[11]*z + m[15]*w
];
}

const MAX_LIGHTS = 32;
const VS = attribute vec3 a_pos; attribute vec3 a_norm; attribute vec2 a_uv; attribute float a_emis; uniform mat4 u_proj, u_view; uniform vec3 u_origin; varying vec2 v_uv; varying vec3 v_norm; varying vec3 v_pos; varying float v_emis; void main(){ vec3 posRel = a_pos - u_origin; v_uv = a_uv; v_norm = a_norm; v_pos = posRel; v_emis = a_emis; gl_Position = u_proj * u_view * vec4(posRel, 1.0); };
const FS = precision mediump float; uniform sampler2D u_tex; uniform vec3 u_sunDir; uniform float u_sunIntensity; uniform float u_ambient; uniform int u_lightCount; uniform vec3 u_lightsPos[+MAX_LIGHTS+]; uniform float u_lightsInt[+MAX_LIGHTS+]; uniform vec3 u_lightsCol[+MAX_LIGHTS+]; uniform float u_lightRadius; varying vec2 v_uv; varying vec3 v_norm; varying vec3 v_pos; varying float v_emis; void main(){ vec4 tex = texture2D(u_tex, v_uv); if (tex.a < 0.03) discard; vec3 N = normalize(v_norm); float sunLambert = max(0.0, dot(N, normalize(u_sunDir))); float sunLight = sunLambert * u_sunIntensity; vec3 pointLightColor = vec3(0.0); for (int i=0; i<+MAX_LIGHTS+`; i++){
if (i >= u_lightCount) break;
vec3 Lvec = u_lightsPos[i] - v_pos;
float dist = length(Lvec);
if (dist < u_lightRadius){
float att = 1.0 - (dist / u_lightRadius);
float lam = max(0.0, dot(N, normalize(Lvec)));
float contrib = u_lightsInt[i] * lam * pow(att, 1.4);
pointLightColor += u_lightsCol[i] * contrib;
}
}

vec3 lightColor = vec3(u_ambient + sunLight) + pointLightColor + vec3(v_emis);
lightColor = clamp(lightColor, vec3(0.06), vec3(2.3));
gl_FragColor = vec4(tex.rgb * lightColor, tex.a);
}`;

function compileShader(type, src) {
const s = gl.createShader(type);
gl.shaderSource(s, src);
gl.compileShader(s);
if (!gl.getShaderParameter(s, gl.COMPLETE_STATUS)) {
console.error(gl.getShaderInfoLog(s));
throw new Error('Shader compile error');
}
return s;
}
function makeProgram(vs, fs) {
const p = gl.createProgram();
gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vs));
gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(p);
if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
console.error(gl.getProgramInfoLog(p));
throw new Error('Program link error');
}
return p;
}
const program = makeProgram(VS, FS);
gl.useProgram(program);
const loc = {
a_pos: gl.getAttribLocation(program,'a_pos'),
a_norm: gl.getAttribLocation(program,'a_norm'),
a_uv: gl.getAttribLocation(program,'a_uv'),
a_emis: gl.getAttribLocation(program,'a_emis'),
u_proj: gl.getUniformLocation(program,'u_proj'),
u_view: gl.getUniformLocation(program,'u_view'),
u_tex: gl.getUniformLocation(program,'u_tex'),
u_sunDir: gl.getUniformLocation(program,'u_sunDir'),
u_sunIntensity: gl.getUniformLocation(program,'u_sunIntensity'),
u_ambient: gl.getUniformLocation(program,'u_ambient'),
u_lightCount: gl.getUniformLocation(program,'u_lightCount'),
u_lightsPos0: gl.getUniformLocation(program,'u_lightsPos[0]'),
u_lightsInt0: gl.getUniformLocation(program,'u_lightsInt[0]'),
u_lightsCol0: gl.getUniformLocation(program,'u_lightsCol[0]'),
u_lightRadius: gl.getUniformLocation(program,'u_lightRadius'),
u_origin: gl.getUniformLocation(program,'u_origin'),
};

// ----------------- Szum / hash (seedowalny) -----------------
function seededPRNG(seed) {
let s = seed >>> 0;
return () => {
s = (s + 0x6D2B79F5) | 0;
let t = Math.imul(s ^ (s >>> 15), 1 | s);
t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}

function makePerlin(seed) {
const rand = seededPRNG(seed);
const p = new Uint8Array(512);
const perm = new Uint8Array(256);
for (let i = 0; i < 256; i++) perm[i] = i;
for (let i = 255; i > 0; i--) {
const j = (rand() * (i + 1)) | 0;
const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
}
for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
function fade(t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(h, x, y) {
switch (h & 3) {
case 0: return x + y;
case 1: return -x + y;
case 2: return x - y;
default: return -x - y;
}
}

return function noise(x, y) {
let X = Math.floor(x) & 255;
let Y = Math.floor(y) & 255;
x -= Math.floor(x);
y -= Math.floor(y);
const u = fade(x), v = fade(y);
const aa = p[p[X] + Y],
ab = p[p[X] + Y + 1],
ba = p[p[X + 1] + Y],
bb = p[p[X + 1] + Y + 1];
const g1 = grad(aa, x, y);
const g2 = grad(ba, x - 1, y);
const g3 = grad(ab, x, y - 1);
const g4 = grad(bb, x - 1, y - 1);
return lerp(lerp(g1, g2, u), lerp(g3, g4, u), v);
};
}

let _currentWorldSeed = WORLD.SEED;
let noise2d = makePerlin(_currentWorldSeed);

function fbm2(x, z, oct = 4, lac = 2, gain = 0.5, freq = 0.01) {
let amp = 1, f = freq, sum = 0, norm = 0;
for (let i = 0; i < oct; i++) {
sum += noise2d(x * f, z * f) * amp;
norm += amp;
amp *= gain;
f *= lac;
}
return sum / norm;
}

function hash2(x, z) {
let h = x * 374761393 + z * 668265263 + _currentWorldSeed * 374761393;
h = (h ^ (h >> 13)) | 0;
h = (h * 1274126177) | 0;
return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

Game.setWorldSeed = function (newSeed) {
let s;
if (typeof newSeed === 'string') s = parseInt(newSeed, 10);
else s = newSeed | 0;
if (!Number.isFinite(s)) s = 0;
_currentWorldSeed = s >>> 0;
WORLD.SEED = _currentWorldSeed;
noise2d = makePerlin(_currentWorldSeed);
console.log('[World] Ustawiono seed świata na', _currentWorldSeed);
};

// ----------------- Atlas -----------------
const atlas = { tile:16, cols:8, rows:8, canvas:document.createElement('canvas'), map:{}, blockTex:{} };
atlas.canvas.width = atlas.colsatlas.tile;
atlas.canvas.height= atlas.rowsatlas.tile;
const atlasCtx = atlas.canvas.getContext('2d');

function drawTile(u,v,drawer){ atlasCtx.save(); atlasCtx.translate(uatlas.tile, vatlas.tile); drawer(atlasCtx, atlas.tile); atlasCtx.restore(); return {u,v}; }
function reg(name, drawer){
const idx = Object.keys(atlas.map).length;
const u = idx % atlas.cols, v = (idx / atlas.cols)|0;
atlas.map[name] = drawTile(u,v,drawer);
}
function noiseFill(ctx, s, c1,c2,a=1, seed=1, speck=0.2){
const rand=seededPRNG(seed);
ctx.fillStyle=c1; ctx.globalAlpha=a; ctx.fillRect(0,0,s,s);
const img=ctx.getImageData(0,0,s,s), d=img.data;
const r2=parseInt(c2.slice(1,3),16), g2=parseInt(c2.slice(3,5),16), b2=parseInt(c2.slice(5,7),16);
for(let y=0;y<s;y++)for(let x=0;x<s;x++){
const i=(ys+x)4, n=rand();
d[i] = di+r2speckn;
d[i+1]= di+1+g2speckn;
d[i+2]= di+2+b2speck*n;
}
ctx.putImageData(img,0,0); ctx.globalAlpha=1;
}

function makeAtlas(){
const c2 = s => {
const t=document.createElement('canvas').getContext('2d');
t.canvas.width=t.canvas.height=s;
return t;
};
function blades(t,s){
t.strokeStyle='rgba(255,255,255,0.12)';
for(let i=0;i<10;i++){
t.beginPath();
t.moveTo(Math.random()*s, Math.random()*s);
t.lineTo(Math.random()*s, Math.random()*s);
t.stroke();
}
}

function leafBlock(ctx,s,col1,col2,seed){
const t=c2(s);
noiseFill(t,s,col1,col2,1,seed,0.30);
t.fillStyle='rgba(0,0,0,0.12)';
for(let i=0;i<25;i++){
t.fillRect(Math.random()*s, Math.random()*s,1,1);
}
ctx.drawImage(t.canvas,0,0);
}

function logAndPlanks(name, sA,sB, tA,tB, ring, seed, pA,pB,line){
reg('log_side_'+name,(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,sA,sB,1,seed,0.25);
t.strokeStyle='rgba(0,0,0,0.25)';
for(let x=3;x<s;x+=4){
t.beginPath();
t.moveTo(x,0);
t.lineTo(x,s);
t.stroke();
}
ctx.drawImage(t.canvas,0,0);
});
reg('log_top_'+name,(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,tA,tB,1,seed+1,0.2);
t.strokeStyle=ring;
for(let r=s0.1;r<s0.45;r+=s0.05){
t.beginPath();
t.arc(s/2,s/2,r,0,Math.PI2);
t.stroke();
}
ctx.drawImage(t.canvas,0,0);
});
reg('planks_'+name,(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,pA,pB,1,seed+2,0.2);
t.strokeStyle=line||'#000';
t.globalAlpha=0.25;
for(let y=s0.25;y<s;y+=s0.25){
t.beginPath();
t.moveTo(0,y);
t.lineTo(s,y);
t.stroke();
}
t.globalAlpha=1;
ctx.drawImage(t.canvas,0,0);
});
}

// ziemia / kamień / trawa itd.
reg('grass_top',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#388e3c','#2e7d32',1,11,0.25);
blades(t,s);
ctx.drawImage(t.canvas,0,0);
});
reg('grass_side',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#6d4c41','#5d4037',1,12,0.25);
t.fillStyle='#388e3c';
t.fillRect(0,0,s, s*0.35);
noiseFill(t,s,'#388e3c','#2e7d32',0.35,13,0.5);
ctx.drawImage(t.canvas,0,0);
});
reg('dirt',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#6d4c41','#5d4037',1,14,0.3);
ctx.drawImage(t.canvas,0,0);
});
reg('stone',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#919191','#808080',1,15,0.35);
ctx.drawImage(t.canvas,0,0);
});
reg('diorite',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#d7d7d7','#cacaca',1,16,0.35);
t.fillStyle='rgba(0,0,0,0.08)';
for(let i=0;i<20;i++)
t.fillRect(Math.random()*s, Math.random()*s,1,1);
ctx.drawImage(t.canvas,0,0);
});
reg('andesite',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#7d7d7d','#6e6e6e',1,17,0.35);
ctx.drawImage(t.canvas,0,0);
});

reg('sand',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#e4d6a1','#d9c893',1,101,0.25);
ctx.drawImage(t.canvas,0,0);
});
reg('gravel',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#8d8d8d','#9a9a9a',1,102,0.35);
ctx.drawImage(t.canvas,0,0);
});
reg('obsidian',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#1a0f2e','#2a164a',1,103,0.2);
ctx.drawImage(t.canvas,0,0);
});

reg('water',(ctx,s)=>{
const g=ctx.createLinearGradient(0,0,0,s);
g.addColorStop(0,'rgba(64,156,255,0.7)');
g.addColorStop(1,'rgba(24,86,180,0.6)');
ctx.fillStyle=g;
ctx.fillRect(0,0,s,s);
});

// lawa
reg('lava_top',(ctx,s)=>{
const g=ctx.createRadialGradient(s/2,s/2,s0.1,s/2,s/2,s0.7);
g.addColorStop(0.0,'rgba(255,245,200,1.0)');
g.addColorStop(0.3,'rgba(255,220,120,1.0)');
g.addColorStop(1.0,'rgba(230,70,30,1.0)');
ctx.fillStyle=g;
ctx.fillRect(0,0,s,s);
});
reg('lava_side',(ctx,s)=>{
const g=ctx.createLinearGradient(0,0,0,s);
g.addColorStop(0,'rgba(255,210,80,0.98)');
g.addColorStop(1,'rgba(190,50,20,0.9)');
ctx.fillStyle=g;
ctx.fillRect(0,0,s,s);
});

// LIŚCIE – pełne bloki
reg('leaves', (ctx,s)=> leafBlock(ctx,s,'#3a9b3a','#2b7b30',210));
reg('leaves_birch', (ctx,s)=> leafBlock(ctx,s,'#6fbe5c','#4caf50',211));
reg('leaves_acacia', (ctx,s)=> leafBlock(ctx,s,'#5f9c5c','#3b7d44',212));
reg('leaves_cherry', (ctx,s)=> leafBlock(ctx,s,'#e3a2c1','#c9799f',213));
reg('leaves_mangrove',(ctx,s)=> leafBlock(ctx,s,'#2f7e4c','#175b34',214));
reg('leaves_spruce', (ctx,s)=> leafBlock(ctx,s,'#2a5b3a','#1e402a',215));

// drewno / deski
logAndPlanks('birch', '#eae7cf','#dcd7b6', '#efe7c6','#e3dab6', 'rgba(140,120,70,0.35)', 310, '#efe7c6','#e3dab6','#b8ad7f');
logAndPlanks('acacia', '#d77f43','#c36a2f', '#e0a47a','#cd8e61', 'rgba(120,60,30,0.35)', 320, '#d07a40','#bd6a34','#8b4f21');
logAndPlanks('cherry', '#e592a8','#d37890', '#f3b9c6','#eaa6b6', 'rgba(170,80,110,0.35)', 330, '#f0a0b5','#e78aa3','#c7617a');
logAndPlanks('mangrove','#99423b','#7e342f', '#b16a64','#9b5751', 'rgba(120,50,50,0.35)', 340, '#a14b45','#8c3d38','#6c2d2a');
logAndPlanks('spruce', '#7a5a3a','#664b31', '#8e6b45','#7a5a3a', 'rgba(70,45,25,0.35)', 350, '#7b5c3d','#6a4f33','#4b3623');

reg('torch',(ctx,s)=>{
const t=c2(s);
noiseFill(t,s,'#ffed9a','#f1c15a',1,401,0.15);
ctx.drawImage(t.canvas,0,0);
});

const tex = {};
tex[BLOCK.GRASS] = {top:'grass_top', side:'grass_side', bottom:'dirt'};
tex[BLOCK.DIRT] = {all:'dirt'};
tex[BLOCK.STONE] = {all:'stone'};
tex[BLOCK.DIORITE] = {all:'diorite'};
tex[BLOCK.ANDESITE] = {all:'andesite'};
tex[BLOCK.SAND] = {all:'sand'};
tex[BLOCK.GRAVEL] = {all:'gravel'};
tex[BLOCK.OBSIDIAN] = {all:'obsidian'};
tex[BLOCK.WATER] = {all:'water'};
tex[BLOCK.LAVA] = {top:'lava_top', side:'lava_side', bottom:'lava_side'};
tex[BLOCK.TORCH] = {all:'torch'};

tex[BLOCK.LOG] = {top:'log_top_spruce', side:'log_side_spruce', bottom:'log_top_spruce'};
tex[BLOCK.LEAVES]= {all:'leaves'};

tex[BLOCK.BIRCH_LOG] = {top:'log_top_birch', side:'log_side_birch', bottom:'log_top_birch'};
tex[BLOCK.BIRCH_PLANKS] = {all:'planks_birch'};
tex[BLOCK.ACACIA_LOG] = {top:'log_top_acacia', side:'log_side_acacia', bottom:'log_top_acacia'};
tex[BLOCK.ACACIA_PLANKS] = {all:'planks_acacia'};
tex[BLOCK.CHERRY_LOG] = {top:'log_top_cherry', side:'log_side_cherry', bottom:'log_top_cherry'};
tex[BLOCK.CHERRY_PLANKS] = {all:'planks_cherry'};
tex[BLOCK.MANGROVE_LOG] = {top:'log_top_mangrove', side:'log_side_mangrove', bottom:'log_top_mangrove'};
tex[BLOCK.MANGROVE_PLANKS]={all:'planks_mangrove'};
tex[BLOCK.SPRUCE_LOG] = {top:'log_top_spruce', side:'log_side_spruce', bottom:'log_top_spruce'};
tex[BLOCK.SPRUCE_PLANKS] = {all:'planks_spruce'};

tex[BLOCK.BIRCH_LEAVES] = {all:'leaves_birch'};
tex[BLOCK.ACACIA_LEAVES] = {all:'leaves_acacia'};
tex[BLOCK.CHERRY_LEAVES] = {all:'leaves_cherry'};
tex[BLOCK.MANGROVE_LEAVES]= {all:'leaves_mangrove'};
tex[BLOCK.SPRUCE_LEAVES] = {all:'leaves_spruce'};

atlas.blockTex = tex;
}
makeAtlas();

const glTex = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, glTex);
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.generateMipmap(gl.TEXTURE_2D);
gl.uniform1i(loc.u_tex, 0);

Game.atlas = atlas;
Game.atlasTexture = glTex;

function uvFor(name){
const t = atlas.map[name];
const u0 = (t.uatlas.tile + 0.5) / atlas.canvas.width;
const v0 = (t.vatlas.tile + 0.5) / atlas.canvas.height;
const u1 = ((t.u+1)*atlas.tile - 0.5) / atlas.canvas.width;
const v1 = ((t.v+1)*atlas.tile - 0.5) / atlas.canvas.height;
return [u0,v0,u1,v1];
}

// ----------------- Geometria -----------------
class Mesh {
constructor(){ this.vbo = gl.createBuffer(); this.count = 0; }
upload(floatArray){ this.count = floatArray.length/9; gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, floatArray, gl.STATIC_DRAW); }
draw(){
if (!this.count) return;
gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
gl.enableVertexAttribArray(loc.a_pos); gl.vertexAttribPointer(loc.a_pos, 3, gl.FLOAT, false, 36, 0);
gl.enableVertexAttribArray(loc.a_norm); gl.vertexAttribPointer(loc.a_norm,3, gl.FLOAT, false, 36,12);
gl.enableVertexAttribArray(loc.a_uv); gl.vertexAttribPointer(loc.a_uv, 2, gl.FLOAT, false, 36,24);
gl.enableVertexAttribArray(loc.a_emis); gl.vertexAttribPointer(loc.a_emis,1, gl.FLOAT, false, 36,32);
gl.drawArrays(gl.TRIANGLES, 0, this.count);
}
}
function faceVertices(x,y,z, face, uv, emis) {
const [u0,v0,u1,v1] = uv;
const quads = {
0:{n:[-1,0,0],v:[[x,y,z+1],[x,y+1,z+1],[x,y+1,z],[x,y,z]]},
1:{n:[ 1,0,0],v:[[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]]},
2:{n:[0,-1,0],v:[[x,y,z],[x+1,y,z],[x+1,y,z+1],[x,y,z+1]]},
3:{n:[0, 1,0],v:[[x,y+1,z+1],[x+1,y+1,z+1],[x+1,y+1,z],[x,y+1,z]]},
4:{n:[0,0,-1],v:[[x,y,z],[x,y+1,z],[x+1,y+1,z],[x+1,y,z]]},
5:{n:[0,0, 1],v:[[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1],[x,y,z+1]]},
};
const q=quads[face], n=q.n, v=q.v;
const uv0=[u0,v1], uv1=[u1,v1], uv2=[u1,v0], uv3=[u0,v0];
const p=[];
function tri(a,b,c,ua,ub,uc){
p.push(
v[a][0],v[a][1],v[a][2], n[0],n[1],n[2], ua[0],ua[1], emis,
v[b][0],v[b][1],v[b][2], n[0],n[1],n[2], ub[0],ub[1], emis,
v[c][0],v[c][1],v[c][2], n[0],n[1],n[2], uc[0],uc[1], emis
);
}
tri(0,1,2,uv0,uv1,uv2); tri(0,2,3,uv0,uv2,uv3);
return p;
}
function texForBlockFace(id, face) {
const tex = atlas.blockTex[id] || {all:'stone'};
let name;
if (tex.all) name = tex.all;
else {
if (face===2) name = tex.bottom || tex.side || tex.top || 'stone';
else if (face===3) name = tex.top || tex.side || 'stone';
else name = tex.side || tex.top || 'stone';
}
return uvFor(name);
}

// ----------------- Generacja świata -----------------
function clamp(v,a,b){ return v<a?a: v>b?b: v; }
function keyChunk(cx,cz){ return cx+','+cz; }
function inBounds(x,y,z){
return y>=0 && y<WORLD.SIZE_Y &&
x >= -BOUNDS.HALF_X && x < BOUNDS.HALF_X &&
z >= -BOUNDS.HALF_Z && z < BOUNDS.HALF_Z;
}

class Chunk {
constructor(cx, cz) {
this.cx=cx; this.cz=cz;
this.x0=cxWORLD.CHUNK_X; this.z0=czWORLD.CHUNK_Z;
this.blocks = new Uint16Array(WORLD.CHUNK_X * WORLD.CHUNK_Y * WORLD.CHUNK_Z);
this.opaque = new Mesh(); this.transp = new Mesh();
this.dirty = true; this.generated=false;
}
idx(x,y,z){ return x + WORLD.CHUNK_X*(z + WORLD.CHUNK_Z*y); }
get(x,y,z){ return this.blocks[this.idx(x,y,z)]|0; }
set(x,y,z,id){ this.blocks[this.idx(x,y,z)] = id; this.dirty=true; }
generate() {
if (this.generated) return;
const x0=this.x0, z0=this.z0, sea=WORLD.SEA_LEVEL;
for (let lx=0; lx<WORLD.CHUNK_X; lx++){
for (let lz=0; lz<WORLD.CHUNK_Z; lz++){
const gx=x0+lx, gz=z0+lz;
const h = Math.floor(
36 + 22 * (
fbm2(gx, gz, 5, 2, 0.5, 0.005) * 0.65 +
fbm2(gx+1000, gz-2000, 4, 2, 0.5, 0.02) * 0.35 +
0.5
)
);
const height = clamp(h, 8, WORLD.SIZE_Y-2);
const nStoneA = fbm2(gx+500, gz-500, 3, 2, 0.5, 0.03);
const nStoneB = fbm2(gx-800, gz+800, 3, 2, 0.5, 0.025);

for (let y=0;y<WORLD.CHUNK_Y;y++){
let id = BLOCK.AIR;
if (y<=height){
if (y===height) id=BLOCK.GRASS;
else if (y>=height-3) id=BLOCK.DIRT;
else {
const t=(nStoneA+nStoneB)*0.5;
if (t>0.35) id=BLOCK.DIORITE;
else if (t<-0.35) id=BLOCK.ANDESITE;
else id=BLOCK.STONE;
}
} else if (y<=sea && y>height) {
id=BLOCK.WATER;
}
this.set(lx,y,lz,id);
}
}

}
this.generated=true; this.dirty=true;
}
buildMesh(getBlockGlobal){
if (!this.generated) this.generate();
const vertsOpaque=[], vertsTransp=[];
const cx=this.x0, cz=this.z0, SX=WORLD.CHUNK_X, SY=WORLD.CHUNK_Y, SZ=WORLD.CHUNK_Z;
const neighbor=(x,y,z)=> inBounds(x,y,z)? getBlockGlobal(x,y,z): BLOCK.AIR;

for (let x=0;x<SX;x++) for (let y=0;y<SY;y++) for (let z=0;z<SZ;z++){
const id=this.get(x,y,z); if (id===BLOCK.AIR) continue;
const opaque = !isTransparent(id);
const info = BLOCK_INFO[id] || {};
const baseEmis = info.emissive ? info.emissive / 15.0 : 0.0;

const gx=cx+x, gy=y, gz=cz+z;
for (let face=0; face<6; face++){
let nx=gx,ny=gy,nz=gz;
if (face===0) nx=gx-1; if (face===1) nx=gx+1;
if (face===2) ny=gy-1; if (face===3) ny=gy+1;
if (face===4) nz=gz-1; if (face===5) nz=gz+1;
const nid = neighbor(nx,ny,nz);
let show=false;
if (nid===BLOCK.AIR) show=true;
else if (isTransparent(nid)) show = nid !== id;
if (!show) continue;
const uv=texForBlockFace(id, face);
let emis = baseEmis;
if (id===BLOCK.LAVA){
if (face===3) emis = baseEmis * 0.49;
else emis = baseEmis * 0.28;
}
const arr=faceVertices(gx,gy,gz,face,uv,emis);
if (opaque) vertsOpaque.push(...arr); else vertsTransp.push(...arr);
}

}
this.opaque.upload(new Float32Array(vertsOpaque));
this.transp.upload(new Float32Array(vertsTransp));
this.dirty=false;
}
}

// --------- Świat (bez fizyki cieczy – ta jest w fluid_and_physics_water_lava.js) ----------

class World {
    constructor() {
        this.chunks = new Map();
        this.torches = new Set();
        this.drops = [];
        this.lavaSources = new Set(); // obsługiwane w module cieczy
    }

    torchKey(x, y, z) { return x + '|' + y + '|' + z; }
    addTorch(x, y, z) { this.torches.add(this.torchKey(x, y, z)); }
    removeTorch(x, y, z) { this.torches.delete(this.torchKey(x, y, z)); }

    getChunk(cx, cz) {
        return this.chunks.get(keyChunk(cx, cz));
    }

    ensureChunk(cx, cz) {
        if (Math.abs(cx) > BOUNDS.MAX_CX || Math.abs(cz) > BOUNDS.MAX_CZ)
            return null;

        const k = keyChunk(cx, cz);
        let ch = this.chunks.get(k);

        if (!ch) {
            ch = new Chunk(cx, cz);

            // -------------------------
            // BEZPIECZNE GENEROWANIE
            // -------------------------
            const origGenerate = ch.generate.bind(ch);
            ch.generate = function () {
                // Zawsze generujemy surowy chunk
                origGenerate();

                // Zawsze nakładamy biomy (śnieg, lód, pustynia itd.)
                applyBiomesToChunk(this);

                this.generated = true;
            };

            ch.generate();
            // -------------------------

            this.chunks.set(k, ch);

            // Oznacz sąsiednie chunki jako dirty
            for (const [dx, dz] of [[-1,0], [1,0], [0,-1], [0,1]]) {
                const n = this.getChunk(cx + dx, cz + dz);
                if (n) n.dirty = true;
            }
        }

        return ch;
    }

    unloadFar(centerCx, centerCz, radius) {
        for (const [k, ch] of this.chunks) {
            const dx = Math.abs(ch.cx - centerCx);
            const dz = Math.abs(ch.cz - centerCz);
            if (dx > radius + 1 || dz > radius + 1)
                this.chunks.delete(k);
        }
    }

    getBlock(x, y, z) {
        if (!inBounds(x, y, z)) return BLOCK.AIR;
        const cx = Math.floor(x / WORLD.CHUNK_X);
        const cz = Math.floor(z / WORLD.CHUNK_Z);
        const ch = this.getChunk(cx, cz);
        if (!ch) return BLOCK.AIR;

        const lx = x - ch.x0;
        const lz = z - ch.z0;
        return ch.get(lx, y, lz);
    }

    setBlock(x, y, z, id, options) {
        if (!inBounds(x, y, z)) return;

        const cx = Math.floor(x / WORLD.CHUNK_X);
        const cz = Math.floor(z / WORLD.CHUNK_Z);
        const ch = this.getChunk(cx, cz) || this.ensureChunk(cx, cz);
        if (!ch) return;

        const lx = x - ch.x0;
        const lz = z - ch.z0;
        const prev = ch.get(lx, y, lz);
        if (prev === id) return;

        ch.set(lx, y, lz, id);
        ch.dirty = true;

        // sąsiednie chunki
        if (lx === 0) { const n = this.getChunk(cx - 1, cz); if (n) n.dirty = true; }
        if (lx === WORLD.CHUNK_X - 1) { const n = this.getChunk(cx + 1, cz); if (n) n.dirty = true; }
        if (lz === 0) { const n = this.getChunk(cx, cz - 1); if (n) n.dirty = true; }
        if (lz === WORLD.CHUNK_Z - 1) { const n = this.getChunk(cx, cz + 1); if (n) n.dirty = true; }

        if (prev === BLOCK.TORCH) this.removeTorch(x, y, z);
        if (id === BLOCK.TORCH) this.addTorch(x, y, z);

        // Fizyka cieczy → osobny moduł
    }

    dropItem(x, y, z, id, count) {
        this.drops.push({
            x: x + 0.5,
            y: y + 0.5,
            z: z + 0.5,
            id,
            count
        });
    }

    tryPickupDrops(px, py, pz) {
        const radius = 1.8;
        const r2 = radius * radius;

        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            const dx = d.x - px;
            const dy = d.y - (py + 1);
            const dz = d.z - pz;

            if (dx * dx + dy * dy + dz * dz < r2) {
                const rest = addToInventory(inventory, d.id, d.count);
                if (rest <= 0) this.drops.splice(i, 1);
                else d.count = rest;
            }
        }
    }
}

const world = new World();




// ----------------- Gracz / fizyka itd. -----------------
// (tu kod bez zmian – patrz Twój aktualny script.js)

const input = { keys:new Set(), mouseLocked:false, selIndex:0, lastBreakPlace:0, uiOpen:false, lastSpaceTap:0 };
const player = {
pos:[0.5, 70, 0.5],
vel:[0,0,0],
yaw:0, pitch:0,
speed:5.2, sprint:1.7, onGround:false,
eyeHeight:1.6,
aabb:{ hx:0.35, hy:1.0, hz:0.35 },
mode: MODE.SURVIVAL,
health: 20,
fallStartY: null,
fly: false,
flySpeed: 7.0,
inWater:false,
inLava:false
};
const spawnPos = [0.5, 70, 0.5];

function vec3Add(a,b){ return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; }
function vec3Scale(a,s){ return [a[0]*s,a[1]*s,a[2]*s]; }

function isPlayerInBlock(blockId){
const {hx,hy,hz} = player.aabb;
const px = player.pos[0];
const py = player.pos[1];
const pz = player.pos[2];
const minX = Math.floor(px - hx + 0.001);
const maxX = Math.floor(px + hx - 0.001);
const minY = Math.floor(py - hy + 0.001);
const maxY = Math.floor(py + hy - 0.001);
const minZ = Math.floor(pz - hz + 0.001);
const maxZ = Math.floor(pz + hz - 0.001);

for (let y=minY; y<=maxY; y++)
for (let x=minX; x<=maxX; x++)
for (let z=minZ; z<=maxZ; z++)
if (inBounds(x,y,z) && world.getBlock(x,y,z) === blockId)
return true;

return false;
}

function updatePlayerLiquidFlags(){
player.inWater = isPlayerInBlock(BLOCK.WATER);
player.inLava = isPlayerInBlock(BLOCK.LAVA);
}

let lavaDamageTimer = 0;
function handleLiquidDamage(dt){
if (player.inLava){
lavaDamageTimer += dt;
if (lavaDamageTimer > 0.5){
applyDamage(2);
lavaDamageTimer = 0;
}
} else {
lavaDamageTimer = 0;
}
}

// ----------------- Raycast / stawianie -----------------
function raycast(origin, dir, maxDist){
let x=Math.floor(origin[0]), y=Math.floor(origin[1]), z=Math.floor(origin[2]);
const stepX = dir[0]>0?1:-1, stepY = dir[1]>0?1:-1, stepZ = dir[2]>0?1:-1;
const tDeltaX = Math.abs(1/(dir[0]||1e-9));
const tDeltaY = Math.abs(1/(dir[1]||1e-9));
const tDeltaZ = Math.abs(1/(dir[2]||1e-9));
let tMaxX = ((stepX>0? (x+1-origin[0]) : (origin[0]-x)))*tDeltaX;
let tMaxY = ((stepY>0? (y+1-origin[1]) : (origin[1]-y)))*tDeltaY;
let tMaxZ = ((stepZ>0? (z+1-origin[2]) : (origin[2]-z)))*tDeltaZ;
let dist=0, face=-1;
while (dist<=maxDist) {
if (!inBounds(x,y,z)) return null;
const id = world.getBlock(x,y,z);
if (id!==BLOCK.AIR) return {x,y,z, id, face};
if (tMaxX < tMaxY) {
if (tMaxX < tMaxZ) { x += stepX; dist=tMaxX; tMaxX+=tDeltaX; face=stepX>0?0:1; }
else { z += stepZ; dist=tMaxZ; tMaxZ+=tDeltaZ; face=stepZ>0?4:5; }
} else {
if (tMaxY < tMaxZ) { y += stepY; dist=tMaxY; tMaxY+=tDeltaY; face=stepY>0?2:3; }
else { z += stepZ; dist=tMaxZ; tMaxZ+=tDeltaZ; face=stepZ>0?4:5; }
}
}
return null;
}

function offsetForFace(face){
switch(face){
case 0: return [-1, 0, 0];
case 1: return [ 1, 0, 0];
case 2: return [ 0,-1, 0];
case 3: return [ 0, 1, 0];
case 4: return [ 0, 0,-1];
case 5: return [ 0, 0, 1];
default:return [0,0,0];
}
}

function placeBlockAt(target, faceOffset, id){
const nx=target.x+faceOffset[0], ny=target.y+faceOffset[1], nz=target.z+faceOffset[2];
if (!inBounds(nx,ny,nz)) return false;
const existing = world.getBlock(nx,ny,nz);
if (existing !== BLOCK.AIR && existing !== BLOCK.WATER && existing !== BLOCK.LAVA) return false;
if (existing === id) return false;

const [px,py,pz]=player.pos;
if (aabbVsBlock(px,py,pz, player.aabb.hx,player.aabb.hy,player.aabb.hz, nx,ny,nz)) return false;

world.setBlock(nx,ny,nz,id);
return true;
}

// ----------------- Konwersja Y dla Nethera -----------------
function internalToVisibleY(intY){
if (Game.currentDimension === 1 && typeof Game.NETHER_Y_OFFSET === 'number') {
return intY + Game.NETHER_Y_OFFSET;
}
return intY;
}

function visibleToInternalY(visY){
if (Game.currentDimension === 1 && typeof Game.NETHER_Y_OFFSET === 'number') {
return visY - Game.NETHER_Y_OFFSET;
}
return visY;
}

// ----------------- Teleportacja -----------------
function teleportPlayer(x,y,z){
// globalne X/Z (bez zmian)
x = clamp(Math.floor(x), -BOUNDS.HALF_X, BOUNDS.HALF_X-1);
z = clamp(Math.floor(z), -BOUNDS.HALF_Z, BOUNDS.HALF_Z-1);
// Y pochodzi ze "świata logicznego" (np. -500 w Netherze) -> zamiana na wewnętrzne
let yInt = visibleToInternalY(y);
yInt = clamp(Math.floor(yInt), 1, WORLD.SIZE_Y-2);

let px = x + 0.5, py = yInt + 0.01, pz = z + 0.5;
if (!isSpaceFree(px,py,pz)){
for (let dy=0; dy<64; dy++){
if (isSpaceFree(px, py+dy, pz)){ py = py+dy; break; }
}
}
player.pos = [px,py,pz];
player.vel = [0,0,0];
player.onGround = false;
}

// ----------------- Render -----------------
let proj = mat4Perspective(70Math.PI/180, 16/9, 0.1, 800.0);
function updateProj(){ proj = mat4Perspective(70Math.PI/180, glCanvas.width/glCanvas.height, 0.1, 800.0); }
const LIGHT_RADIUS = 14.0;

function dayParams() {
const t = (DAY.t % DAY.LENGTH_SEC) / DAY.LENGTH_SEC;
const ang = t * Math.PI * 2;
const sunAlt = Math.sin(ang);
const sunDir = [0.2, sunAlt, Math.cos(ang)];
const dayFactor = clamp((sunAlt0.5 + 0.5), 0, 1);
const sunIntensity = Math.pow(dayFactor, 1.5) * 1.1;
const ambient = 0.06 + dayFactor * 0.20;
const skyDay=[0.55,0.75,0.95], skyNight=[0.02,0.03,0.07];
const k=Math.pow(dayFactor,0.7);
const sky=[ skyNight0+skyDay[0]k,
skyNight1+skyDay[1]k,
skyNight2+skyDay[2]*k ];
return {sunDir, sunIntensity, ambient, sky, dayFactor};
}

let origin = [0,0,0];

function gatherTorchLights(origin, lavaFactor) {
const px=player.pos[0], py=player.pos[1]+player.eyeHeight, pz=player.pos[2];
const list=[];
const lavaScale = lavaFactor ?? 1.0;
for (const k of world.torches) {
const [x,y,z] = k.split('|').map(n=>+n);
const dx = x+0.5 - px, dy = y+0.7 - py, dz = z+0.5 - pz;
const d2 = dxdx + dydy + dzdz;
if (d2 < 6060) {
list.push({
x:x+0.5, y:y+0.7, z:z+0.5,
d2,
int:1.0,
col:[1.0,0.95,0.75]
});
}
}

const lavaMaxDist2 = 5050;
for (const k of world.lavaSources) {
const [x,y,z] = k.split('|').map(n=>+n);
const dx = x+0.5 - px, dy = y+0.5 - py, dz = z+0.5 - pz;
const d2 = dxdx + dydy + dzdz;
if (d2 < lavaMaxDist2 && lavaScale > 0.0) {
list.push({
x:x+0.5, y:y+0.5, z:z+0.5,
d2,
int:0.32 * lavaScale,
col:[1.0,0.55,0.15]
});
}
}

const sel=inventory.slots[input.selIndex];
if (sel && sel.id===BLOCK.TORCH){
list.push({x:px, y:py, z:pz, d2:0, int:1.0, col:[1.0,0.95,0.75]});
}
if (sel && sel.id===BLOCK.LAVA && lavaScale > 0.0){
list.push({x:px, y:py, z:pz, d2:0, int:0.32 * lavaScale, col:[1.0,0.55,0.15]});
}

list.sort((a,b)=>a.d2-b.d2);
const use = list.slice(0, MAX_LIGHTS);

const pos = new Float32Array(MAX_LIGHTS3);
const intens = new Float32Array(MAX_LIGHTS);
const cols = new Float32Array(MAX_LIGHTS3);
for (let i=0;i<use.length;i++){
pos[i3+0]=use[i].x - origin[0];
pos[i3+1]=use[i].y - origin[1];
pos[i3+2]=use[i].z - origin[2];
intens[i]=use[i].int ?? 1.0;
const c = use[i].col || [1,1,1];
cols[i3+0]=c[0];
cols[i3+1]=c[1];
cols[i3+2]=c[2];
}
return {count:use.length, pos, intens, cols};
}

let currentHit = null;

function drawWorld(view) {
const pcx = Math.floor(player.pos[0] / WORLD.CHUNK_X);
const pcz = Math.floor(player.pos[2] / WORLD.CHUNK_Z);
for (let dz=-WORLD.VIEW_RADIUS_CHUNKS; dz<=WORLD.VIEW_RADIUS_CHUNKS; dz++)
for (let dx=-WORLD.VIEW_RADIUS_CHUNKS; dx<=WORLD.VIEW_RADIUS_CHUNKS; dx++)
world.ensureChunk(pcx+dx, pcz+dz);
world.unloadFar(pcx, pcz, WORLD.VIEW_RADIUS_CHUNKS);
const chunks=[];
for (const ch of world.chunks.values()){
if (ch.dirty) ch.buildMesh((x,y,z)=>world.getBlock(x,y,z));
chunks.push(ch);
}
chunks.sort((a,b)=>{
const ax = a.x0 + WORLD.CHUNK_X0.5 - player.pos[0];
const az = a.z0 + WORLD.CHUNK_Z0.5 - player.pos[2];
const bx = b.x0 + WORLD.CHUNK_X0.5 - player.pos[0];
const bz = b.z0 + WORLD.CHUNK_Z0.5 - player.pos[2];
return (bxbx + bzbz) - (axax + azaz);
});

const {sunDir, sunIntensity, ambient, sky, dayFactor} = dayParams();

const lavaLightFactor = Math.max(0, 1 - dayFactor*2.0);

gl.enable(gl.DEPTH_TEST);
gl.depthMask(true);
gl.disable(gl.BLEND);
gl.clearColor(sky[0], sky[1], sky[2], 1);
gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

gl.useProgram(program);
gl.uniformMatrix4fv(loc.u_proj,false,proj);
gl.uniformMatrix4fv(loc.u_view,false,view);
gl.uniform3f(loc.u_sunDir, sunDir[0], sunDir[1], sunDir[2]);
gl.uniform1f(loc.u_sunIntensity, sunIntensity);
gl.uniform1f(loc.u_ambient, ambient);
gl.uniform1f(loc.u_lightRadius, LIGHT_RADIUS);
gl.uniform3f(loc.u_origin, origin[0], origin[1], origin[2]);

const lights = gatherTorchLights(origin, lavaLightFactor);
gl.uniform1i(loc.u_lightCount, lights.count);
gl.uniform3fv(loc.u_lightsPos0, lights.pos);
gl.uniform1fv(loc.u_lightsInt0, lights.intens);
gl.uniform3fv(loc.u_lightsCol0, lights.cols);

for (const ch of chunks) ch.opaque.draw();
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
for (const ch of chunks) ch.transp.draw();
}

// ----------------- HUD -----------------
const hud = hudCanvas.getContext('2d');

function drawHeart(ctx, x, y, size, fill, stroke) {
const w=size, h=size;
ctx.save();
ctx.translate(x, y);
ctx.fillStyle = fill;
ctx.strokeStyle = stroke || 'rgba(0,0,0,0.4)';
ctx.lineWidth = Math.max(1, size0.08);
ctx.beginPath();
ctx.moveTo(0, h0.35);
ctx.bezierCurveTo(0, 0, w0.5, 0, w0.5, h0.28);
ctx.bezierCurveTo(w0.5, 0, w, 0, w, h0.35);
ctx.bezierCurveTo(w, h0.7, w0.6, h0.8, w0.5, h);
ctx.bezierCurveTo(w0.4, h0.8, 0, h0.7, 0, h*0.35);
ctx.closePath();
ctx.fill(); ctx.stroke();
ctx.restore();
}

function projectToScreen(mvp, x,y,z){
const v = transformVec4(mvp, [x,y,z,1]);
if (v[3] === 0) return null;
const ndcX = v[0]/v[3], ndcY = v[1]/v[3];
const sx = (ndcX*0.5+0.5)hudCanvas.width;
const sy = (1-(ndcY0.5+0.5))*hudCanvas.height;
return {x:sx, y:sy};
}

function drawBlockOutline(hit, mvp){
if (!hit) return;
const x = hit.x - origin[0];
const y = hit.y - origin[1];
const z = hit.z - origin[2];
const corners = [
[x, y+1, z ],
[x+1, y+1, z ],
[x+1, y+1, z+1 ],
[x, y+1, z+1 ],
];
const pts = corners.map(c=>projectToScreen(mvp, c[0],c[1],c[2]));
if (pts.some(p=>!p)) return;

hud.strokeStyle='rgba(255,255,0,0.9)';
hud.lineWidth=Math.max(1, Math.floor(hudCanvas.width/1200));
hud.beginPath();
for (let i=0;i<4;i++){
const a=pts[i], b=pts[(i+1)%4];
hud.moveTo(a.x, a.y);
hud.lineTo(b.x, b.y);
}
hud.stroke();
}

function drawPeerLabels(mvp){
if (!MULTI.enabled) return;
const forward=[Math.sin(player.yaw)Math.cos(player.pitch), Math.sin(player.pitch), Math.cos(player.yaw)Math.cos(player.pitch)];
hud.textAlign='center'; hud.font='13px system-ui, sans-serif';
for (const p of MULTI.peers.values()){
const dx = p.pos[0]-player.pos[0];
const dy = p.pos[1]+1.7 - (player.pos[1]+player.eyeHeight);
const dz = p.pos[2]-player.pos[2];
const dist = Math.hypot(dx, dy, dz);
if (dist>160) continue;
const dot = dxforward[0] + dyforward[1] + dzforward[2];
if (dot <= 0) continue;
const scr = projectToScreen(mvp, p.pos[0]-origin[0], p.pos[1]-origin[1]+1.9, p.pos[2]-origin[2]);
if (!scr) continue;
const txt = p.name(p.name({Math.max(1, Math.floor(dist))}m);
const tw = hud.measureText(txt).width;
const pad=4;
hud.fillStyle='rgba(0,0,0,0.5)';
hud.fillRect(scr.x - tw/2 - pad, scr.y - 16, tw+pad2, 18);
hud.fillStyle='#fff';
hud.fillText(txt, scr.x, scr.y - 3);
}
}

function drawHUD(dt, fps, mvp) {
hud.clearRect(0,0,hudCanvas.width, hudCanvas.height);
const W=hudCanvas.width, H=hudCanvas.height;
drawBlockOutline(currentHit, mvp);

hud.strokeStyle='rgba(255,255,255,0.8)';
hud.lineWidth=Math.max(1, Math.floor(W/800));
const cx=W/2, cy=H/2, sz=Math.max(6, Math.floor(W/160));
hud.beginPath();
hud.moveTo(cx-sz,cy); hud.lineTo(cx+sz,cy);
hud.moveTo(cx,cy-sz); hud.lineTo(cx,cy+sz);
hud.stroke();

const tile=Math.max(28, Math.floor(W/32)), pad=Math.floor(tile0.25);
const totalW=HOTBAR_SIZEtile + (HOTBAR_SIZE-1)*pad;
const x0=(W-totalW)/2, y0=H - tile - 22;
hud.globalAlpha=0.7;
hud.fillStyle='rgba(0,0,0,0.35)';
hud.fillRect(x0-10,y0-10,totalW+20,tile+20);
hud.globalAlpha=1;

for (let i=0;i<HOTBAR_SIZE;i++){
const x = x0 + i*(tile+pad);
hud.fillStyle = i===input.selIndex ? '#ffffff' : '#222222';
hud.globalAlpha = i===input.selIndex ? 0.9 : 0.7;
hud.fillRect(x,y0,tile,tile);
hud.globalAlpha=1;
hud.strokeStyle = i===input.selIndex ? '#00e676' : 'rgba(255,255,255,0.35)';
hud.lineWidth = i===input.selIndex ? 3 : 1;
hud.strokeRect(x+0.5,y0+0.5,tile-1,tile-1);

const s = inventory.slots[i];
const id = s ? s.id : 0;
let name='stone'; const tex=atlas.blockTex[id] || {};
if (tex.top) name=tex.top; else if (tex.all) name=tex.all; else if (tex.side) name=tex.side;
const t = atlas.map[name];
if (t) {
const sx=t.uatlas.tile, sy=t.vatlas.tile, ssz=atlas.tile;
hud.imageSmoothingEnabled=false;
hud.drawImage(atlas.canvas, sx,sy,ssz,ssz, x+2, y0+2, tile-4, tile-4);
}
if (player.mode===MODE.SURVIVAL && s && s.count>1){
hud.fillStyle='rgba(0,0,0,0.6)';
hud.fillRect(x+tile-18,y0+tile-14,16,12);
hud.fillStyle='#fff';
hud.font='11px monospace';
hud.textAlign='right';
hud.fillText(String(s.count), x+tile-3, y0+tile-4);
}
}

const heartsY = y0 - tile - 16;
if (player.mode === MODE.SURVIVAL) {
const hearts = 10, hp = player.health, full = Math.floor(hp/2), half = hp%2;
const size = Math.max(12, Math.floor(W/90)), gap = Math.max(4, Math.floor(size0.25));
const total = heartssize + (hearts-1)*gap;
let hx = (W-total)/2;
for (let i=0;i<hearts;i++){
let fill='rgba(255,0,0,0.15)';
if (i<full) fill='rgba(220,30,30,0.95)';
else if (i===full && half) fill='rgba(220,30,30,0.6)';
drawHeart(hud, hx, heartsY, size, fill);
hx += size+gap;
}
} else {
hud.font='14px system-ui, sans-serif';
hud.fillStyle='rgba(255,255,255,0.8)';
hud.textAlign='center';
hud.fillText('Tryb: Kreatywny (B/F5 przełącz)', W/2, heartsY + 14);
}

drawPeerLabels(mvp);

hud.textAlign='left';
hud.font='12px monospace';
hud.fillStyle='#fff';

const dispY = internalToVisibleY(player.pos[1]);
const posStr = [
player.pos[0].toFixed(1),
dispY.toFixed(1),
player.pos[2].toFixed(1)
].join(', ');

hud.fillText(
FPS: ${fps.toFixed(0)} Pos: ${posStr} +
OnGround:${player.onGround?'Y':'N'} +
Tryb:${player.mode} Fly:${player.fly?'Y':'N'} +
Woda:${player.inWater?'Y':'N'} Lawa:${player.inLava?'Y':'N'},
10, 20
);
}

// ----------------- Czat i komendy -----------------
const chat = { open:false, messages:[] };
function pushChat(text, type='system'){
chat.messages.push({text, type, time: performance.now()});
if (chat.messages.length > 100) chat.messages.shift();
renderChatLog();
}
function renderChatLog(){
const now = performance.now();
const lines = chat.messages.slice(-12).map(m=>{
const age = (now - m.time)/1000;
const a = Math.max(0, 1 - (age-8)/4);
const cls = m.type==='system'?'chatMsg chatSystem':'chatMsg chatPlayer';
return <div class="${cls}" style="opacity:${Math.min(0.95, Math.max(0.2,a)).toFixed(2)}">{m.text}</div>; }); chatLogEl.innerHTML = lines.join(''); } function openChat(){ if (chat.open) return; chat.open = true; input.uiOpen = true; chatWrapEl.style.display='block'; chatInput.value=''; chatInput.focus(); document.exitPointerLock?.(); } function closeChat(tryRelock=false){ chat.open = false; input.uiOpen = false; chatWrapEl.style.display='none'; if (tryRelock) { try { glCanvas.requestPointerLock(); } catch {} } } function parseNums(arr){ return arr.map(s=>{ const t = s.replace(/[,;]+/,'');
const n = parseFloat(t);
return isNaN(n)?null:n;
});
}
function isSpaceFree(px,py,pz){
const {hx,hy,hz}=player.aabb;
const minX = Math.floor(px-hx), maxX = Math.floor(px+hx);
const minY = Math.floor(py-hy), maxY = Math.floor(py+hy);
const minZ = Math.floor(pz-hz), maxZ = Math.floor(pz+hz);
for (let y=minY;y<=maxY;y++)
for (let x=minX;x<=maxX;x++)
for (let z=minZ;z<=maxZ;z++)
if (inBounds(x,y,z) && isSolid(world.getBlock(x,y,z))) return false;
return true;
}

function handleCommand(raw){
const line = raw.trim();
if (!line.startsWith('/')) {
if (MULTI.enabled) {
pushChat(${MULTI.nick}: ${line}, 'player');
try { MULTI.chan?.postMessage({type:'chat', id:MULTI.id, name:MULTI.nick, text: line}); } catch {}
} else {
pushChat(Gracz: ${line}, 'player');
}
return;
}
const parts = line.slice(1).trim().split(/\s+/);
if (parts.length===0) return;
const cmd = parts[0].toLowerCase();

if (cmd === 'tp'){
let idx=1;
if (parts[1] && parts[1].toLowerCase()==='@p') idx=2;
const [x,y,z] = parseNums(parts.slice(idx, idx+3));
if ([x,y,z].some(v=>v==null)) {
pushChat('Użycie: /tp @p X Y Z', 'system'); return;
}
teleportPlayer(x,y,z);
pushChat(Teleportowano @p do (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}), 'system');
return;
}

if (cmd === 'time'){
if ((parts[1]||'').toLowerCase()==='set'){
const mode = (parts[2]||'').toLowerCase();
if (mode==='day'){
DAY.t = 0.25 * DAY.LENGTH_SEC;
pushChat('Ustawiono porę: dzień', 'system'); return;
} else if (mode==='night'){
DAY.t = 0.75 * DAY.LENGTH_SEC;
pushChat('Ustawiono porę: noc', 'system'); return;
}
}
pushChat('Użycie: /time set day | /time set night', 'system'); return;
}

if (cmd === 'gamerule'){
const rule = (parts[1]||'').toLowerCase();
const valueStr = (parts[2]||'').toLowerCase();

if (rule === 'dodaycycle') {
if (valueStr === 'true' || valueStr === 'false') {
const val = (valueStr === 'true');
DAY.doDayCycle = val;
pushChat(Gamerule DoDayCycle ustawione na ${val ? 'true (cykl dnia i nocy działa)' : 'false (cykl dnia i nocy zatrzymany)'}, 'system');
} else {
pushChat('Użycie: /gamerule dodaycycle true|false', 'system');
}
return;
} else {
pushChat('Obsługiwane gamerule: dodaycycle', 'system');
return;
}
}

pushChat(Nieznana komenda: ${cmd}, 'system');
}

// ----------------- Input / UI -----------------
function lockPointer(){ glCanvas.requestPointerLock(); }
function unlockPointer(){ document.exitPointerLock?.(); }
glCanvas.addEventListener('contextmenu', e=>e.preventDefault());

document.addEventListener('pointerlockchange', ()=>{
input.mouseLocked = (document.pointerLockElement === glCanvas);
overlay.style.display = input.mouseLocked ? 'none' : overlay.style.display;
});
document.addEventListener('pointerlockerror', ()=> {
alert('Nie udało się zablokować kursora. Uruchom przez lokalny serwer (np. python -m http.server).');
});

function startSingle(){ glCanvas.focus(); lockPointer(); overlay.style.display='none'; MULTI.enabled=false; }
function startMultiplayer(nick){
if (!nick || nick.trim().length<1) { alert('Podaj nick'); return; }
MULTI.enabled=true;
MULTI.nick=nick.trim().slice(0,16);
MULTI.id='p'+Math.random().toString(36).slice(2,10);
MULTI.room='public';
MULTI.chan = new BroadcastChannel('voxel3d_room_'+MULTI.room);
MULTI.chan.onmessage = onMultiMsg;
try { MULTI.chan.postMessage({type:'hello', id:MULTI.id, name:MULTI.nick}); } catch {}
pushChat([MP] Dołączono jako ${MULTI.nick}., 'system');
glCanvas.focus(); lockPointer(); overlay.style.display='none';
}
function onMultiMsg(ev){
const m=ev.data||{};
if (!m || !m.type) return;
if (m.id===MULTI.id) return;
if (!MULTI.enabled) return;
switch(m.type){
case 'hello':
addOrUpdatePeer({id:m.id, name:m.name});
sendState();
pushChat([MP] ${m.name||'Gracz'} dołączył, 'system');
break;
case 'state':
addOrUpdatePeer({id:m.id, name:m.name, pos:m.pos, yaw:m.yaw, pitch:m.pitch});
break;
case 'bye':
MULTI.peers.delete(m.id);
pushChat([MP] m.name∣∣′Gracz′wyszedł,′system′);break;case′chat′:pushChat(m.name∣∣′Gracz′wyszedł,′system′);break;case′chat′:pushChat({m.name||'Gracz'}: ${m.text}, 'player');
break;
}
}
function addOrUpdatePeer(data){
let p = MULTI.peers.get(data.id);
if (!p){
p = {id:data.id, name:data.name||'Gracz', pos:data.pos||[0,0,0], yaw:data.yaw||0, pitch:data.pitch||0, t: performance.now()};
MULTI.peers.set(data.id, p);
}
if (data.name) p.name = data.name;
if (data.pos) p.pos = data.pos;
if (typeof data.yaw==='number') p.yaw = data.yaw;
if (typeof data.pitch==='number') p.pitch = data.pitch;
p.t = performance.now();
}
function sendState(){
if (!MULTI.enabled || !MULTI.chan) return;
try {
MULTI.chan.postMessage({
type:'state',
id:MULTI.id,
name:MULTI.nick,
pos:[player.pos[0], player.pos[1], player.pos[2]],
yaw:player.yaw,
pitch:player.pitch
});
} catch {}
}
function sendBye(){
if (!MULTI.enabled || !MULTI.chan) return;
try { MULTI.chan.postMessage({type:'bye', id:MULTI.id, name:MULTI.nick}); } catch {}
}

glCanvas.addEventListener('contextmenu', e=>e.preventDefault());
window.addEventListener('beforeunload', ()=>{ sendBye(); });

const debugEl = document.getElementById('debug');

// przyciski SP/MP wywołują Game.startGame()
spBtn.addEventListener('click', () => {
if (typeof Game.startGame === 'function') {
Game.startGame();
}
startSingle();
});
mpBtn.addEventListener('click', ()=>{
mpForm.style.display='flex';
mpHint.style.display='block';
nickInput.focus();
});
joinBtn.addEventListener('click', ()=>{
if (typeof Game.startGame === 'function') {
Game.startGame();
}
startMultiplayer(nickInput.value);
});
nickInput.addEventListener('keydown', (e)=>{
if(e.key==='Enter'){
if (typeof Game.startGame === 'function') {
Game.startGame();
}
startMultiplayer(nickInput.value);
}
});

window.addEventListener('keydown', (e)=>{
if (chat.open || document.activeElement === chatInput) return;
if (e.code === 'KeyT') {
e.preventDefault();
openChat();
return;
}

if (e.code === 'KeyE') {
e.preventDefault();
if (input.uiOpen) return;
openInventory();
return;
}

if (e.code === 'KeyB' || e.code === 'F5') {
const newMode = (player.mode === MODE.SURVIVAL) ? MODE.CREATIVE : MODE.SURVIVAL;
player.mode = newMode;
if (player.mode === MODE.CREATIVE) {
player.health = 20;
} else {
player.fly = false;
}
pushChat(Tryb: ${player.mode==='survival'?'Przetrwanie':'Kreatywny'}, 'system');
return;
}

if (e.code === 'Space' && !e.repeat) {
const now = performance.now();
if (player.mode === MODE.CREATIVE) {
if (now - input.lastSpaceTap < 280) {
player.fly = !player.fly;
if (player.fly) {
player.vel[1] = 0;
player.onGround = false;
player.fallStartY = null;
}
input.lastSpaceTap = 0;
} else {
input.lastSpaceTap = now;
}
}
}

input.keys.add(e.code);
const num = Number(e.key);
if (!input.uiOpen && num>=1 && num<=HOTBAR_SIZE) input.selIndex = num-1;
});
window.addEventListener('keyup', (e)=> input.keys.delete(e.code));

window.addEventListener('wheel', (e)=>{
if (!input.mouseLocked || input.uiOpen) return;
e.preventDefault();
const dir = Math.sign(e.deltaY);
input.selIndex = (input.selIndex + dir + HOTBAR_SIZE) % HOTBAR_SIZE;
}, {passive:false});

let sensitivity=0.0028;
window.addEventListener('mousemove', (e)=>{
if (!input.mouseLocked || input.uiOpen) return;
player.yaw -= e.movementX * sensitivity;
player.pitch -= e.movementY * sensitivity;
const lim=Math.PI/2 - 0.01;
player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});

function consumeSelected(idx, amount){
const s = inventory.slots[idx];
if (!s) return;
s.count -= amount;
if (s.count <= 0) inventory.slots[idx] = null;
}

window.addEventListener('mousedown', (e)=>{
if (!input.mouseLocked || input.uiOpen) return;
const now=performance.now();
if (now - input.lastBreakPlace < 60) return;
input.lastBreakPlace=now;
const eye=[player.pos[0], player.pos[1]+player.eyeHeight, player.pos[2]];
const dir=[
Math.sin(player.yaw)*Math.cos(player.pitch),
Math.sin(player.pitch),
Math.cos(player.yaw)*Math.cos(player.pitch)
];
const hit = raycast(eye, dir, WORLD.REACH);

if (e.button===0) {
if (hit && hit.id!==BLOCK.AIR) {
world.setBlock(hit.x,hit.y,hit.z,BLOCK.AIR);
if (player.mode===MODE.SURVIVAL && isCollectible(hit.id)) {
const rest = addToInventory(inventory, hit.id, 1);
if (rest>0) world.dropItem(hit.x,hit.y,hit.z, hit.id, rest);
}
}
} else if (e.button===2 && hit) {
const off = offsetForFace(hit.face);
let id = 0;

if (player.mode===MODE.CREATIVE){
const s=inventory.slots[input.selIndex];
id = s ? s.id : BLOCK.STONE;
placeBlockAt(hit, off, id);
} else {
const s = inventory.slots[input.selIndex];
if (s && s.count>0) {
id = s.id;
const ok = placeBlockAt(hit, off, id);
if (ok) consumeSelected(input.selIndex, 1);
}
}
}
});

chatInput.addEventListener('keydown', (e)=>{
if (e.key === 'Enter') {
const text = chatInput.value.trim();
if (text) handleCommand(text);
closeChat(true);
} else if (e.key === 'Escape') {
closeChat(true);
}
});

// ----------------- Inventory UI -----------------
const CREATIVE_ITEMS = [
BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.DIORITE, BLOCK.ANDESITE,
BLOCK.SAND, BLOCK.GRAVEL, BLOCK.OBSIDIAN, BLOCK.WATER, BLOCK.LAVA,
BLOCK.TORCH,
BLOCK.BIRCH_LOG, BLOCK.BIRCH_PLANKS, BLOCK.BIRCH_LEAVES,
BLOCK.ACACIA_LOG, BLOCK.ACACIA_PLANKS, BLOCK.ACACIA_LEAVES,
BLOCK.CHERRY_LOG, BLOCK.CHERRY_PLANKS, BLOCK.CHERRY_LEAVES,
BLOCK.MANGROVE_LOG, BLOCK.MANGROVE_PLANKS, BLOCK.MANGROVE_LEAVES,
BLOCK.SPRUCE_LOG, BLOCK.SPRUCE_PLANKS, BLOCK.SPRUCE_LEAVES
];

Game.CREATIVE_ITEMS = CREATIVE_ITEMS;

function iconTileNameForBlock(id){
const tex=atlas.blockTex[id]||{};
if (tex.top) return tex.top;
if (tex.all) return tex.all;
if (tex.side) return tex.side;
return 'stone';
}
function renderCreativeGrid(){
invGrid.innerHTML='';
invGrid.style.display='grid';
invWrap.style.display='none';
invGrid.style.gridTemplateColumns='repeat(auto-fill, minmax(104px,1fr))';
for (const id of CREATIVE_ITEMS){
const div=document.createElement('div'); div.className='invItem';
const cv=document.createElement('canvas'); cv.width=96; cv.height=96; const c=cv.getContext('2d');
const name=iconTileNameForBlock(id); const t=atlas.map[name];
if (t){
const sx=t.uatlas.tile, sy=t.vatlas.tile;
c.imageSmoothingEnabled=false;
c.drawImage(atlas.canvas, sx,sy,atlas.tile,atlas.tile, 0,0, cv.width,cv.height);
}
const label=document.createElement('div'); label.className='invLabel'; label.textContent=BLOCK_INFO[id]?.name || 'Blok';
div.appendChild(cv); div.appendChild(label);
div.addEventListener('click', ()=>{ inventory.slots[input.selIndex] = makeStack(id, 64); });
invGrid.appendChild(div);
}
}
function drawSlotCanvas(canvas, id){
const c=canvas.getContext('2d');
c.clearRect(0,0,canvas.width,canvas.height);
const tname=iconTileNameForBlock(id); const t=atlas.map[tname];
if (t){
const sx=t.uatlas.tile, sy=t.vatlas.tile;
c.imageSmoothingEnabled=false;
c.drawImage(atlas.canvas, sx,sy,atlas.tile,atlas.tile, 0,0, canvas.width,canvas.height);
}
}
function renderSurvivalGrid(){
invGrid.style.display='none';
invWrap.style.display='block';
hotbarRow.innerHTML='';
bagGrid.innerHTML='';
for (let i=0;i<9;i++){
const slot=document.createElement('div'); slot.className='slot';
const cv=document.createElement('canvas'); cv.width=64; cv.height=64; slot.appendChild(cv);
const s=inventory.slots[i];
drawSlotCanvas(cv, s?s.id:0);
if (s && s.count>1){
const cc=document.createElement('div'); cc.className='slotCount'; cc.textContent=s.count;
slot.appendChild(cc);
}
slot.addEventListener('click', ()=> onSlotClick(i));
hotbarRow.appendChild(slot);
}
for (let i=9;i<36;i++){
const slot=document.createElement('div'); slot.className='slot';
const cv=document.createElement('canvas'); cv.width=64; cv.height=64; slot.appendChild(cv);
const s=inventory.slots[i];
drawSlotCanvas(cv, s?s.id:0);
if (s && s.count>1){
const cc=document.createElement('div'); cc.className='slotCount'; cc.textContent=s.count;
slot.appendChild(cc);
}
slot.addEventListener('click', ()=> onSlotClick(i));
bagGrid.appendChild(slot);
}
}
function updateCursorView(){
if (!inventory.cursor){
cursorEl.style.display='none';
return;
}
cursorEl.style.display='flex';
cursorCnt.textContent = inventory.cursor.count>1 ? inventory.cursor.count : '';
cursorCtx.clearRect(0,0,cursorCv.width,cursorCv.height);
const name=iconTileNameForBlock(inventory.cursor.id); const t=atlas.map[name];
if (t){
const sx=t.uatlas.tile, sy=t.vatlas.tile;
cursorCtx.imageSmoothingEnabled=false;
cursorCtx.drawImage(atlas.canvas, sx,sy,atlas.tile,atlas.tile, 0,0, cursorCv.width, cursorCv.height);
}
}
invEl.addEventListener('mousemove', (e)=>{
cursorEl.style.left = e.clientX + 'px';
cursorEl.style.top = e.clientY + 'px';
});
function onSlotClick(idx){
if (player.mode !== MODE.SURVIVAL) return;
const slot = inventory.slots[idx];
const cur = inventory.cursor;
if (!cur && slot){
inventory.cursor = slot;
inventory.slots[idx]=null;
} else if (cur && !slot){
inventory.slots[idx]=cur;
inventory.cursor=null;
} else if (cur && slot){
if (cur.id === slot.id){
const space = 64 - slot.count;
const move = Math.min(space, cur.count);
slot.count += move;
cur.count -= move;
if (cur.count<=0) inventory.cursor=null;
} else {
const tmp=inventory.slots[idx];
inventory.slots[idx]=inventory.cursor;
inventory.cursor=tmp;
}
}
renderSurvivalGrid();
updateCursorView();
}
function openInventory() {
input.uiOpen = true;
invEl.style.display='flex';
unlockPointer();
if (player.mode===MODE.CREATIVE){
invTitle.textContent='Ekwipunek (Kreatywny)';
invHelp.textContent='Kliknij blok, by wstawić go do aktualnego slotu hotbara (1–9).';
renderCreativeGrid();
} else {
invTitle.textContent='Ekwipunek (Przetrwanie)';
invHelp.textContent='Klikaj sloty, aby przenosić i łączyć stacki (max 64). Górny rząd to hotbar.';
renderSurvivalGrid();
updateCursorView();
}
}
function closeInventory(tryRelock=false) {
invEl.style.display = 'none';
input.uiOpen = false;
inventory.cursor=null;
updateCursorView();
if (tryRelock) { try { lockPointer(); } catch {} }
}
invClose.addEventListener('click', () => closeInventory(true));

// ----------------- Spawn -----------------
function getSurfaceY(x,z){
for (let y=WORLD.SIZE_Y-1; y>=0; y--){
const id = world.getBlock(x,y,z);
if (isSolid(id)) return y;
}
return WORLD.SEA_LEVEL;
}

// ----------------- Pętla gry + start gry -----------------
let lastTime = performance.now();
let fps=0, acc=0, frames=0;

function loop(){
const now=performance.now();
const dt=Math.min(0.05, (now-lastTime)/1000);
lastTime=now;
if (DAY.doDayCycle) DAY.t += dt;
updatePlayerLiquidFlags();
updateInput(dt);
collideAndSlide(dt);
updatePlayerLiquidFlags();
handleLiquidDamage(dt);

origin = [Math.floor(player.pos[0]), Math.floor(player.pos[1]), Math.floor(player.pos[2])];

const eyeRel=[player.pos[0]-origin[0], player.pos[1]-origin[1]+player.eyeHeight, player.pos[2]-origin[2]];
const lookDir=[ Math.sin(player.yaw)*Math.cos(player.pitch), Math.sin(player.pitch), Math.cos(player.yaw)*Math.cos(player.pitch) ];
const centerRel=[eyeRel[0]+lookDir[0], eyeRel[1]+lookDir[1], eyeRel[2]+lookDir[2]];

resize();
updateProj();
const view = mat4LookAt(eyeRel, centerRel, [0,1,0]);
const mvp = matMul(proj, view);

const eyeAbs=[player.pos[0], player.pos[1]+player.eyeHeight, player.pos[2]];
currentHit = raycast(eyeAbs, lookDir, WORLD.REACH);

drawWorld(view);

acc+=dt; frames++;
if (acc>=0.25){
fps = frames/acc;
acc=0; frames=0;
}
drawHUD(dt, fps, mvp);
renderChatLog();

if (MULTI.enabled){
if (now - MULTI.lastState > 120) { sendState(); MULTI.lastState = now; }
for (const [id, p] of MULTI.peers){
if ((now - p.t) > 5000) MULTI.peers.delete(id);
}
}

debugEl.textContent = '';

requestAnimationFrame(loop);
}

let gameStarted = false;

function internalStartGame() {
if (gameStarted) return;
gameStarted = true;
resize();

const sx = (Game.spawnOverride && typeof Game.spawnOverride.x === 'number')
? Game.spawnOverride.x
: 0;
const sz = (Game.spawnOverride && typeof Game.spawnOverride.z === 'number')
? Game.spawnOverride.z
: 0;

const sy = getSurfaceY(sx, sz);

player.pos = [sx+0.5, sy + player.aabb.hy + 0.05, sz+0.5];
spawnPos[0]=player.pos[0]; spawnPos[1]=player.pos[1]; spawnPos[2]=player.pos[2];

Game.spawn = { x:sx, y:sy, z:sz };
WORLD.SPAWN = { x:sx, y:sy, z:sz };

const pcx = Math.floor(sx / WORLD.CHUNK_X);
const pcz = Math.floor(sz / WORLD.CHUNK_Z);
for (let dz=-WORLD.VIEW_RADIUS_CHUNKS; dz<=WORLD.VIEW_RADIUS_CHUNKS; dz++)
for (let dx=-WORLD.VIEW_RADIUS_CHUNKS; dx<=WORLD.VIEW_RADIUS_CHUNKS; dx++)
world.ensureChunk(pcx+dx, pcz+dz);

pushChat('T – czat. Komendy: /tp @p X Y Z (ujemne OK), /time set day|night, /gamerule dodaycycle true|false. Spawn: 0 ~ 0 (lub z save). Doba: 20 min.', 'system');
requestAnimationFrame(loop);
}

// ----------------- Safe placeholders (if modules not loaded yet) -----------------
// Jeśli moduły fluid/lava/tick nie zostały jeszcze załadowane, podstawiamy "bezpieczne" stuby.
// Dzięki temu rdzeń może działać zanim wyniesiesz fizykę do osobnych plików.

if (typeof Game === 'undefined') window.Game = {};
// upewnij się, że Game istnieje
Game = window.Game || {};

// TickSystem stub (tymczasowy / bezpieczny) — nie robi nic, dopóki nie wgrasz tick.js
if (!Game.tickSystem) {
  Game.tickSystem = {
    add: function() { /* noop na razie */ },
    remove: function() { /* noop */ },
    start: function() { /* noop */ },
    stop: function() { /* noop */ }
  };
}

// Placeholdery dla płynów — moduły fluid / lava nadpiszą to gdy zostaną załadowane
if (!Game.fluid) Game.fluid = null;
if (!Game.lava)  Game.lava  = null;
if (!Game.animations) Game.animations = null;

// Przygotuj też pola, które moduły mogą używać/ustawiać (żeby nikt nie czytał undefined)
Game._modulesReady = Game._modulesReady || {};


// ----------------- Auto-rejestracja modułów (jeśli moduł ustawi Game.fluid lub Game.lava) -----------------
// Funkcja, którą moduły mogą wywołać lub sami wywołają po przypisaniu do Game.fluid/Game.lava.
// To pozwala na "odwróconą zależność": rdzeń nie musi znać modułu, moduł sam się podłączy.

Game.registerModuleForTick = function(name, obj) {
  // name: 'fluid'|'lava'|'animations' etc.
  // obj: obiekt z metodą update(dt) lub update()
  Game._modulesReady[name] = obj;
  try {
    if (Game.tickSystem && typeof Game.tickSystem.add === 'function' && obj && typeof obj.update === 'function') {
      Game.tickSystem.add(obj.update.bind(obj));
    }
  } catch (e) {
    console.warn('Failed to auto-register module to tickSystem:', name, e);
  }
};


// ----------------- Eksport do Game dla modułów -----------------
Game.BLOCK = BLOCK;
Game.BLOCK_INFO = BLOCK_INFO;
Game.world = world;
Game.inventory = inventory;
Game.input = input;
Game.MODE = MODE;
Game.raycast = raycast;
Game.offsetForFace = offsetForFace;
Game.CREATIVE_ITEMS = CREATIVE_ITEMS;
Game.startGame = internalStartGame;
Game.player = player;

})();