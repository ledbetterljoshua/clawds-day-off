// Sky dome, painted clouds, sun/moon/stars, and the lighting rig. Everything is driven by
// G.phase (0 = afternoon, 1 = night) and the day's preset. Chapters drive the weather by
// assigning levels (0..1): sky.rain = .8. A level a chapter never touches follows the preset.
import { THREE, V3, scene, camera, toon, renderer } from './gfx.js';
import { lerp, clamp, rand, smooth } from './util.js';
import { G } from './state.js';
import { world } from './world.js';
import { weather } from './weather.js';
import { audio } from './audio.js';

// ── quality tier (post.js reads it and can change it) ──
const qp = G.dev.get('q');
const autoLow = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  || (navigator.hardwareConcurrency || 8) <= 4 || Math.min(screen.width, screen.height) < 600;
const tier = qp === 'low' || qp === 'high' ? qp : autoLow ? 'low' : 'high';
if (tier === 'low') renderer.shadowMap.type = THREE.PCFShadowMap;

// ── lights ──
const hemi = new THREE.HemisphereLight(0xbcd8ff, 0xa08060, .9); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
key.position.set(-6, 12, 9); key.castShadow = true;
key.shadow.mapSize.set(tier === 'low' ? 1024 : 2048, tier === 'low' ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 50 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xffc070, .8); scene.add(rim);
// warm glow from the lantern string; three lights on high so both ends of the counter catch it
const lanterns = (tier === 'low' ? [[0, 4.3, .8]] : [[-6.4, 4.5, .7], [0, 4.2, .8], [6.4, 4.5, .7]]).map(([x, y, z]) => {
  const l = new THREE.PointLight(0xffa860, 0, 22, 1.5); l.position.set(x, y, z); scene.add(l); return l;
});
const lantern = lanterns[Math.floor(lanterns.length / 2)];

// ── tone curve inverse: the palette is authored as the colors we want on screen ──
const ACES_IN = new THREE.Matrix3().fromArray([.59719, .07600, .02840, .35458, .90834, .13383, .04823, .01566, .83777]);
const ACES_OUT = new THREE.Matrix3().fromArray([1.60475, -.10208, -.00327, -.53108, 1.10813, -.07276, -.07367, -.00605, 1.07602]);
const IN_INV = ACES_IN.clone().invert(), OUT_INV = ACES_OUT.clone().invert();
const _v = new V3();
const rrtInv = y => { y = clamp(y, 0, .985); const qa = 1 - y * .983729, qb = .0245786 - y * .4329510, qc = -(.000090537 + y * .238081); return (-qb + Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa); };
function toScene(col, out) {
  _v.set(col.r, col.g, col.b).applyMatrix3(OUT_INV);
  _v.set(rrtInv(_v.x), rrtInv(_v.y), rrtInv(_v.z)).applyMatrix3(IN_INV).divideScalar(renderer.toneMappingExposure / .6);
  return out.setRGB(Math.max(0, _v.x), Math.max(0, _v.y), Math.max(0, _v.z));
}

