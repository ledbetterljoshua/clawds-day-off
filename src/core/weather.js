// Weather that lives in the scene: rain streaks, ripples on the counter, drips off the beam,
// fireflies, wet wood, heat shimmer over the city. sky.js drives it with levels (0..1).
import { THREE, V3, scene, camera, MAT } from './gfx.js';
import { G } from './state.js';
import { clamp, lerp, rand } from './util.js';
import { world } from './world.js';

let rainLines = null, ripples = null, bounce = null, drips = null, flies = null, woodBase = null;
const shimmerU = { uShimmer: { value: 0 }, uShTime: { value: 0 } };
const camDir = new V3();
const WET = new THREE.Color('#5a4a52');

export const weather = { wet: 0, init, update };

function init(sky) {
  const low = sky.tier === 'low';
  rainLines = makeRain(low ? 900 : 2400);
  ripples = makeRipples(low ? 70 : 160);
  bounce = makeBounce(low ? 220 : 520);
  drips = makeDrips(90);
  flies = makeFireflies(low ? 70 : 160);
  woodBase = ['wood', 'woodDark', 'woodLight'].map(k => [MAT[k], MAT[k].color.clone()]);
  patchCityShimmer();
  weather.parts = { rainLines, ripples, bounce, drips, flies };
}

// ── rain: line streaks in a box that travels with the camera; all motion in the shader ──
function makeRain(n) {
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(n * 6), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); seed.set([a, b, c, a, b, c], i * 6); end[i * 2 + 1] = 1; }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uWind: { value: .5 }, uCenter: { value: new V3() }, uBox: { value: new V3(30, 16, 22) }, uCol: { value: new THREE.Color('#c9d5e8') } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; attribute float aEnd;
      uniform float uTime, uAmt, uWind; uniform vec3 uCenter, uBox;
      varying float vA;
      void main(){
        float spd = 14. + aSeed.z * 8., H = uBox.y;
        float y = mod(aSeed.y * H - uTime * spd, H);
        float fallen = H - y, slant = uWind * .22;
        vec3 head = uCenter + vec3((aSeed.x - .5) * uBox.x + fallen * slant, y - H * .5, (fract(aSeed.x * 7.13 + aSeed.z * 3.7) - .5) * uBox.z);
        vec3 vel = normalize(vec3(slant, -1., 0.));
        vec3 p = head - vel * (.45 + aSeed.z * .35) * aEnd;
        vA = step(aSeed.z, uAmt) * mix(1., .1, aEnd) * smoothstep(0., H * .12, y) * smoothstep(H, H * .85, y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA;
      void main(){ gl_FragColor = vec4(uCol, vA * .5); }`,
  });
  const m = new THREE.LineSegments(geo, mat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m);
  return m;
}

// ── ripples: rings that bloom where drops land on the counter ──
function makeRipples(n) {
  const base = new THREE.RingGeometry(.45, 1, 24);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.instanceCount = n;
  const s = new Float32Array(n * 3); for (let i = 0; i < s.length; i++) s[i] = Math.random();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float uTime, uAmt; varying float vA;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float ph = uTime * (.8 + aSeed.z * .9) + aSeed.x * 17.;
        float k = fract(ph), cyc = floor(ph);
        vec3 c = vec3(mix(-10.5, 10.5, h(cyc * 12.99 + aSeed.y * 78.2)), .014, mix(-1.1, 1.1, h(cyc * 39.35 + aSeed.x * 11.1)));
        vec3 p = c + vec3(position.x, 0., position.y) * (.04 + k * .3);
        vA = pow(1. - k, 1.5) * step(aSeed.z, uAmt) * .8;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */`varying float vA; void main(){ gl_FragColor = vec4(.92, .95, 1., vA * .75); }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m);
  return m;
}

