// Post-processing. Bloom makes lanterns, sparklers and fireworks glow.
import { THREE, renderer, scene, camera, onResize } from './gfx.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { G } from './state.js';

let composer = null, bloom = null;
export const post = {
  enabled: true,
  init() {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .3, .45, 1.05);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      onResize((w, h) => { composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); });
      composer.setSize(innerWidth, innerHeight);
    } catch (e) { console.warn('post disabled', e); composer = null; }
  },
  render() {
    if (composer && post.enabled) {
      // more glow as night falls
      bloom.strength = .05 + Math.pow(G.phase, 2) * .45;
      bloom.threshold = 1.05 - G.phase * .2;
      composer.render();
    } else renderer.render(scene, camera);
  },
};