// ── the sky dome ──
const U = n => ({ value: n });
const C = () => ({ value: new THREE.Color() });
const D = () => ({ value: new V3() });
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    uTop: C(), uHor: C(), uBot: C(), uHaze: C(), uSun: C(), uLit: C(), uShade: C(), uBase: C(), uOcD: C(), uOcL: C(),
    uCityGlow: C(), uMoonCol: C(), uMwCol: C(),
    uSunDir: D(), uMoonDir: D(), uVega: D(), uAltair: D(), uMwN: D(), uMwA: D(), uMwB: D(), uRbC: D(),
    uTime: U(0), uSunI: U(1), uNight: U(0), uStars: U(0), uCover: U(1), uCirrus: U(.6), uPuffs: U(.4), uOvercast: U(0), uRain: U(0),
    uMilky: U(0), uPair: U(0), uMoon: U(0), uRainbow: U(0), uFlash: U(0), uDrift: U(0), uHeroAz: U(-.42), uHeroS: U(.06), uSeed: U(0),
    uDetail: U(tier === 'low' ? 0 : 1), uHazeAmt: U(.7), uSunset: U(0), uLightAz: U(0), uLightEl: U(0), uLightZ: U(.55),
    uOutInv: { value: OUT_INV }, uInInv: { value: IN_INV }, uExpK: U(1.75),
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uTop, uHor, uBot, uHaze, uSun, uLit, uShade, uBase, uOcD, uOcL, uCityGlow, uMoonCol, uMwCol;
    uniform vec3 uSunDir, uMoonDir, uVega, uAltair, uMwN, uMwA, uMwB, uRbC;
    uniform float uTime, uSunI, uNight, uStars, uCover, uCirrus, uPuffs, uOvercast, uRain, uMilky, uPair, uMoon, uRainbow, uFlash;
    uniform float uDrift, uHeroAz, uHeroS, uSeed, uDetail, uHazeAmt, uSunset, uLightAz, uLightEl, uLightZ, uExpK;
    uniform mat3 uOutInv, uInInv;
    varying vec3 vDir;
    int OCT;

    // undo the final ACES pass so the sky lands on the authored colors
    vec3 rrtInv(vec3 y){
      vec3 qa = 1. - y * .983729, qb = .0245786 - y * .4329510, qc = -(.000090537 + y * .238081);
      return (-qb + sqrt(qb * qb - 4. * qa * qc)) / (2. * qa);
    }
    vec3 toScene(vec3 disp){ return max(uInInv * rrtInv(clamp(uOutInv * disp, 0., .985)) / uExpK, 0.); }

    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
    vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
      return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), u.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), u.x), u.y);
    }
    float fbm(vec2 p, int oct){
      float a = .5, s = 0.;
      for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * vnoise(p); p = p * 2.07 + vec2(17.1, 3.7); a *= .5; }
      return s;
    }
    vec3 hue(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
    float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }

    // one cumulus: a union of discs in rows that narrow upward, cut flat at the base.
    // x = signed distance (negative inside), y = puff height (each disc a sphere cap) for shading
    vec2 cumulus(vec2 p, vec2 o, float S, float tall, float sd){
      vec2 q = (p - o) / S; q.y /= tall;
      if (abs(q.x) > 2.9 || q.y > 2.7 || q.y < -.3) return vec2(.25 * S, 0.);
      float lean = (hash12(vec2(sd, 23.)) - .5) * .5, d = 1e3, H = 0.;
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        vec2 c; float r, k;
        if (i < 5) { c = vec2((fi - 2.) * .6 + (hash12(vec2(sd, fi)) - .5) * .3, .38 + hash12(vec2(sd + 3., fi)) * .2); r = .42 + hash12(vec2(sd + 5., fi)) * .33; k = .2; }
        else if (i < 8) { float fj = fi - 5.; c = vec2((fj - 1.) * .6 + (hash12(vec2(sd + 7., fj)) - .5) * .35 + lean * .9, .98 + hash12(vec2(sd + 9., fj)) * .3); r = .38 + hash12(vec2(sd + 11., fj)) * .3; k = .17; }
        else { c = vec2((hash12(vec2(sd, 13.)) - .5) * .5 + lean * 1.5, 1.5 + hash12(vec2(sd, 17.)) * .25); r = .3 + hash12(vec2(sd, 19.)) * .2; k = .14; }
        float dd = length(q - c);
        d = smin(d, dd - r, k);
        H = -smin(-H, -sqrt(max(r * r - dd * dd, 0.)), .12);
      }
      d = max(d, .05 - q.y);
      return vec2(d * S * min(tall, 1.3), H);
    }
    // a layer of clouds scattered in azimuth cells
    vec2 layer(vec2 p, float cell, float elLo, float elHi, float sMin, float sMax, float prob, float sd, out float base, out float size){
      float i = floor(p.x / cell); vec2 best = vec2(1e3, 0.); base = 0.; size = sMax;
      for (int k = -1; k <= 1; k++) {
        float c = i + float(k);
        // clouds grow and shrink smoothly as coverage changes, instead of popping
        float grow = clamp((prob - hash12(vec2(c, sd))) / .15, 0., 1.);
        if (grow < .02) continue;
        float r1 = hash12(vec2(c, sd + 1.3)), r2 = hash12(vec2(c, sd + 2.9)), r3 = hash12(vec2(c, sd + 4.7));
        float S = mix(sMin, sMax, r2 * r2) * grow, eb = mix(elLo, elHi, r3);
        vec2 dd = cumulus(p, vec2((c + .5 + (r1 - .5) * .5) * cell, eb), S, 1. + r2 * .5, c * 7.31 + sd);
        if (dd.x < best.x) { best = dd; base = eb; size = S; }
      }
      return best;
    }
    vec2 clouds(vec2 p, out float base, out float size){
      vec2 d = layer(p, .3, -.02, .03, .022, .06, .85 * uCover, uSeed, base, size);
      vec2 h = cumulus(p, vec2(uHeroAz, -.016), uHeroS, 1.45, uSeed + 41.);
      if (h.x < d.x) { d = h; base = -.016; size = uHeroS; }
      return d;
    }

    void main(){
      OCT = uDetail > .5 ? 5 : 3;
      vec3 d = normalize(vDir);
      float el = asin(clamp(d.y, -1., 1.)), az = atan(d.x, -d.z);
      vec2 uv = vec2(az + uDrift, el);

      // ---- display-space painting ----
      float tg = pow(clamp((el + .02) / .42, 0., 1.), .6);
      vec3 col = mix(uHor, uTop, tg);
      col = mix(col, uBot, smoothstep(0., -.12, el));
      col = mix(col, uHaze, exp(-max(el, 0.) * 30.) * uHazeAmt);
      col += uCityGlow * uNight * exp(-max(el, 0.) * 22.) * .35;
      float sd = dot(d, uSunDir);
      col += uSun * pow(max(sd, 0.), 5.) * .2 * uSunI;
      vec3 hdr = vec3(0.);

      // milky way
      float mwCore = 0.;
      if (uMilky > 0.) {
        float x = dot(d, uMwN), along = atan(dot(d, uMwB), dot(d, uMwA));
        float w = .15 + .05 * sin(along * 2. + 1.);
        mwCore = exp(-x * x / (w * w));
        float cl = fbm(vec2(along * 6., x * 16.), OCT);
        float dust = smoothstep(.42, .72, fbm(vec2(along * 11. + 4., x * 38.), OCT)) * exp(-x * x / (w * w * .16));
        col += uMwCol * mwCore * (.3 + 1.1 * cl * cl) * (1. - .85 * dust) * uMilky * smoothstep(-.01, .12, el) * .9;
      }
      // stars and the summer pair (scene-linear, so they can bloom)
      if (uStars > 0.) {
        vec3 p = d * 240., c = floor(p);
        float h = hash13(c);
        if (h > .955 - .07 * mwCore * uMilky) {
          vec3 o = hash33(c + 1.7) * .7 + .15;
          float dist = length(fract(p) - o), mag = pow(hash13(c + 5.1), 8.);
          float tw = .65 + .35 * sin(uTime * (1.5 + h * 4.) + h * 50.);
          float s = smoothstep(.2 + mag * .25, 0., dist) * (.35 + mag * 2.5) * tw;
          hdr += mix(vec3(.7, .8, 1.), vec3(1., .88, .7), hash13(c + 9.3)) * s * uStars * smoothstep(0., .2, el);
        }
        for (int k = 0; k < 2; k++) {
          vec3 sdir = k == 0 ? uVega : uAltair;
          float a = acos(clamp(dot(d, sdir), -1., 1.));
          vec3 tx = normalize(cross(sdir, vec3(0., 1., 0.))), ty = cross(tx, sdir);
          vec2 l = vec2(dot(d, tx), dot(d, ty));
          float spikes = (exp(-abs(l.x) * 2600.) * exp(-abs(l.y) * 160.) + exp(-abs(l.y) * 2600.) * exp(-abs(l.x) * 160.)) * uPair;
          float tw = .85 + .15 * sin(uTime * 3.1 + float(k) * 2.);
          vec3 sc = k == 0 ? vec3(.8, .9, 1.) : vec3(1., .95, .82);
          hdr += sc * (exp(-pow(a / .0018, 2.)) * 2.2 + exp(-pow(a / .014, 2.)) * (.15 + .6 * uPair) + spikes * 1.6) * tw * uStars * (1. + 1.5 * uPair);
        }
      }
      // the moon: a big painted disc with maria, and a halo
      if (uMoon > 0.) {
        float md = dot(d, uMoonDir), a = acos(clamp(md, -1., 1.)), r = .034;
        vec3 rx = normalize(cross(uMoonDir, vec3(0., 1., 0.))), ry = cross(rx, uMoonDir);
        vec2 mp = vec2(dot(d, rx), dot(d, ry)) / r;
        float disk = smoothstep(r, r - .0016, a);
        float maria = fbm(mp * 2.3 + 4., OCT);
        vec3 mc = mix(vec3(1.), vec3(.8, .8, .84), smoothstep(.45, .68, maria)) * mix(uMoonCol, vec3(1.), .4);
        mc *= .86 + .14 * sqrt(max(0., 1. - dot(mp, mp)));
        col = mix(col, mc * .97, disk * uMoon);
        col += uMoonCol * (pow(max(md, 0.), 60.) * .18 + pow(max(md, 0.), 8.) * .06) * uMoon;
        hdr += uMoonCol * (disk * 1.2 + pow(max(md, 0.), 900.) * .4) * uMoon;
      }
      // the sun: soft core and disk, scene-linear so it blooms
      float sunDisk = smoothstep(.99955, .99978, sd) * smoothstep(-.012, .004, el);
      vec3 sunHdr = uSun * (pow(max(sd, 0.), 90.) * .9 + sunDisk * 3.5) * uSunI;

      // cirrus streaks high up, pink and gold at sunset
      if (uCirrus > 0. && el > .05) {
        vec2 cp = vec2(uv.x * 2.3 + el * 4., el * 15.);
        float ci = fbm(cp, OCT);
        float cm = smoothstep(.56, .8, ci) * smoothstep(.06, .22, el) * (1. - smoothstep(.85, 1.3, el)) * uCirrus;
        col = mix(col, mix(uLit, uSun * .9 + uLit * .2, uSunset * .75), cm * .5);
      }

      // cumulus: flat-bottomed, cauliflower tops, lit like paint
      float cloudA = 0.;
      if (el > -.04 && el < .42) {
        float base, size;
        vec2 cf = clouds(uv, base, size);
        float f = cf.x;
        if (f < .006) {
          float e = .0015, bx, sx;
          vec2 cx = clouds(uv + vec2(e, 0.), bx, sx), cy = clouds(uv + vec2(0., e), bx, sx);
          vec2 n = vec2(cx.x - f, cy.x - f); n /= length(n) + 1e-6;
          // puff normals from the sphere-cap heights (height is in units of the cloud size)
          vec2 gH = vec2(cx.y - cf.y, cy.y - cf.y) / e * size;
          vec3 N = normalize(vec3(-gH, 1.));
          float aw = .0012 + uNight * .0028;
          float a = smoothstep(aw, -aw, f + (fbm(uv * 70. + 3., 3) - .5) * .0035) * (1. - uNight * .12);
          vec2 L2 = vec2(uLightAz - az, uLightEl - el); L2 = length(L2) > 1e-4 ? normalize(L2) : vec2(0., 1.);
          float s = smoothstep(-.3, .8, dot(N, normalize(vec3(L2, uLightZ))));
          s += (fbm(uv * 26. + 9., 3) - .5) * .14;
          s = mix(s, floor(s * 3. + .5) / 3., .35 * (1. - uNight));
          s *= mix(.74, 1., smoothstep(0., .55, (el - base) / size));
          vec3 cc = mix(uShade, uLit, clamp(s, 0., 1.));
          float fwd = pow(max(sd, 0.), 10.);
          float rimL = (1. - smoothstep(0., .005, -f)) * max(dot(n, L2), 0.);
          cc += uSun * rimL * (.25 + .9 * fwd) * uSunI * .7 + uMoonCol * rimL * uMoon * .3;
          cc = mix(cc, uBase, (1. - smoothstep(-.01, .05, el)) * .45);
          cc += uCityGlow * uNight * (1. - smoothstep(0., .1, el)) * .3;
          cc = mix(cc, uHaze, exp(-max(el, 0.) * 45.) * .45 * uHazeAmt);
          col = mix(col, cc, a);
          cloudA = a;
        }
      }
      // small fair-weather puffs higher up (seen when the camera looks up)
      if (uPuffs > 0. && el > .1 && el < .62) {
        float base, size;
        float f = layer(uv, .2, .12, .5, .009, .022, .55 * uPuffs, uSeed + 77., base, size).x;
        if (f < .004) {
          float a = smoothstep(.001, -.001, f + (fbm(uv * 90., 3) - .5) * .002);
          float s = smoothstep(0., .8, (el - base) / size) * .6 + .4;
          col = mix(col, mix(uShade, uLit, s), a * .95);
          cloudA = max(cloudA, a);
        }
      }

      // grey stratus of an overcast evening, with distant rain shafts
      if (uOvercast > 0.) {
        vec2 op = vec2(uv.x * 3.2 + uDrift, el * 7.5);
        float o1 = fbm(op + vec2(uTime * .01, 0.), OCT);
        float oc = smoothstep(-.03, .05, el) * clamp(.88 + .3 * (o1 - .5), 0., 1.);
        float o2 = fbm(op * 2.6 + 5. + vec2(uTime * .02, 0.), 3);
        vec3 ocol = mix(uOcD, uOcL, clamp(smoothstep(.25, .8, o1) * .75 + (o2 - .5) * .35 + smoothstep(0., .5, el) * .15, 0., 1.));
        if (uRain > 0.) {
          float sh = vnoise(vec2(az * 26. + uTime * .2, el * 1.5));
          ocol = mix(ocol, ocol * .8, smoothstep(.45, .9, sh) * (1. - smoothstep(0., .2, el)) * uRain);
        }
        col = mix(col, ocol, oc * uOvercast);
        cloudA = max(cloudA, oc * uOvercast);
      }

      // a rainbow over the city after the shower
      if (uRainbow > 0.) {
        float ang = acos(clamp(dot(d, uRbC), -1., 1.));
        float t = (ang - .700) / .046;
        float band = smoothstep(-.15, .15, t) * (1. - smoothstep(.85, 1.15, t));
        float feet = smoothstep(-.005, .05, el) * (1. - .5 * smoothstep(.14, .3, el));
        float k = band * feet * uRainbow * (1. - cloudA * .4);
        col = mix(col, col + hue((1. - clamp(t, 0., 1.)) * .78) * .6, k * .65);
        float t2 = (ang - .872) / .06;
        float band2 = smoothstep(-.15, .15, t2) * (1. - smoothstep(.85, 1.15, t2));
        col = mix(col, col + hue(clamp(t2, 0., 1.) * .78) * .4, band2 * feet * uRainbow * .2);
      }

      vec3 sceneCol = toScene(clamp(col, 0., 1.)) + (hdr + sunHdr) * (1. - cloudA) + vec3(.6, .65, .85) * uFlash * (.3 + cloudA);
      gl_FragColor = vec4(sceneCol, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), skyMat);
