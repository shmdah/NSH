import * as THREE from "three";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x241c16);
    
    // Pushed the fog back to see the tall buildings
    this.scene.fog = new THREE.Fog(0x3a2c22, 34, 95);

    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize);
  }

  _onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
  }

  render(camera) {
    this.renderer.render(this.scene, camera);
  }

  dispose() {
    window.removeEventListener("resize", this._onResize);
    this.renderer.dispose();
  }
}