// Ink: colored line art like the film's. A normal + inverse-depth prepass feeds a full-screen
// pass that darkens the color on the near side of every depth break and crease, using a deeper
// shade of whatever it outlines (orange gets a red-brown line, blue gets navy).
// Skipped: transparent / no-depth / alpha-cut materials, ShaderMaterials, lines, points, sprites,
// and anything with userData.noInk (on the object or its material).
import { THREE, scene, camera } from './gfx.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const ndMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: /* glsl */`
    #include <common>
    #include <morphtarget_pars_vertex>
    #include <skinning_pars_vertex>
    varying vec3 vN; varying float vZ;
    void main(){
      #include <beginnormal_vertex>
      #include <morphnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>
      #include <begin_vertex>
      #include <morphtarget_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
      vN = transformedNormal; vZ = -mvPosition.z;
    }`,
  // alpha holds 1/depth, so a cleared pixel (alpha 0) is infinitely far away
  fragmentShader: /* glsl */`
    varying vec3 vN; varying float vZ;
    void main(){ vec3 n = normalize(vN) * (gl_FrontFacing ? 1. : -1.); gl_FragColor = vec4(n * .5 + .5, 1. / max(vZ, 1e-3)); }`,
});

const InkShader = {
  uniforms: {
    tDiffuse: { value: null }, tND: { value: null }, uTexel: { value: new THREE.Vector2() }, uPx: { value: 1.5 },
    uStrength: { value: .85 }, uFade: { value: new THREE.Vector2(26, 60) }, uInk: { value: new THREE.Color(.16, .08, .14) },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tND; uniform vec2 uTexel, uFade; uniform float uPx, uStrength; uniform vec3 uInk;
    varying vec2 vUv;
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      vec4 c = texture2D(tND, vUv);
      if (c.a <= 0.) { gl_FragColor = col; return; }
      vec2 ox = vec2(uTexel.x * uPx, 0.), oy = vec2(0., uTexel.y * uPx);
      vec4 l = texture2D(tND, vUv - ox), r = texture2D(tND, vUv + ox), d = texture2D(tND, vUv - oy), u = texture2D(tND, vUv + oy);
      // 1/z is linear across a plane in screen space, so its Laplacian is ~0 on surfaces and
      // strongly negative only on the near side of a silhouette
      float lap = (l.a + r.a - 2. * c.a) + (d.a + u.a - 2. * c.a);
      float depthE = smoothstep(.035, .09, -lap / c.a);
      vec3 n = c.rgb * 2. - 1.;
      float crease = max(1. - dot(n, l.rgb * 2. - 1.), 1. - dot(n, d.rgb * 2. - 1.));
      // a crease only counts where the neighbour is the same surface depth-wise (else it's a silhouette)
      float creaseE = smoothstep(.3, .55, crease) * step(abs(l.a - c.a) + abs(d.a - c.a), c.a * .08);
      float e = max(depthE, creaseE * .8);
      float fade = 1. - smoothstep(uFade.x, uFade.y, 1. / c.a);
      vec3 base = clamp(col.rgb, 0., 1.);
      vec3 line = mix(base * base * .45, uInk * .35, .3);
      gl_FragColor = vec4(mix(col.rgb, line, e * fade * uStrength), col.a);
    }`,
};

const skipped = [];
function excluded(o) {
  if (o.userData.noInk) return true;
  if (o.isLine || o.isPoints || o.isSprite) return true;
  if (!o.isMesh) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return !m || m.isShaderMaterial || m.transparent || m.alphaTest > 0 || !m.depthWrite || !m.colorWrite || !m.visible || !!m.userData.noInk;
}
// layer 30 hides an object from this pass without hiding its children (visible=false would)
function hideSkipped() {
  scene.traverseVisible(o => { if (excluded(o)) { skipped.push(o, o.layers.mask); o.layers.mask = 1 << 30; } });
}
function restoreSkipped() {
  for (let i = 0; i < skipped.length; i += 2) skipped[i].layers.mask = skipped[i + 1];
  skipped.length = 0;
}

const _cc = new THREE.Color();
export class InkPass extends Pass {
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({ ...InkShader, uniforms: THREE.UniformsUtils.clone(InkShader.uniforms), depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.material);
    this.nd = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  }
  setSize(w, h) {
    this.nd.setSize(w, h);
    this.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.material.uniforms.uPx.value = Math.max(1, 1.6 * h / 1080);
  }
  render(r, writeBuffer, readBuffer) {
    const autoShadow = r.shadowMap.autoUpdate, bg = scene.background, alpha = r.getClearAlpha();
    r.getClearColor(_cc);
    hideSkipped();
    r.shadowMap.autoUpdate = false; scene.overrideMaterial = ndMat; scene.background = null;
    r.setRenderTarget(this.nd); r.setClearColor(0x8080ff, 0); r.clear(); r.render(scene, camera);
    scene.overrideMaterial = null; scene.background = bg; r.shadowMap.autoUpdate = autoShadow; r.setClearColor(_cc, alpha);
    restoreSkipped();

    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture; u.tND.value = this.nd.texture;
    r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(r);
  }
  dispose() { this.nd.dispose(); this.material.dispose(); this.quad.dispose(); }
}
