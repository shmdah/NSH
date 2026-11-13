import * as THREE from "three";
import { Theme } from "../data/Theme.js";

/**
 * The upgraded stall: a compact food caravan.
 *
 * Dimensions are ~30% smaller than the original build:
 *   body 2.4 x 1.6 x 3.2, roof 2.6 x 0.1 x 3.4.
 * The cook stands on the roof at world Y ≈ 2.0; there is no interior fire.
 */
export class Caravan {
  constructor(position = new THREE.Vector3(-6, 0.2, 0)) {
    this.group = new THREE.Group();
    this.group.name = "caravan-stall";
    this.group.position.copy(position);
    this.group.rotation.y = Math.PI / 2; // serve the road (front faces +X)

    this.roofWorldY = this.group.position.y + 1.8;
    this.windowWorldPosition = new THREE.Vector3(
      this.group.position.x + 1.6,
      this.group.position.y + 1.25,
      0,
    );

    this._buildMesh();
  }

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: Theme.caravanBody, roughness: 0.8 });
    const trimMat = new THREE.MeshStandardMaterial({ color: Theme.caravanTrim, roughness: 0.7 });
    const awningMat = new THREE.MeshStandardMaterial({ color: Theme.caravanAwning, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.9 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: Theme.caravanWheel, roughness: 1 });
    const counterMat = new THREE.MeshStandardMaterial({ color: Theme.stallCounter, roughness: 0.85 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x9fc4d8,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });

    // Body shell (2.4 wide, 1.6 tall, 3.2 deep; local Z is the 3.2 axis).
    this._addBox(bodyMat, 2.4, 1.6, 3.2, 0, 0.9, 0);

    // Slightly darker skirt.
    this._addBox(trimMat, 2.44, 0.18, 3.24, 0, 0.22, 0);

    // Roof platform (2.6 x 0.1 x 3.4) — its top is at local Y = 1.8.
    const roof = this._addBox(trimMat, 2.6, 0.1, 3.4, 0, 1.75, 0);
    roof.castShadow = true;
    roof.receiveShadow = true;

    // Low rail on the side away from the cooks, purely decorative.
    for (const x of [-1.24, 1.24]) {
      this._addBox(trimMat, 0.06, 0.24, 3.24, x, 1.92, 0);
    }
    this._addBox(trimMat, 2.54, 0.06, 0.06, 0, 1.92, -1.64);

    // Service window on the local +Z face (world +X after rotation).
    this._addBox(darkMat, 1.5, 0.82, 0.08, 0, 1.28, 1.61);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.68), glassMat);
    glass.position.set(0, 1.28, 1.66);
    this.group.add(glass);

    // Window frame.
    this._addBox(trimMat, 1.66, 0.09, 0.12, 0, 1.72, 1.66);
    this._addBox(trimMat, 1.66, 0.09, 0.12, 0, 0.84, 1.66);
    for (const x of [-0.8, 0.8]) {
      this._addBox(trimMat, 0.09, 0.96, 0.12, x, 1.28, 1.66);
    }

    // Serving sill / counter.
    const sill = this._addBox(counterMat, 2.1, 0.12, 0.55, 0, 0.76, 1.82);
    sill.castShadow = true;
    sill.receiveShadow = true;

    // Awning above the window.
    const awning = this._addBox(awningMat, 2.2, 0.08, 0.9, 0, 1.98, 1.95);
    awning.rotation.x = 0.18;
    awning.castShadow = true;

    // Awning support poles.
    for (const x of [-1.0, 1.0]) {
      this._addBox(trimMat, 0.05, 1.5, 0.05, x, 1.2, 2.32);
    }

    // Ladder on the back (local -Z face, world -X side).
    for (const x of [-0.32, 0.32]) {
      this._addBox(trimMat, 0.05, 1.85, 0.05, x, 0.95, -1.67);
    }
    for (let step = 0; step < 6; step++) {
      this._addBox(trimMat, 0.7, 0.05, 0.05, 0, 0.2 + step * 0.3, -1.67);
    }

    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16);
    for (const x of [-1.12, 1.12]) {
      for (const z of [-1.0, 1.0]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, 0.36, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        this.group.add(wheel);
      }
    }

    // Tow hitch.
    this._addBox(trimMat, 0.12, 0.12, 0.5, 0, 0.45, -1.8);
  }

  _addBox(material, width, height, depth, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  update() {
    // The caravan is static; the cooks animate on top of it.
  }

  dispose() {
    this.group.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        for (const material of object.material) material.dispose();
      } else {
        object.material.dispose();
      }
    });
    this.group.removeFromParent();
  }
}