// drawn after opaque geometry so covered pixels never run the cloud shader
dome.renderOrder = 1; dome.frustumCulled = false;
scene.add(dome);

// ── palettes: keyframes across G.phase for each day's sky (colors as seen on screen) ──
const BASE = {
  top: '#3f86e2', hor: '#cfe6f6', bot: '#b9cfe0', haze: '#d9e8f2', sun: '#fff1d6', sunI: 1, lit: '#fbfbff', shade: '#aebce6', base: '#c8d0ea',
  ocD: '#7f8898', ocL: '#b8bec8', cityGlow: '#000000', key: '#fff3e2', keyI: 2.9, hs: '#c4dcff', hg: '#a58664', hI: .9, rimI: .55,
  fogNear: 10, fogFar: 240, city: '#4f5f80', cityLit: 1.6, coverK: 1, bloomS: .12, bloomT: 2.4, vig: .16, warm: .04, cool: .05, sat: 1.04, hazeAmt: .75,
};
const kf = list => list.map(([p, o]) => { const r = {}; const src = { ...BASE, ...o }; for (const k in src) r[k] = typeof src[k] === 'string' ? new THREE.Color(src[k]) : src[k]; return [p, r]; });

const CLEAR = [
  [0.00, {}],
  [0.45, { top: '#5285da', hor: '#ffdcae', bot: '#d8c0a8', haze: '#ffe0bc', sun: '#ffd08e', sunI: 1.2, lit: '#fff4e2', shade: '#b4a8da', base: '#e6c4c0', key: '#ffdcae', keyI: 2.7, hs: '#cfd0ff', hg: '#a87a58', hI: .82, rimI: 1, fogFar: 290, city: '#6a6f8c', bloomS: .14, bloomT: 2.1, vig: .2, warm: .1, cool: .06, fogFar: 230 }],
  [0.70, { top: '#5a58b0', hor: '#ff9f86', bot: '#c98a8a', haze: '#ffab98', sun: '#ff8a50', sunI: 1.4, lit: '#ffc9a2', shade: '#9a7ec8', base: '#d690a8', key: '#ffad85', keyI: 1.9, hs: '#b8a6e6', hg: '#86566a', hI: .9, rimI: 1.25, fogFar: 240, city: '#5e5578', bloomS: .2, bloomT: 1.7, vig: .22, warm: .14, cool: .08 }],
  [0.86, { top: '#26296a', hor: '#cf6c86', bot: '#6a4a70', haze: '#b4658a', sun: '#ff5d55', sunI: 1.1, lit: '#ee90a8', shade: '#4c4596', base: '#7a508a', cityGlow: '#5a3428', key: '#cf7f9c', keyI: .95, hs: '#7f74c8', hg: '#4a3456', hI: .75, rimI: .65, fogFar: 340, city: '#2e2c52', bloomS: .3, bloomT: 1.25, vig: .28, warm: .1, cool: .12 }],
  [1.00, { top: '#060a26', hor: '#292a60', bot: '#171534', haze: '#2e2d64', sun: '#000000', sunI: 0, lit: '#353a72', shade: '#1b1d48', base: '#2a2654', cityGlow: '#b05a3c', key: '#8090d8', keyI: .62, hs: '#5866aa', hg: '#3e2c38', hI: .62, rimI: 0, fogFar: 520, city: '#1c2040', bloomS: .45, bloomT: .9, vig: .34, warm: .06, cool: .16 }],
];
const HOT = [
  [0.00, { top: '#1f61de', hor: '#b8dcfa', haze: '#cae4f7', lit: '#ffffff', shade: '#9aaee6', base: '#c4cff0', key: '#fff6ea', keyI: 3.1, hs: '#c0dcff', fogFar: 260, city: '#4a5a7c', sat: 1.1, warm: .06, hazeAmt: .6 }],
  [0.55, { top: '#2b63cf', hor: '#ffe2b4', bot: '#d9c6ad', haze: '#ffe4c4', sun: '#ffd28e', sunI: 1.25, lit: '#fff6e6', shade: '#a6a6dc', base: '#e6c8bf', key: '#ffe0b2', keyI: 2.8, hs: '#cfd0ff', hg: '#a87a58', hI: .85, rimI: 1, fogFar: 340, city: '#62698c', bloomS: .13, bloomT: 2.1, vig: .18, warm: .12, sat: 1.1 }],
  [0.78, { top: '#5552b2', hor: '#ff946c', bot: '#cf8a7c', haze: '#ffa286', sun: '#ff7a3c', sunI: 1.5, lit: '#ffc18e', shade: '#9474c4', base: '#d88a98', key: '#ffa572', keyI: 1.9, hs: '#bba4e2', hg: '#8a566a', hI: .9, rimI: 1.3, fogFar: 300, city: '#5a5276', bloomS: .2, bloomT: 1.6, vig: .22, warm: .16, cool: .08, sat: 1.1 }],
  [0.90, { top: '#22266e', hor: '#c6648a', bot: '#5e4470', haze: '#a65e8a', sun: '#ff5a50', sunI: 1, lit: '#e88ca8', shade: '#463f96', base: '#6e4a88', cityGlow: '#5a3428', key: '#c47aa0', keyI: .9, hs: '#7a70c8', hg: '#46345a', hI: .72, rimI: .55, fogFar: 360, city: '#2c2a52', bloomS: .32, bloomT: 1.25, vig: .28, warm: .1, cool: .12 }],
  [1.00, { top: '#040926', hor: '#232666', bot: '#151436', haze: '#282a62', sun: '#000000', sunI: 0, lit: '#3e4888', shade: '#191c4a', base: '#282656', cityGlow: '#b05a3c', key: '#7c8cd8', keyI: .62, hs: '#5462aa', hg: '#3c2c3a', hI: .62, rimI: 0, fogFar: 540, city: '#1a1e40', bloomS: .45, bloomT: .9, vig: .34, warm: .06, cool: .16 }],
];
const SHOWER = [
  [0.00, { top: '#4a7fcf', hor: '#c4ced8', haze: '#b9c3ce', ocD: '#5e6878', ocL: '#9aa3b2', shade: '#a6adcc', fogFar: 260 }],
  [0.45, { top: '#5476c6', hor: '#cfc8c4', haze: '#bdb8b8', sun: '#ffd09a', sunI: 1.1, ocD: '#565c6e', ocL: '#8e92a2', key: '#ffe0bc', keyI: 2.5, rimI: .9, fogFar: 250, city: '#56607c' }],
  [0.70, { top: '#5c62bc', hor: '#ffa088', bot: '#cf8e8e', haze: '#ffae9c', sun: '#ff8a52', sunI: 1.5, lit: '#ffd0aa', shade: '#9a82cc', base: '#d690a8', ocD: '#7a6a80', ocL: '#b39aa6', key: '#ffb08a', keyI: 2, hs: '#bcaae8', hg: '#86566a', hI: .92, rimI: 1.35, fogFar: 340, city: '#5c5578', bloomS: .22, bloomT: 1.7, vig: .2, warm: .16, cool: .07, sat: 1.12 }],
  [0.86, { top: '#292e78', hor: '#e0768c', bot: '#6c4a72', haze: '#c26c90', sun: '#ff6552', sunI: 1.2, lit: '#f69cae', shade: '#504a9e', base: '#7e548e', ocD: '#4a3e60', ocL: '#7a6684', cityGlow: '#5a3428', key: '#d084a0', keyI: 1, hs: '#8278cc', hg: '#4a3456', hI: .76, rimI: .7, fogFar: 380, city: '#2e2c52', bloomS: .3, bloomT: 1.25, vig: .26, warm: .12, cool: .12, sat: 1.1 }],
  [1.00, { top: '#070b2a', hor: '#2c2c66', bot: '#191736', haze: '#302e66', sun: '#000000', sunI: 0, lit: '#44498a', shade: '#1c1e4c', base: '#2c2658', ocD: '#1e1e3c', ocL: '#34345a', cityGlow: '#b05a3c', key: '#8090d8', keyI: .62, hs: '#5866aa', hg: '#3e2c38', hI: .62, rimI: 0, fogFar: 520, city: '#1c2040', bloomS: .45, bloomT: .9, vig: .34, warm: .06, cool: .16 }],
];
const STARRY = CLEAR.slice(0, 3).map(([p, o]) => [p, { ...o, coverK: p < .5 ? 1 : .8 }]).concat([
  [0.86, { coverK: .5, top: '#1d2266', hor: '#b5688a', bot: '#5a4470', haze: '#9a6288', sun: '#ff5d55', sunI: 1, lit: '#de8ca6', shade: '#3c388a', base: '#6a4a86', cityGlow: '#4a2a22', key: '#bf7f9c', keyI: .9, hs: '#7470c4', hg: '#463456', hI: .72, rimI: .6, fogFar: 380, city: '#28284e', bloomS: .3, bloomT: 1.25, vig: .28, warm: .08, cool: .14 }],
  [1.00, { coverK: .3, top: '#02041a', hor: '#141a48', bot: '#0d0d24', haze: '#191e4e', sun: '#000000', sunI: 0, lit: '#333a76', shade: '#111334', base: '#1e1c44', cityGlow: '#8a4a32', key: '#7888d8', keyI: .6, hs: '#4c5aa4', hg: '#34262e', hI: .58, rimI: 0, fogFar: 600, city: '#161a38', bloomS: .45, bloomT: .88, vig: .36, warm: .04, cool: .18 }],
]);
const MOON = [
  [0.00, { top: '#1b2766', hor: '#b06a80', bot: '#5e4466', haze: '#8a5e82', sun: '#ff6a4a', sunI: .3, lit: '#5a64a0', shade: '#262a5e', base: '#5a4a7e', cityGlow: '#4a2a22', key: '#9aa0e0', keyI: 1.1, hs: '#6a6ec0', hg: '#3e3050', hI: .7, rimI: .5, fogFar: 420, city: '#262a52', cityLit: 1.4, bloomS: .3, bloomT: 1.3, vig: .28, warm: .06, cool: .14 }],
  [0.40, { top: '#0a1240', hor: '#283070', bot: '#16163a', haze: '#2c3070', sun: '#000000', sunI: 0, lit: '#3c4682', shade: '#1a1e48', base: '#2c2a5e', cityGlow: '#b05a3c', key: '#9fb0ff', keyI: .8, hs: '#5a68b0', hg: '#3a2c3a', hI: .62, rimI: .9, fogFar: 540, city: '#1c2042', bloomS: .42, bloomT: .95, vig: .34, warm: .05, cool: .17 }],
  [1.00, { top: '#050a26', hor: '#1c2358', bot: '#101030', haze: '#20255c', sun: '#000000', sunI: 0, lit: '#343e78', shade: '#151a42', base: '#24225a', cityGlow: '#b05a3c', key: '#95a6f8', keyI: .72, hs: '#5260aa', hg: '#342834', hI: .58, rimI: 1, fogFar: 600, city: '#181c3c', bloomS: .45, bloomT: .9, vig: .36, warm: .04, cool: .18 }],
];

