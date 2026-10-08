// Sky dome, clouds, sun, and the lighting rig. Everything is driven by G.phase
// (0 = afternoon, 1 = night) and the day's preset.
import { THREE, V3, scene, toon, renderer } from './gfx.js';
import { lerp, clamp, rand, smooth } from './util.js';
import { G } from './state.js';
import { world } from './world.js';

const hemi = new THREE.HemisphereLight(0xbcd8ff, 0xa08060, .9); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
key.position.set(-6, 12, 9); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 50 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xffc070, .8); scene.add(rim);
const lantern = new THREE.PointLight(0xffa860, 0, 24, 1.4); lantern.position.set(0, 4.3, 0.8); scene.add(lantern);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false,
  uniforms: {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
    sunCol: { value: new THREE.Color() }, sunDir: { value: new V3(0, .3, -1) }, stars: { value: 0 }, time: { value: 0 },
    moon: { value: 0 }, moonDir: { value: new V3(-.5, .5, -1).normalize() },
  },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `
    uniform vec3 top, horizon, bottom, sunCol, sunDir, moonDir; uniform float stars, time, moon; varying vec3 vDir;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(horizon, top, smoothstep(0.0, 0.5, h));
      col = mix(col, bottom, smoothstep(0.0, -0.2, h));
      float sd = max(dot(d, normalize(sunDir)), 0.);
      col += sunCol * (pow(sd, 6.) * .35 + pow(sd, 160.) * 1.2 + smoothstep(.9993, .9996, sd) * 2.5);
      vec3 q = floor(d * 380.);
      float s = step(.9972, hash(q)) * smoothstep(.04, .3, h);
      col += vec3(s) * stars * (.55 + .45 * sin(time * 2.5 + hash(q) * 60.));
      float md = max(dot(d, moonDir), 0.);
      col += moon * (vec3(1., .97, .88) * smoothstep(.9990, .9993, md) * 1.6 + vec3(.5,.55,.8) * pow(md, 60.) * .25);
      gl_FragColor = vec4(col, 1.);
      #include <colorspace_fragment>
    }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat));

const cloudMat = toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: .3, fog: false });
function cloud(x, y, z, s, n) {
  const g = new THREE.Group(), geo = new THREE.IcosahedronGeometry(1, 2);
  for (let i = 0; i < n; i++) {
    const t = i / n, r = s * (1 - t * .45) * rand(.55, 1);
    const m = new THREE.Mesh(geo, cloudMat);
    m.position.set(rand(-1, 1) * s * (1.5 - t), t * s * 2.1 + rand(0, .3) * s, rand(-.5, .5) * s);
    m.scale.setScalar(r); g.add(m);
  }
  g.position.set(x, y, z); scene.add(g); return g;
}
const clouds = [cloud(-70, 8, -190, 16, 30), cloud(45, 10, -210, 10, 16), cloud(110, 20, -200, 9, 12), cloud(-150, 6, -190, 12, 14), cloud(10, 34, -240, 7, 9), cloud(170, 4, -170, 10, 12)];

const P = (o) => { const r = {}; for (const k in o) r[k] = typeof o[k] === 'string' ? new THREE.Color(o[k]) : o[k]; return r; };
const BASE = [
  [0.00, { top: '#2f6fd0', hor: '#cfe6f7', bot: '#9fb7cf', sun: '#fff2d6', key: '#fff1dc', keyI: 2.9, hs: '#bcd8ff', hg: '#a08060', hI: .85, rimI: .5, cloud: '#ffffff' }],
  [0.45, { top: '#4a6fc0', hor: '#ffd8a0', bot: '#c9a989', sun: '#ffc070', key: '#ffd29a', keyI: 2.6, hs: '#c8c8ff', hg: '#a07050', hI: .8, rimI: 1.0, cloud: '#ffe2c0' }],
  [0.70, { top: '#4b4f9c', hor: '#ff9e86', bot: '#b07a80', sun: '#ff7a4a', key: '#ffa078', keyI: 1.6, hs: '#b0a0e0', hg: '#7a5060', hI: .9, rimI: 1.2, cloud: '#ffb0a0' }],
  [0.86, { top: '#23285e', hor: '#c06a80', bot: '#503a60', sun: '#ff5a50', key: '#c07090', keyI: .8, hs: '#7a70c0', hg: '#403050', hI: .7, rimI: .6, cloud: '#a07090' }],
  [1.00, { top: '#070b26', hor: '#232a5c', bot: '#12122a', sun: '#000000', key: '#6070c0', keyI: .4, hs: '#5060a0', hg: '#202030', hI: .5, rimI: 0, cloud: '#384070' }],
].map(([p, o]) => [p, P(o)]);

// presets tweak the base keyframes: { palette overrides at given keys, stars, moon, sunArc }
const PRESETS = {
  clear: {},
  hot: { tint: { top: '#1f63d6', hor: '#bfe2ff' }, sunHigh: .55 },
  shower: { overcast: true },
  starry: { stars: 1.4 },
  moon: { stars: .8, moon: 1 },
};
let preset = PRESETS.clear, presetName = 'clear';
const pal = {}; for (const k in BASE[0][1]) pal[k] = typeof BASE[0][1][k] === 'number' ? 0 : new THREE.Color();
const tmp = new THREE.Color();

function samplePal(p) {
  let i = 0; while (i < BASE.length - 2 && p > BASE[i + 1][0]) i++;
  const [p0, a] = BASE[i], [p1, b] = BASE[i + 1]; const t = clamp((p - p0) / (p1 - p0), 0, 1);
  for (const k in a) { if (typeof a[k] === 'number') pal[k] = lerp(a[k], b[k], t); else pal[k].lerpColors(a[k], b[k], t); }
  if (preset.tint) for (const k in preset.tint) pal[k].lerp(tmp.set(preset.tint[k]), .5 * (1 - smooth(.4, .8, p)));
  if (preset.overcast) {
    // grey, low-contrast sky that clears late in the evening
    const o = sky.overcast;
    tmp.set('#9aa6b4'); pal.top.lerp(tmp, .7 * o); tmp.set('#c4c9cf'); pal.hor.lerp(tmp, .6 * o);
    pal.keyI *= 1 - .45 * o; pal.rimI *= 1 - .8 * o; pal.sun.multiplyScalar(1 - .85 * o);
  }
  return pal;
}

export const sky = {
  lights: { key, hemi, rim, lantern },
  clouds, cloudMat, skyMat,
  sunDir: new V3(),
  night: 0,
  overcast: 0,       // 0..1, driven by the 'shower' preset (or chapters)
  rain: 0,           // 0..1, chapters/sky effects read this
  fireflies: 0,      // 0..1, glowing fireflies over the trees
  rainbow: 0,        // 0..1, after a shower
  milkyWay: 0,       // 0..1, extra for the 'starry' preset
  starPair: 0,       // 0..1, Vega (Orihime) and Altair (Hikoboshi) brighten
  stars: { vega: new V3(-.35, .62, -1).normalize(), altair: new V3(.38, .5, -1).normalize() },
  get preset() { return presetName; },
  setPreset(name) { presetName = name in PRESETS ? name : 'clear'; preset = PRESETS[presetName]; },
  flash(col, amt = 1) { G.flash = amt; G.flashCol = (G.flashCol || new THREE.Color()).copy(col); },

  update(dt, p) {
    const Pl = samplePal(p);
    skyMat.uniforms.top.value.copy(Pl.top); skyMat.uniforms.horizon.value.copy(Pl.hor); skyMat.uniforms.bottom.value.copy(Pl.bot);
    const el = lerp(preset.sunHigh ?? .42, -.06, p), sd = sky.sunDir.set(.45, Math.sin(el), -1).normalize();
    skyMat.uniforms.sunDir.value.copy(sd); skyMat.uniforms.sunCol.value.copy(Pl.sun);
    const night = sky.night = smooth(.78, 1, p);
    skyMat.uniforms.stars.value = night * (preset.stars ?? 1) * (1 - sky.overcast);
    skyMat.uniforms.moon.value = (preset.moon ?? 0) * smooth(.7, .95, p);
    skyMat.uniforms.time.value = G.time;
    scene.fog.color.copy(Pl.hor);
    key.color.copy(Pl.key); key.intensity = Pl.keyI;
    rim.color.copy(Pl.sun); rim.intensity = Pl.rimI; rim.position.copy(sd).multiplyScalar(30);
    hemi.color.copy(Pl.hs); hemi.groundColor.copy(Pl.hg); hemi.intensity = Pl.hI + (G.flash || 0) * .5;
    cloudMat.emissive.copy(Pl.cloud); cloudMat.emissiveIntensity = .35;
    const c = world.cityMat;
    c.emissiveIntensity = smooth(.62, .95, p) * 1.6;
    c.color.setRGB(lerp(.5, .14, smooth(.5, 1, p)), lerp(.6, .16, smooth(.5, 1, p)), lerp(.8, .3, smooth(.5, 1, p)));
    world.lanternMats.forEach(m => m.emissiveIntensity = .05 + smooth(.6, .95, p) * .8);
    lantern.intensity = smooth(.65, 1, p) * 14;
    if (G.flash > 0) { lantern.color.copy(G.flashCol); lantern.intensity += G.flash * 20; G.flash = Math.max(0, G.flash - dt * 3); }
    else lantern.color.set(0xffa860);
    clouds.forEach((g, i) => g.position.x += dt * (.4 + i * .07) * (world.wind || .5));
  },
};
