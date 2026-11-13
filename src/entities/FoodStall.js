import * as THREE from "three";
import { Theme } from "../data/Theme.js";

/**
 * The starting food stall (before the caravan upgrade).
 * The group is placed on the left-hand pavement and faces the road (+X).
 */
export class FoodStall {
  constructor(position = new THREE.Vector3(-6, 0.2, 0)) {
    this.group = new THREE.Group();
    this.group.name = "food-stall";
    this.group.position.copy(position);
    this.group.rotation.y = Math.PI / 2;

    this._buildCounter();
    this._buildUmbrella();
    this._buildPots();
    this._buildMenuBoard();
  }

  _mat(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  }

  _buildCounter() {
    const wood = this._mat(Theme.stallWood);
    const dark = this._mat(Theme.stallWoodDark);

    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.2), wood);
    counter.position.y = 0.5;
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.group.add(counter);

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.35), dark);
    top.position.y = 1.03;
    top.castShadow = true;
    top.receiveShadow = true;
    this.group.add(top);

    // Front cloth.
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 0.75, 0.06),
      this._mat(Theme.stallCloth),
    );
    cloth.position.set(0, 0.55, 0.62);
    cloth.castShadow = true;
    this.group.add(cloth);
  }

  _buildUmbrella() {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: Theme.stallMetal, metalness: 0.6, roughness: 0.4 }),
    );
    pole.position.set(0, 1.25, -0.35);
    pole.castShadow = true;
    this.group.add(pole);

    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 0.6, 4),
      new THREE.MeshStandardMaterial({
        color: Theme.stallUmbrella,
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    top.position.set(0, 2.55, -0.35);
    top.rotation.y = Math.PI / 4;
    top.castShadow = true;
    this.group.add(top);
  }

  _buildPots() {
    const potMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.4, roughness: 0.6 });
    for (const [x, z] of [[-0.55, 0.1], [0.55, 0.1]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.34, 14), potMat);
      pot.position.set(x, 1.25, z);
      pot.castShadow = true;
      this.group.add(pot);
    }
  }

  _buildMenuBoard() {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.7, 0.08),
      this._mat(0x1b1b1b),
    );
    board.position.set(0.65, 1.75, 0.35);
    board.rotation.z = -0.08;
    board.castShadow = true;
    this.group.add(board);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.12, 0.02),
      this._mat(Theme.stallUmbrella),
    );
    stripe.position.set(0.65, 1.9, 0.4);
    this.group.add(stripe);
  }

  update() {}

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