const PRESETS = {
  clear: { frames: kf(CLEAR), cover: 1, heroAz: -.42, heroS: .12, seed: 3.1, cirrus: .65, puffs: .6 },
  hot: { frames: kf(HOT), cover: 1.2, heroAz: -.28, heroS: .14, seed: 8.4, cirrus: .35, puffs: .7, sunHigh: .58,
    auto: { shimmer: p => 1 - smooth(.45, .72, p), fireflies: p => smooth(.8, .93, p) } },
  shower: { frames: kf(SHOWER), cover: .85, heroAz: .36, heroS: .1, seed: 5.7, cirrus: .5, puffs: .4,
    auto: { overcast: p => 1 - smooth(.6, .78, p), rain: p => smooth(.3, .4, p) * (1 - smooth(.55, .63, p)), rainbow: p => smooth(.66, .72, p) * (1 - smooth(.82, .9, p)) } },
  starry: { frames: kf(STARRY), cover: .9, heroAz: .55, heroS: .07, seed: 1.9, cirrus: .25, puffs: .25, stars: 1.25, sunLow: -.1,
    auto: { milkyWay: p => smooth(.8, .97, p) } },
  moon: { frames: kf(MOON), cover: .45, heroAz: .62, heroS: .07, seed: 6.6, cirrus: .3, puffs: .2, stars: .85, moon: 1, sunHigh: -.12, sunLow: -.3 },
};
let preset = PRESETS.clear, presetName = 'clear';
const pal = {}; for (const k in BASE) pal[k] = typeof BASE[k] === 'string' ? new THREE.Color() : 0;
const grey = new THREE.Color();