// ── rain bouncing off the counter: tiny droplets that hop up and fall back ──
function makeBounce(n) {
  const seed = new Float32Array(n * 4); for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uPx: { value: 2.2 * Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */`
      attribute vec4 aSeed; uniform float uTime, uAmt, uPx; varying float vA;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float ph = uTime * (1.6 + aSeed.z * 1.2) + aSeed.x * 23.;
        float k = fract(ph), cyc = floor(ph), tt = k * .38, a = aSeed.w * 6.2832;
        vec3 c = vec3(mix(-10.5, 10.5, h(cyc * 12.99 + aSeed.y * 78.2)), .01, mix(-1.1, 1.1, h(cyc * 39.35 + aSeed.x * 11.1)));
        vec3 p = c + vec3(cos(a) * .55, 1.3 + h(aSeed.w * 91.) * .9, sin(a) * .55) * tt + vec3(0., -4.9 * tt * tt, 0.);
        vA = (1. - k) * step(aSeed.z, uAmt) * step(0., p.y);
        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_PointSize = uPx * (14. / max(1., -mv.z)) + 1.;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`varying float vA; void main(){ float r = length(gl_PointCoord - .5); gl_FragColor = vec4(.93, .96, 1., vA * smoothstep(.5, .1, r) * .85); }`,
  });
  const m = new THREE.Points(geo, mat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m);
  return m;
}

// ── drips off the pergola beam and the lanterns (CPU, small pool) ──
function makeDrips(n) {
  const pos = new Float32Array(n * 3).fill(-999), vy = new Float32Array(n), life = new Float32Array(n);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: .06, color: 0xd8e6ff, transparent: true, opacity: .8, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, pos, vy, life, n, i: 0, acc: 0 };
}
function updateDrips(dt, amt) {
  const D = drips;
  D.acc += dt * amt * 16;
  while (D.acc >= 1) {
    D.acc -= 1;
    const i = D.i++ % D.n;
    if (Math.random() < .7) D.pos.set([rand(-10.6, 10.6), 6.02, -1.5 + rand(-.12, .12)], i * 3);
    else { const L = world.lanterns[Math.floor(Math.random() * world.lanterns.length)]; D.pos.set([L.position.x, L.position.y - .9, L.position.z], i * 3); }
    D.vy[i] = -rand(.2, .8); D.life[i] = 2.5;
  }
  for (let i = 0; i < D.n; i++) {
    if (D.life[i] <= 0) continue;
    D.life[i] -= dt; D.vy[i] -= 12 * dt; D.pos[i * 3 + 1] += D.vy[i] * dt;
    const onCounter = Math.abs(D.pos[i * 3 + 2]) < 1.2 && D.pos[i * 3 + 1] < .02;
    if (D.life[i] <= 0 || onCounter || D.pos[i * 3 + 1] < -4) { D.life[i] = 0; D.pos[i * 3 + 1] = -999; }
  }
  D.pts.geometry.attributes.position.needsUpdate = true;
}

// ── fireflies: blinking points over the trees, below the rail, and a few among the crew ──
function makeFireflies(n) {
  const base = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const z = Math.random();
    let p;
    if (z < .38) { const side = Math.random() < .5 ? -1 : 1; p = [side * rand(10.5, 17), rand(-2.4, 2.2), rand(-12, -3)]; }      // over the treetops
    else if (z < .72) p = [rand(-10.5, 10.5), rand(-2.6, -.5), rand(1.5, 3.8)];                                                  // below the rail
    else if (z < .86) p = [rand(-9, 9), rand(.5, 2.8), rand(-.6, 1.6)];                                                          // among the crew
    else p = [rand(-28, 28), rand(-9, -1), rand(-30, -14)];                                                                       // far over the trees
    base.set(p, i * 3); seed.set([Math.random(), Math.random(), rand(.4, 1), Math.random()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uPx: { value: 13 * Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */`
      attribute vec4 aSeed; uniform float uTime, uAmt, uPx; varying float vB; varying float vHue;
      void main(){
        float f = .6 + aSeed.x * .8, ph = aSeed.y * 6.2832;
        vec3 p = position + vec3(sin(uTime * .31 * f + ph) * 1.1 + sin(uTime * .13 * f + ph * 3.) * .6, sin(uTime * .23 * f + ph * 2.) * .5, cos(uTime * .27 * f + ph) * .9) * aSeed.z;
        float blink = pow(max(0., sin(uTime * (1. + aSeed.w * 1.4) + ph * 5.)), 5.);
        vB = blink * smoothstep(aSeed.w * .85, aSeed.w * .85 + .15, uAmt);
        vHue = aSeed.x;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = uPx * (1. + blink * .6) * (20. / max(1., -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vB; varying float vHue;
      void main(){
        float r = length(gl_PointCoord - .5), a = smoothstep(.5, 0., r); a *= a;
        vec3 c = mix(vec3(.75, 1., .3), vec3(1., .92, .4), vHue);
        gl_FragColor = vec4(c * a * vB * 3., a * vB);
      }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; pts.visible = false; scene.add(pts);
  return pts;
}

// heat haze: distant buildings waver a little on a hot afternoon
function patchCityShimmer() {
  const cm = world.cityMat;
  cm.onBeforeCompile = shader => {
    shader.uniforms.uShimmer = shimmerU.uShimmer; shader.uniforms.uShTime = shimmerU.uShTime;
    shader.vertexShader = 'uniform float uShimmer;\nuniform float uShTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ix = instanceMatrix[3].x;
      #else
        float ix = 0.;
      #endif
      float hgt = position.y + .5;
      transformed.x += sin(uShTime * 3.3 + hgt * 9. + ix * .21) * uShimmer * .07 * hgt;
      transformed.y += sin(uShTime * 2.7 + ix * .37) * uShimmer * .04 * hgt;`);
  };
  cm.customProgramCacheKey = () => 'city-shimmer';
}

function update(dt, sky, lv) {
  const t = G.time, r = lv.rain;
  rainLines.visible = ripples.visible = bounce.visible = r > .002;
  if (r > .002) {
    const u = rainLines.material.uniforms;
    camera.getWorldDirection(camDir);
    u.uTime.value = t; u.uAmt.value = r; u.uWind.value = world.wind || .5;
    u.uCenter.value.copy(camera.position).addScaledVector(camDir, 10);
    ripples.material.uniforms.uTime.value = t; ripples.material.uniforms.uAmt.value = r;
    bounce.material.uniforms.uTime.value = t; bounce.material.uniforms.uAmt.value = r;
  }
  updateDrips(dt, Math.max(r, weather.wet > .3 ? (weather.wet - .3) * .4 : 0));
  // wood darkens while it rains and dries slowly after
  weather.wet = clamp(weather.wet + (r - weather.wet) * dt / (r > weather.wet ? 5 : 45), 0, 1);
  for (const [m, base] of woodBase) m.color.copy(base).lerp(WET, weather.wet * .38);
  const f = lv.fireflies;
  flies.visible = f > .002;
  if (flies.visible) { flies.material.uniforms.uTime.value = t; flies.material.uniforms.uAmt.value = f; }
  shimmerU.uShimmer.value = lv.shimmer; shimmerU.uShTime.value = t;
}
