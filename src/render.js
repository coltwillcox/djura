import * as THREE from 'three';
import { MD_LEVELS } from './palette.js';

// Renderuje scenu u nisku rezoluciju (kao Mega Drive, 224 linije), pa
// fullscreen šejderom kvantizuje boje na 9-bitnu paletu uz Bayer dithering.
const BASE_H = 224;

const postVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const postFrag = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uLevels[8];
uniform float uFlash;
varying vec2 vUv;

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0 - 0.5;
}

float quant(float v, float d) {
  // pozicija između nelinearnih DAC nivoa (0..7), dither, pa zaokruživanje.
  // Tačna boja palete pada tačno na nivo i dither je ne pomera.
  float f = 7.0;
  for (int k = 0; k < 7; k++) {
    if (v <= uLevels[k + 1]) {
      f = float(k) + clamp((v - uLevels[k]) / (uLevels[k + 1] - uLevels[k]), 0.0, 1.0);
      break;
    }
  }
  int idx = int(clamp(floor(f + d * 0.9 + 0.5), 0.0, 7.0));
  return uLevels[idx];
}

void main() {
  vec3 lin = texture2D(tScene, vUv).rgb;
  // linearno -> sRGB, pa tek onda kvantizacija
  vec3 c = mix(lin * 12.92, 1.055 * pow(max(lin, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
  c = mix(c, vec3(1.0), uFlash);
  float d = bayer4(floor(vUv * uRes));
  gl_FragColor = vec4(quant(c.r, d), quant(c.g, d), quant(c.b, d), 1.0);
}
`;

export class RetroRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;

    this.target = new THREE.WebGLRenderTarget(320, BASE_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      type: THREE.HalfFloatType,
    });

    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(320, BASE_H) },
        uLevels: { value: MD_LEVELS.map((v) => v / 255) },
        uFlash: { value: 0 },
      },
      vertexShader: postVert,
      fragmentShader: postFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));

    this.width = 320;
    this.height = BASE_H;
    this.flash = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const aspect = window.innerWidth / window.innerHeight;
    // širina prati odnos ekrana, ali ostaje u "konzolnom" opsegu
    const w = Math.round(Math.min(Math.max(BASE_H * aspect, 256), 420) / 2) * 2;
    this.width = w;
    this.height = BASE_H;
    this.gl.setSize(w, BASE_H, false);
    this.target.setSize(w, BASE_H);
    this.postMat.uniforms.uRes.value.set(w, BASE_H);

    // celobrojno skaliranje kad može, inače najveće koje staje
    const scale = Math.min(window.innerWidth / w, window.innerHeight / BASE_H);
    const s = scale >= 2 ? Math.floor(scale) : scale;
    const cssW = Math.floor(w * s);
    const cssH = Math.floor(BASE_H * s);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    document.documentElement.style.setProperty('--game-w', cssW + 'px');
    document.documentElement.style.setProperty('--game-h', cssH + 'px');
    document.documentElement.style.setProperty('--px', s.toFixed(3));
    this.onResize?.(w / BASE_H);
  }

  render(scene, camera, dt) {
    this.flash = Math.max(0, this.flash - dt * 3);
    this.postMat.uniforms.uFlash.value = this.flash;
    this.gl.setRenderTarget(this.target);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCam);
  }
}
