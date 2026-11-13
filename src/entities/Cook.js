import * as THREE from "three";
import { Theme } from "../data/Theme.js";

/**
 * A cook who stands on top of the caravan roof.
 *
 * The system starts a 2-second wrap animation; the Cook itself only owns the
 * visual side of that animation. Food appears/disappears on the little prep
 * counter in front of the cook.
 */
export class Cook {
  constructor(scene, position, index = 0) {
    this.scene = scene;
    this.index = index;
    this.position = position.clone();
    this.group = new THREE.Group();
    this.group.name = `cook-${index}`;
    this.group.position.copy(this.position);
    this.group.rotation.y = Math.PI / 2; // face the road (+X)
    this.scene.add(this.group);

    this.visualGroup = new THREE.Group();
    this.group.add(this.visualGroup);

    this.isWrapping = false;
    this.wrapTimer = 0;
    this.wrapDuration = 2;
    this.hasCounterFood = false;
    this.foodBox = null;
    this.leftArm = null;
    this.rightArm = null;
    this._elapsed = 0;

    this._buildMesh();
  }

  _buildMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: Theme.skin });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.9 });
    const apronMat = new THREE.MeshStandardMaterial({ color: 0xe9e2d0, roughness: 0.95 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: Theme.pants });
    const hatMat = new THREE.MeshStandardMaterial({ color: Theme.chefHat, roughness: 0.9 });
    const counterMat = new THREE.MeshStandardMaterial({ color: Theme.stallCounter, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: Theme.metal, roughness: 0.6, metalness: 0.5 });

    // Little prep counter (the "counter" the cook works at).
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.55), counterMat);
    counter.position.set(0, 0.72, 0.62);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.visualGroup.add(counter);

    for (const x of [-0.4, 0.4]) {
      for (const z of [0.42, 0.82]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), metalMat);
        leg.position.set(x, 0.36, z);
        leg.castShadow = true;
        this.visualGroup.add(leg);
      }
    }

    // Legs.
    this._addBox(pantsMat, 0.3, 0.6, 0.3, -0.2, 0.3, 0);
    this._addBox(pantsMat, 0.3, 0.6, 0.3, 0.2, 0.3, 0);

    // Torso, apron, head, hat.
    this._addBox(shirtMat, 0.8, 1.0, 0.42, 0, 1.1, 0);
    const apron = this._addBox(apronMat, 0.52, 0.72, 0.06, 0, 0.98, 0.24);
    apron.castShadow = true;
    this._addBox(skinMat, 0.2, 0.14, 0.2, 0, 1.66, 0);
    this._addBox(skinMat, 0.5, 0.5, 0.5, 0, 1.9, 0);

    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.26, 14), hatMat);
    hatBase.position.set(0, 2.24, 0);
    hatBase.castShadow = true;
    this.visualGroup.add(hatBase);

    const hatPuff = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 10), hatMat);
    hatPuff.position.set(0, 2.42, 0);
    hatPuff.scale.y = 0.75;
    hatPuff.castShadow = true;
    this.visualGroup.add(hatPuff);

    // Face.
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const x of [-0.12, 0.12]) {
      this._addBox(blackMat, 0.07, 0.07, 0.02, x, 1.95, 0.255);
    }
    this._addBox(blackMat, 0.14, 0.02, 0.02, 0, 1.8, 0.255);

    // Articulated arms.
    this.leftArm = this._addArm(shirtMat, -0.55, 1.5, 0.25, 0.9, 0.25);
    this.rightArm = this._addArm(shirtMat, 0.55, 1.5, 0.25, 0.9, 0.25);

    this.leftArm.rotation.x = -0.55;
    this.rightArm.rotation.x = -0.55;

    // Food on the prep counter.
    this.foodBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.32),
      new THREE.MeshStandardMaterial({ color: Theme.food, roughness: 0.9 }),
    );
    this.foodBox.position.set(0, 0.86, 0.62);
    this.foodBox.castShadow = true;
    this.foodBox.visible = false;
    this.visualGroup.add(this.foodBox);
  }

  _addBox(material, width, height, depth, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.visualGroup.add(mesh);
    return mesh;
  }

  _addArm(material, x, y, width, height, depth) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.y = -height / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    this.visualGroup.add(pivot);
    return pivot;
  }

  playWrappingAnimation(duration = 2) {
    this.isWrapping = true;
    this.wrapTimer = duration;
    this.wrapDuration = duration;
    this.foodBox.visible = true;
  }

  setFoodOnCounter(available) {
    this.hasCounterFood = available;
    if (!this.isWrapping) this.foodBox.visible = available;
  }

  update(dt) {
    this._elapsed += dt;

    if (this.isWrapping) {
      this.wrapTimer -= dt;
      const progress = 1 - Math.max(0, this.wrapTimer) / this.wrapDuration;
      const swing = Math.sin(progress * Math.PI * 8) * 0.75;
      this.leftArm.rotation.x = -0.55 + swing;
      this.rightArm.rotation.x = -0.55 - swing;
      this.foodBox.rotation.y += dt * 6;

      if (this.wrapTimer <= 0) {
        this.isWrapping = false;
        this.leftArm.rotation.x = -0.55;
        this.rightArm.rotation.x = -0.55;
        this.foodBox.visible = this.hasCounterFood;
      }
      return;
    }

    // Idle: small breathing bob + gentle arm sway.
    const idle = Math.sin(this._elapsed * 2) * 0.05;
    this.visualGroup.position.y = idle * 0.4;
    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -0.55 + idle, 0.12);
    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.55 - idle, 0.12);
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