function samplePal(p) {
  const F = preset.frames;
  let i = 0; while (i < F.length - 2 && p > F[i + 1][0]) i++;
  const [p0, a] = F[i], [p1, b] = F[i + 1]; const t = clamp((p - p0) / (p1 - p0), 0, 1);
  for (const k in a) { if (typeof a[k] === 'number') pal[k] = lerp(a[k], b[k], t); else pal[k].lerpColors(a[k], b[k], t); }
  return pal;
}

// fixed sky geometry: the Milky Way runs between Vega and Altair
const vega = new V3(-.35, .62, -1).normalize(), altair = new V3(.38, .5, -1).normalize();
const mwA = vega.clone().add(altair).normalize();
const mwN = altair.clone().sub(vega); mwN.sub(mwA.clone().multiplyScalar(mwN.dot(mwA))).normalize();
const mwB = new V3().crossVectors(mwN, mwA).normalize();
const dirAt = (az, el) => new V3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
{
  const u = skyMat.uniforms;
  u.uVega.value.copy(vega); u.uAltair.value.copy(altair);
  u.uMwN.value.copy(mwN); u.uMwA.value.copy(mwA); u.uMwB.value.copy(mwB); u.uRbC.value.copy(dirAt(-.06, -.6));
  u.uMwCol.value.set('#b8c6f4'); u.uMoonCol.value.set('#ffe9c4');
}

