import * as THREE from "three";
import { Theme } from "../data/Theme.js";

/**
 * Waiter NPC. Movement, collision and animation live here; the decision
 * making (counter → customer, cars first, stuck prevention) lives in
 * systems/WaiterSystem.js.
 */
export class Waiter {
  constructor(scene, world, startPosition, index = 0) {
    this.scene = scene;
    this.world = world;
    this.index = index;
    this.position = startPosition.clone();
    this.targetPosition = startPosition.clone();
    this.walkSpeed = 3.3;
    this.rushSpeed = 5.8;
    this.currentSpeed = this.walkSpeed;
    this.isRushing = false;
    this.hasFood = false;
    this.carriedRecipeId = null;
    this.isMoving = false;
    this.walkTime = 0;

    // Stuck detection is shared with the system.
    this.stuckTimer = 0;
    this._lastPosition = this.position.clone();

    this._direction = new THREE.Vector3();
    this._collisionBox = new THREE.Box3();
    this._collisionCenter = new THREE.Vector3();
    this._collisionSize = new THREE.Vector3(0.7, 1.7, 0.7);

    this.group = new THREE.Group();
    this.group.name = `waiter-${index}`;
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    this.visualGroup = new THREE.Group();
    this.group.add(this.visualGroup);

    this.leftArm = null;
    this.rightArm = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this.carriedFoodMesh = null;
    this.tray = null;

    this._buildMesh();
  }

  _buildMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: Theme.skin });
    const shirtMat = new THREE.MeshStandardMaterial({ color: Theme.waiterShirt });
    const pantsMat = new THREE.MeshStandardMaterial({ color: Theme.pants });
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.6, roughness: 0.35 });
    const foodMat = new THREE.MeshStandardMaterial({ color: Theme.food });

    this._addBox(shirtMat, 0.8, 1.0, 0.42, 0, 1.1, 0);
    this._addBox(skinMat, 0.2, 0.14, 0.2, 0, 1.66, 0);
    this._addBox(skinMat, 0.5, 0.5, 0.5, 0, 1.9, 0);

    // Bow tie.
    this._addBox(new THREE.MeshStandardMaterial({ color: 0x111111 }), 0.22, 0.1, 0.06, 0, 1.58, 0.24);

    // Face.
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const x of [-0.12, 0.12]) {
      this._addBox(blackMat, 0.07, 0.07, 0.02, x, 1.95, 0.255);
    }
    this._addBox(blackMat, 0.13, 0.02, 0.02, 0, 1.8, 0.255);

    this.leftArm = this._addPivotedLimb(shirtMat, -0.55, 1.5, 0.25, 0.9, 0.25);
    this.rightArm = this._addPivotedLimb(shirtMat, 0.55, 1.5, 0.25, 0.9, 0.25);
    this.leftLeg = this._addPivotedLimb(pantsMat, -0.2, 0.6, 0.3, 0.6, 0.3);
    this.rightLeg = this._addPivotedLimb(pantsMat, 0.2, 0.6, 0.3, 0.6, 0.3);

    // Tray held in the left hand.
    this.tray = this._addBox(trayMat, 0.55, 0.05, 0.42, -0.72, 1.28, 0.28);
    this.carriedFoodMesh = this._addBox(foodMat, 0.3, 0.16, 0.3, -0.72, 1.39, 0.28);
    this.carriedFoodMesh.visible = false;
  }

  _addBox(material, width, height, depth, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.visualGroup.add(mesh);
    return mesh;
  }

  _addPivotedLimb(material, x, y, width, height, depth) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.y = -height / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    this.visualGroup.add(pivot);
    return pivot;
  }

  setRushing(rushing) {
    this.isRushing = rushing;
    this.currentSpeed = rushing ? this.rushSpeed : this.walkSpeed;
  }

  moveTo(target) {
    this.targetPosition.set(target.x, this.position.y, target.z);
    this.isMoving = true;
  }

  stop() {
    this.isMoving = false;
  }

  teleport(position) {
    this.position.copy(position);
    this.group.position.copy(this.position);
    this._lastPosition.copy(this.position);
    this.stuckTimer = 0;
  }

  distanceTo(position) {
    const dx = position.x - this.position.x;
    const dz = position.z - this.position.z;
    return Math.hypot(dx, dz);
  }

  showFood(recipeId = "chapatiBeans") {
    this.hasFood = true;
    this.carriedRecipeId = recipeId;
    this.carriedFoodMesh.visible = true;
  }

  hideFood() {
    this.hasFood = false;
    this.carriedRecipeId = null;
    this.carriedFoodMesh.visible = false;
  }

  update(dt) {
    this._direction.subVectors(this.targetPosition, this.position);
    this._direction.y = 0;
    const distance = this._direction.length();

    if (this.isMoving && distance > 0.08) {
      this._direction.normalize();
      const step = Math.min(this.currentSpeed * dt, distance);
      this._tryMoveAxis("x", this.position.x + this._direction.x * step);
      this._tryMoveAxis("z", this.position.z + this._direction.z * step);

      const targetAngle = Math.atan2(this._direction.x, this._direction.z);
      this.group.rotation.y = targetAngle;

      this.walkTime += dt * (this.isRushing ? 18 : 11);

      // Track progress for the system's stuck fallback.
      const moved = this.position.distanceTo(this._lastPosition);
      this._lastPosition.copy(this.position);
      if (moved < 0.002) {
        this.stuckTimer += dt;
      } else {
        this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
      }
    } else {
      this.isMoving = false;
      this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    }

    const targetTilt = this.isRushing && this.isMoving ? 0.22 : 0;
    this.visualGroup.rotation.x = THREE.MathUtils.lerp(
      this.visualGroup.rotation.x,
      targetTilt,
      Math.min(1, 10 * dt),
    );

    if (this.isMoving) {
      const swingAmount = this.isRushing ? 1.15 : 0.7;
      const swing = Math.sin(this.walkTime) * swingAmount;
      this.leftArm.rotation.x = swing - 0.25;
      this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing;
      this.rightLeg.rotation.x = swing;
    } else {
      const blend = Math.min(1, 10 * dt);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, blend);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, blend);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, blend);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, blend);
    }

    this.group.position.copy(this.position);
  }

  _tryMoveAxis(axis, value) {
    const previous = this.position[axis];
    this.position[axis] = value;
    this._collisionCenter.set(this.position.x, this.position.y + 0.85, this.position.z);
    this._collisionBox.setFromCenterAndSize(this._collisionCenter, this._collisionSize);

    for (const box of this.world.collisionBoxes) {
      if (this._collisionBox.intersectsBox(box)) {
        this.position[axis] = previous;
        return false;
      }
    }
    return true;
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
