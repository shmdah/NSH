import * as THREE from "three";
import { Theme } from "../data/Theme.js";

/**
 * Supplier kiosk where the player buys flour, beans and oil.
 */
export class Supplier {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();

    this.group = new THREE.Group();
    this.group.name = "supplier";
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    this._buildMesh();
  }

  _buildMesh() {
    const woodMat = new THREE.MeshStandardMaterial({ color: Theme.stallWood, roughness: 0.9 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: Theme.stallWoodDark, roughness: 0.9 });
    const awningMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.75 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.0), woodMat);
    base.position.y = 0.9;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.8), darkWoodMat);
    counter.position.set(0, 1.15, 1.1);
    counter.castShadow = true;
    this.group.add(counter);

    // Green awning.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 2.5), awningMat);
    roof.position.y = 2.25;
    roof.rotation.x = 0.06;
    roof.castShadow = true;
    this.group.add(roof);

    for (const x of [-1.35, 1.35]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8),
        new THREE.MeshStandardMaterial({ color: Theme.stallMetal, metalness: 0.6, roughness: 0.4 }),
      );
      pole.position.set(x, 1.15, 1.28);
      pole.castShadow = true;
      this.group.add(pole);
    }

    // Service window.
    const windowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x0d1114, roughness: 0.9 }),
    );
    windowMesh.position.set(0, 1.42, 1.01);
    this.group.add(windowMesh);

    // Signboard.
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.42, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x174d2c }),
    );
    sign.position.set(0, 2.48, 1.2);
    this.group.add(sign);

    const signStripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.02), whiteMat);
    signStripe.position.set(0, 2.5, 1.25);
    this.group.add(signStripe);

    // Vendor behind the counter.
    const vendor = new THREE.Group();
    vendor.position.set(0, 1.0, -0.35);

    const skinMat = new THREE.MeshStandardMaterial({ color: Theme.skin });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });

    const vendorHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
    vendorHead.position.y = 0.72;
    vendorHead.castShadow = true;
    vendor.add(vendorHead);

    const vendorTorso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), shirtMat);
    vendorTorso.position.y = 0.1;
    vendorTorso.castShadow = true;
    vendor.add(vendorTorso);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const x of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeMat);
      eye.position.set(x, 0.77, 0.21);
      vendor.add(eye);
    }
    this.group.add(vendor);

    // Crates next to the kiosk.
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1 });
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), crateMat);
      crate.position.set(-1.6 + i * 0.55, 0.18 + (i % 2) * 0.36, 1.1);
      crate.castShadow = true;
      this.group.add(crate);
    }
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