const cloudMat = toon(0xffffff); // kept for API compatibility; the clouds live in the sky shader now
const LEVELS = ['overcast', 'rain', 'fireflies', 'rainbow', 'milkyWay', 'starPair', 'shimmer'];
const lv = {}, manual = {};
LEVELS.forEach(k => { lv[k] = 0; manual[k] = false; });
const DEV = { overcast: 'overcast', rain: 'rain', fireflies: 'fireflies', rainbow: 'rainbow', milky: 'milkyWay', pair: 'starPair', shimmer: 'shimmer' };
let drift = 0, flashT = 0, lastRain = -1;
const moonDir = new V3(), lightDir = new V3();

export const sky = {
  lights: { key, hemi, rim, lantern, lanterns },
  clouds: [], cloudMat, skyMat, dome,
  sunDir: new V3(),
  moonDir,
  night: 0,
  tier,
  stars: { vega, altair },
  toScene,
  // per-frame look for post.js
  look: { bloomS: .12, bloomT: 2.4, vig: .16, warm: .04, cool: .05, sat: 1.04, grain: tier === 'low' ? 0 : .018, flash: 0 },
  get preset() { return presetName; },
  setPreset(name) {
    presetName = name in PRESETS ? name : 'clear'; preset = PRESETS[presetName];
    LEVELS.forEach(k => { lv[k] = 0; manual[k] = false; });
    const u = skyMat.uniforms;
    u.uCover.value = preset.cover; u.uHeroAz.value = preset.heroAz; u.uHeroS.value = preset.heroS; u.uSeed.value = preset.seed;
    u.uCirrus.value = preset.cirrus; u.uPuffs.value = preset.puffs;
  },
  flash(col, amt = 1) { G.flash = amt; G.flashCol = (G.flashCol || new THREE.Color()).copy(col); },
  // a lightning flash in the clouds; thunder follows a moment later
  lightning(strength = 1) {
    flashT = strength;
    audio.sfx('thunder', { delay: rand(.7, 2.2), strength });
  },
  setDetail(high) { skyMat.uniforms.uDetail.value = high ? 1 : 0; },

  update(dt, p) {
    const u = skyMat.uniforms;
    // weather levels: chapter-set values win; otherwise the preset's curves; dev params override both
    for (const k of LEVELS) if (!manual[k]) lv[k] = preset.auto?.[k] ? clamp(preset.auto[k](p), 0, 1) : 0;
    for (const [param, k] of Object.entries(DEV)) if (G.dev.has(param)) lv[k] = clamp(+G.dev.get(param) || 0, 0, 1);
    const o = lv.overcast, rain = lv.rain;

    const Pl = samplePal(p);
    if (o > 0) {
      Pl.keyI *= 1 - .45 * o; Pl.rimI *= 1 - .8 * o; Pl.sunI *= 1 - .92 * o; Pl.hazeAmt = lerp(Pl.hazeAmt, .95, o);
      grey.copy(Pl.ocL); Pl.haze.lerp(grey, .55 * o); Pl.hs.lerp(grey, .4 * o); Pl.fogFar *= 1 - .15 * o;
      Pl.sat *= 1 - .12 * o; Pl.warm *= 1 - .7 * o;
    }
    if (rain > 0) { Pl.keyI *= 1 - .22 * rain; Pl.fogFar *= 1 - .15 * rain; Pl.vig += .06 * rain; }

    u.uTop.value.copy(Pl.top); u.uHor.value.copy(Pl.hor); u.uBot.value.copy(Pl.bot); u.uHaze.value.copy(Pl.haze);
    u.uSun.value.copy(Pl.sun); u.uLit.value.copy(Pl.lit); u.uShade.value.copy(Pl.shade); u.uBase.value.copy(Pl.base);
    u.uOcD.value.copy(Pl.ocD); u.uOcL.value.copy(Pl.ocL); u.uCityGlow.value.copy(Pl.cityGlow);
    u.uSunI.value = Pl.sunI; u.uHazeAmt.value = Pl.hazeAmt; u.uCover.value = preset.cover * Pl.coverK; u.uExpK.value = renderer.toneMappingExposure / .6;

    const el = lerp(preset.sunHigh ?? .42, preset.sunLow ?? -.06, p);
    const sd = sky.sunDir.set(.45, Math.sin(el), -1).normalize();
    u.uSunDir.value.copy(sd);
    u.uSunset.value = smooth(.35, .7, p) * (1 - smooth(.9, 1, p));
    const night = sky.night = smooth(.78, 1, p);
    const moonOn = preset.moon ?? 0;
    moonDir.copy(dirAt(-.2, lerp(.055, .1, p)));
    u.uMoonDir.value.copy(moonDir);
    u.uMoon.value = moonOn * (1 - o * .9);
    u.uNight.value = Math.max(night, moonOn * .8);
    u.uStars.value = Math.max(night, moonOn * smooth(0, .4, p)) * (preset.stars ?? 1) * (1 - o);
    u.uMilky.value = lv.milkyWay * (1 - o); u.uPair.value = lv.starPair;
    u.uOvercast.value = o; u.uRain.value = rain; u.uRainbow.value = lv.rainbow;
    // clouds take their light from the moon on a moonlit night, else from the sun (even below the horizon)
    lightDir.copy(moonOn && sd.y < 0 ? moonDir : sd);
    u.uLightAz.value = Math.atan2(lightDir.x, -lightDir.z); u.uLightEl.value = Math.asin(lightDir.y);
    drift += dt * .0006 * (.5 + (world.wind || .5));
    u.uDrift.value = drift; u.uTime.value = G.time;
    flashT = Math.max(0, flashT - dt * 4.5);
    const flick = flashT > 0 ? flashT * (.6 + .4 * Math.sin(G.time * 70)) : 0;
    u.uFlash.value = flick;
    dome.position.copy(camera.position);

    // scene lighting
    toScene(Pl.haze, scene.fog.color); scene.fog.near = Pl.fogNear; scene.fog.far = Pl.fogFar;
    key.color.copy(Pl.key); key.intensity = Pl.keyI;
    if (moonOn && sd.y < 0) { rim.color.copy(u.uMoonCol.value); rim.position.copy(moonDir).multiplyScalar(30); }
    else { rim.color.copy(Pl.sun); rim.position.copy(sd).multiplyScalar(30); }
    rim.intensity = Pl.rimI;
    hemi.color.copy(Pl.hs); hemi.groundColor.copy(Pl.hg); hemi.intensity = Pl.hI + (G.flash || 0) * .5 + flick * .8;
    const c = world.cityMat;
    c.color.copy(Pl.city);
    c.emissiveIntensity = Math.max(smooth(.62, .95, p), moonOn) * Pl.cityLit * (1 - .3 * o);
    const glow = Math.max(smooth(.6, .95, p), moonOn);
    world.lanternMats.forEach(m => m.emissiveIntensity = .05 + glow * .8);
    const li = smooth(.65, 1, Math.max(p, moonOn)) * (lanterns.length > 1 ? 9 : 14);
    for (const l of lanterns) {
      l.intensity = li;
      if (G.flash > 0) { l.color.copy(G.flashCol); l.intensity += G.flash * (lanterns.length > 1 ? 12 : 20); }
      else l.color.set(0xffa860);
    }
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 3);

    const L = sky.look;
    L.bloomS = Pl.bloomS; L.bloomT = Pl.bloomT; L.vig = Pl.vig; L.warm = Pl.warm; L.cool = Pl.cool; L.sat = Pl.sat; L.flash = flick;

    weather.update(dt, sky, lv);
    if (Math.abs(rain - lastRain) > .01) { lastRain = rain; audio.loop('rain', rain); audio.setAmbience({ rain }); }
  },
};

// weather levels: assigning one marks it as chapter-controlled until the next setPreset
for (const k of LEVELS) Object.defineProperty(sky, k, { get: () => lv[k], set: v => { lv[k] = clamp(+v || 0, 0, 1); manual[k] = true; }, enumerable: true });
sky.setPreset('clear');
weather.init(sky);
