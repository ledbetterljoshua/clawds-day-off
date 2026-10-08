// Post-processing: scene → (optional cutscene depth of field) → bloom → one final pass that
// tone-maps (ACES, same curve the renderer uses), grades (cool shadows, warm highlights),
// vignettes and adds a little grain. The per-phase look comes from sky.look.
import { THREE, renderer, scene, camera, onResize } from './gfx.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { G } from './state.js';
import { sky } from './sky.js';
import { InkPass } from './ink.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uExposure: { value: 1 }, uTime: { value: 0 }, uVig: { value: .2 }, uGrain: { value: .018 },
    uWarm: { value: .05 }, uCool: { value: .05 }, uSat: { value: 1.04 }, uCA: { value: .003 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uExposure, uTime, uVig, uGrain, uWarm, uCool, uSat, uCA; uniform vec2 uRes;
    varying vec2 vUv;
    vec3 pRRT(vec3 v){ vec3 a = v * (v + .0245786) - .000090537; vec3 b = v * (.983729 * v + .4329510) + .238081; return a / b; }
    vec3 pAces(vec3 c){
      const mat3 inM = mat3(vec3(.59719, .07600, .02840), vec3(.35458, .90834, .13383), vec3(.04823, .01566, .83777));
      const mat3 outM = mat3(vec3(1.60475, -.10208, -.00327), vec3(-.53108, 1.10813, -.07276), vec3(-.07367, -.00605, 1.07602));
      c *= uExposure / .6; c = inM * c; c = pRRT(c); c = outM * c; return clamp(c, 0., 1.);
    }
    vec3 pSRGB(vec3 c){ return mix(pow(c, vec3(.41666)) * 1.055 - .055, c * 12.92, vec3(lessThanEqual(c, vec3(.0031308)))); }
    float pHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      // a touch of lateral chromatic aberration toward the frame edges, like a real lens
      vec2 ca = (vUv - .5) * uCA;
      vec3 src = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
      vec3 c = pSRGB(pAces(src));
      float l = dot(c, vec3(.299, .587, .114));
      c += vec3(-.03, .0, .07) * uCool * (1. - l) * (1. - l) * 2.;
      c += vec3(.07, .03, -.045) * uWarm * l * l * 2.;
      c = mix(vec3(l), c, uSat);
      vec2 q = (vUv - .5) * vec2(uRes.x / uRes.y, 1.) * .9;
      c *= mix(1. - uVig, 1., smoothstep(.95, .25, length(q)));
      c += (pHash(vUv * uRes + fract(uTime * 13.7) * 311.) - .5) * uGrain;
      gl_FragColor = vec4(c, 1.);
    }`,
};

class FinalPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.material = new THREE.ShaderMaterial({ ...FinalShader, uniforms: THREE.UniformsUtils.clone(FinalShader.uniforms), depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.material);
  }
  render(r, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(r);
  }
}

let composer = null, ink = null, bloom = null, bokeh = null, final = null, tier = sky.tier, dofOn = false;
const frameTimes = []; let lastT = 0, watched = false;
const GLOW = { s: .04, t: .8, r: .65 };

function makeTarget() {
  const pr = renderer.getPixelRatio(), w = Math.max(1, Math.floor(innerWidth * pr)), h = Math.max(1, Math.floor(innerHeight * pr));
  return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: tier === 'low' ? 0 : pr >= 2 ? 2 : 4 });
}
function build() {
  composer?.dispose?.(); ink?.dispose(); bloom?.dispose?.(); bokeh?.dispose?.(); final?.material.dispose();
  composer = new EffectComposer(renderer, makeTarget());
  composer.addPass(new RenderPass(scene, camera));
  ink = new InkPass();
  ink.enabled = post.ink;
  composer.addPass(ink);
  bokeh = new BokehPass(scene, camera, { focus: 10, aperture: .002, maxblur: .008 });
  bokeh.enabled = dofOn && tier !== 'low';
  composer.addPass(bokeh);
  const div = tier === 'low' ? 4 : 2;
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / div, innerHeight / div), .2, .5, 1.4);
  composer.addPass(bloom);
  final = new FinalPass();
  composer.addPass(final);
  composer.setSize(innerWidth, innerHeight);
}

export const post = {
  enabled: true,
  ink: !G.dev.has('noink'),
  get quality() { return tier; },
  set quality(q) {
    if (q !== 'low' && q !== 'high') return;
    tier = q; sky.tier = q;
    renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 1.5 : 2));
    sky.setDetail(q === 'high');
    sky.look.grain = q === 'low' ? 0 : .018;
    if (composer) build();
  },
  // cutscene depth of field: post.dof({ focus: distance, aperture, maxblur }) or post.dof(null)
  dof(o) {
    dofOn = !!o;
    if (!bokeh) return;
    bokeh.enabled = dofOn && tier !== 'low';
    if (o) {
      const u = bokeh.uniforms;
      if (o.focus != null) u.focus.value = o.focus;
      if (o.aperture != null) u.aperture.value = o.aperture;
      if (o.maxblur != null) u.maxblur.value = o.maxblur;
    }
  },
  init() {
    try {
      if (tier === 'low') renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      if (tier === 'low') sky.setDetail(false);
      build();
      onResize((w, h) => { if (!composer) return; composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); });
    } catch (e) { console.warn('post disabled', e); composer = null; }
  },
  render() {
    if (!composer || !post.enabled) { renderer.render(scene, camera); return; }
    const L = sky.look, u = final.material.uniforms;
    ink.enabled = post.ink;
    // a soft diffusion glow over the bright parts of the frame, the way anime compositing adds it
    bloom.strength = L.bloomS + GLOW.s + L.flash * .4; bloom.threshold = L.bloomT * GLOW.t; bloom.radius = GLOW.r;
    u.uExposure.value = renderer.toneMappingExposure;
    u.uVig.value = L.vig; u.uWarm.value = L.warm; u.uCool.value = L.cool; u.uSat.value = L.sat;
    u.uGrain.value = L.grain; u.uTime.value = G.time;
    u.uRes.value.set(innerWidth, innerHeight);
    composer.render();
    watch();
  },
};

// if high quality can't hold ~40fps on this device, drop to low once
function watch() {
  const now = performance.now(), dt = now - lastT; lastT = now;
  if (watched || tier === 'low' || document.visibilityState !== 'visible' || dt <= 0 || dt > 250) return;
  frameTimes.push(dt);
  if (frameTimes.length < 180) return;
  const s = frameTimes.slice().sort((a, b) => a - b), med = s[s.length >> 1];
  frameTimes.length = 0;
  if (med > 26) { watched = true; console.info(`post: median frame ${med.toFixed(1)}ms, switching to low quality`); post.quality = 'low'; }
}
