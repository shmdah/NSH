import * as THREE from "three";
import { bus } from "../systems/EventBus.js";
import { Theme } from "../data/Theme.js";

let nextCustomerId = 1;

/**
 * A walking OR drive-thru customer.
 *
 * State machine:
 *   WALKING → WAITING_FOR_ORDER → ORDER_TAKEN → EATING → LEAVING
 *
 * Drive-thru customers are created with `riding: true`; DriveThruSystem keeps
 * their group glued to the car window and calls update() so patience / eating
 * timers still tick.
 */
export class Customer {
  constructor(scene, world, type, options = {}) {
    this.scene = scene;
    this.world = world;
    this.type = type;
    this.id = `customer-${nextCustomerId++}`;
    this.orderRecipeId = options.orderRecipeId ?? "chapatiBeans";

    this.isRiding = Boolean(options.riding);
    this.isCarCustomer = this.isRiding;
    this.destroyed = false;

    const spawn = options.position ?? world.customerSpawnPoint ?? new THREE.Vector3(5.4, 0.2, -30);
    this.position = spawn.clone();
    this.spawnPosition = spawn.clone();
    this.exitPosition = (options.exit ?? world.customerExitPoint ?? new THREE.Vector3(5.2, 0.2, -40)).clone();
    this.walkTarget = (options.target ?? this.position).clone();
    this._hasWalkTarget = Boolean(options.target);

    this.state = this.isRiding ? "WAITING_FOR_ORDER" : "WALKING";
    this.maxPatience = type.patience ?? 28;
    this.patience = this.maxPatience;
    this.eatTimer = 0;
    this.leaveTimer = 0;

    this.speed = options.speed ?? 2.9;
    this.isMoving = false;
    this.walkTime = 0;

    this._moveDirection = new THREE.Vector3();
    this._collisionBox = new THREE.Box3();
    this._collisionCenter = new THREE.Vector3();
    this._collisionSize = new THREE.Vector3(0.7, 1.7, 0.7);
    this._indicatorElapsed = 0;

    this.group = new THREE.Group();
    this.group.name = this.id;
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    // Limb / face references, filled by _buildMesh().
    this.leftArm = null;
    this.rightArm = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this.indicator = null;
    this.indicatorMaterial = null;
    this.mouth = null;
    this.foodMesh = null;

    this._buildMesh();
    this._buildFoodMesh();

    if (this.isRiding) {
      this.group.scale.setScalar(0.8);
      this.setRidingPose();
    }
  }

  // -------------------------------------------------------------------------
  // Mesh
  // -------------------------------------------------------------------------
  _buildMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: this.type.skin ?? Theme.skin });
    const shirtMat = new THREE.MeshStandardMaterial({ color: this.type.shirt ?? this.type.color });
    const pantsMat = new THREE.MeshStandardMaterial({ color: Theme.pants });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const torso = this._addMesh(new THREE.BoxGeometry(0.8, 1.0, 0.4), shirtMat, 0, 1.1, 0);
    torso.castShadow = true;

    // Neck + head.
    this._addMesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), skinMat, 0, 1.66, 0);
    this._addMesh(new THREE.BoxGeometry(0.52, 0.52, 0.5), skinMat, 0, 1.9, 0);

    // Hair cap.
    this._addMesh(
      new THREE.BoxGeometry(0.56, 0.12, 0.54),
      new THREE.MeshStandardMaterial({ color: 0x241a12 }),
      0,
      2.19,
      -0.01,
    );

    // Eyes.
    const faceZ = 0.255;
    for (const x of [-0.13, 0.13]) {
      this._addMesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), whiteMat, x, 1.95, faceZ);
      this._addMesh(new THREE.BoxGeometry(0.045, 0.045, 0.03), blackMat, x, 1.95, faceZ + 0.012);
    }

    // Mouth.
    this.mouth = this._addMesh(new THREE.BoxGeometry(0.17, 0.025, 0.02), blackMat, 0, 1.78, faceZ);

    // Eyebrows.
    for (const x of [-0.13, 0.13]) {
      this._addMesh(new THREE.BoxGeometry(0.12, 0.025, 0.02), blackMat, x, 2.03, faceZ);
    }

    this.leftArm = this._addLimb(shirtMat, -0.55, 1.5, 0.25, 0.9, 0.25, 0.55);
    this.rightArm = this._addLimb(shirtMat, 0.55, 1.5, 0.25, 0.9, 0.25, -0.55);
    this.leftLeg = this._addLimb(pantsMat, -0.2, 0.6, 0.3, 0.6, 0.3, 0);
    this.rightLeg = this._addLimb(pantsMat, 0.2, 0.6, 0.3, 0.6, 0.3, 0);

    // Order indicator.
    this.indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.95,
    });
    this.indicator = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.44, 4),
      this.indicatorMaterial,
    );
    this.indicator.position.set(0, 2.62, 0);
    this.indicator.rotation.x = Math.PI;
    this.indicator.visible = false;
    this.group.add(this.indicator);
  }

  _buildFoodMesh() {
    this.foodMesh = new THREE.Group();
    this.foodMesh.visible = false;

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.28, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: Theme.plate }),
    );
    plate.position.set(0, 1.18, 0.46);
    this.foodMesh.add(plate);

    const chapati = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.035, 16),
      new THREE.MeshStandardMaterial({ color: Theme.chapati }),
    );
    chapati.position.set(0.05, 1.21, 0.46);
    this.foodMesh.add(chapati);

    const beans = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshStandardMaterial({ color: Theme.beans }),
    );
    beans.position.set(-0.1, 1.22, 0.45);
    this.foodMesh.add(beans);

    this.group.add(this.foodMesh);
  }

  _addMesh(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  _addLimb(material, x, y, width, height, depth, z = 0) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.y = -height / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    this.group.add(pivot);
    return pivot;
  }

  // -------------------------------------------------------------------------
  // State helpers
  // -------------------------------------------------------------------------
  setRidingPose() {
    this.isMoving = false;
    this.leftLeg.rotation.x = -1.35;
    this.rightLeg.rotation.x = -1.35;
    this.leftArm.rotation.x = -0.45;
    this.rightArm.rotation.x = -0.45;
    this._setFace("neutral");
  }

  _setFace(mood) {
    if (!this.mouth) return;
    if (mood === "happy") {
      this.mouth.scale.set(1.6, 1.4, 1);
      this.mouth.position.y = 1.76;
    } else if (mood === "sad") {
      this.mouth.scale.set(1.25, 0.6, 1);
      this.mouth.position.y = 1.74;
    } else {
      this.mouth.scale.set(1, 1, 1);
      this.mouth.position.y = 1.78;
    }
  }

  _setIndicator(color, scale = 1) {
    if (!this.indicator) return;
    this.indicatorMaterial.color.setHex(color);
    this.indicator.scale.setScalar(scale);
    this.indicator.visible = true;
  }

  _tickPatience(dt) {
    if (this.state === "WAITING_FOR_ORDER" || this.state === "ORDER_TAKEN") {
      this.patience -= dt;
      if (this.patience <= 0) this.leaveAngry();
      return;
    }

    if (this.state === "EATING") {
      this.eatTimer -= dt;
      if (this.eatTimer <= 0) this._finishEating();
    }
  }

  _finishEating() {
    if (this.destroyed || this.state === "LEAVING") return;
    this.state = "LEAVING";
    this.leaveTimer = 0;
    this.foodMesh.visible = false;
    this._setFace("happy");
    if (!this.isRiding) {
      this._headToExit();
    }
    bus.emit("customer:finished", { customer: this, type: this.type.name });
  }

  _headToExit() {
    this.walkTarget.copy(this.exitPosition);
    this._hasWalkTarget = true;
    this.isMoving = true;
  }

  // -------------------------------------------------------------------------
  // Public API used by CustomerSystem / DriveThruSystem
  // -------------------------------------------------------------------------
  arriveAtQueue(target) {
    if (target) this.walkTarget.copy(target);
    this._hasWalkTarget = true;
    this.state = "WALKING";
  }

  takeOrder() {
    if (this.state !== "WAITING_FOR_ORDER") return false;
    this.state = "ORDER_TAKEN";
    this.patience = Math.max(this.patience, 12);
    this._setIndicator(0xffdd00, 0.8);
    bus.emit("customer:ordered", {
      customer: this,
      id: this.id,
      type: this.type.name,
      recipeId: this.orderRecipeId,
    });
    return true;
  }

  serve() {
    if (this.state !== "ORDER_TAKEN") return false;
    this.state = "EATING";
    this.eatTimer = 4;
    this.patience = 999;
    this.indicator.visible = false;
    this.foodMesh.visible = true;
    this._setFace("happy");
    if (this.isRiding) {
      // The car passenger eats while seated.
      this.leftArm.rotation.x = -0.9;
      this.rightArm.rotation.x = -0.9;
    }
    return true;
  }

  leaveAngry() {
    if (this.destroyed || this.state === "LEAVING") return false;
    this.state = "LEAVING";
    this.leaveTimer = 0;
    this.indicator.visible = false;
    this.foodMesh.visible = false;
    this._setFace("sad");
    if (!this.isRiding) this._headToExit();
    bus.emit("customer:leftAngry", { customer: this, type: this.type.name });
    return true;
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------
  update(dt) {
    if (this.destroyed) return;

    this._indicatorElapsed += dt;
    if (this.indicator?.visible) {
      const bob = Math.sin(this._indicatorElapsed * 5) * 0.12;
      this.indicator.position.y = 2.62 + bob;
      this.indicator.rotation.y += dt * 2;
    }

    if (this.isRiding) {
      // DriveThruSystem owns this.group.position; we only tick timers.
      this._tickPatience(dt);
      return;
    }

    if (this.state === "WALKING") {
      this._moveTowards(this.walkTarget, dt);
      if (this.position.distanceTo(this.walkTarget) < 0.28) {
        this.state = "WAITING_FOR_ORDER";
        this.isMoving = false;
        this.patience = this.maxPatience;
        this._setIndicator(0xff3333, 1);
        bus.emit("customer:arrived", { customer: this, type: this.type.name });
      }
    } else if (this.state === "LEAVING") {
      this.leaveTimer += dt;
      this._moveTowards(this.walkTarget, dt);
      const outOfBounds = this.position.z < -38
        || this.position.z > 38
        || Math.abs(this.position.x) > 9;
      if (outOfBounds || this.leaveTimer > 20 || this.position.distanceTo(this.walkTarget) < 0.4) {
        this.destroy();
        return;
      }
      if (!this.isMoving) {
        // Blocked while leaving — teleport to the exit rather than get stuck.
        this.position.copy(this.exitPosition);
        this.destroy();
        return;
      }
    } else {
      this._tickPatience(dt);
    }

    this.group.position.copy(this.position);
    this._updateAnimation(dt);
  }

  _moveTowards(target, dt) {
    const direction = this._moveDirection.subVectors(target, this.position);
    direction.y = 0;
    const distance = direction.length();

    if (distance <= 0.04) {
      this.isMoving = false;
      return;
    }

    direction.normalize();
    const step = Math.min(this.speed * dt, distance);
    this._tryMoveAxis("x", this.position.x + direction.x * step);
    this._tryMoveAxis("z", this.position.z + direction.z * step);
    this.isMoving = true;

    const targetAngle = Math.atan2(direction.x, direction.z);
    this.group.rotation.y = targetAngle;
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

  _updateAnimation(dt) {
    if (this.state === "EATING" && !this.isRiding) {
      // Small eating bob.
      this.leftArm.rotation.x = -0.9 + Math.sin(this.eatTimer * 9) * 0.12;
      this.rightArm.rotation.x = -0.9 - Math.sin(this.eatTimer * 9) * 0.12;
      return;
    }

    if (this.isMoving && this.state !== "EATING") {
      this.walkTime += dt * 10;
      const swing = Math.sin(this.walkTime) * 0.7;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing;
      this.rightLeg.rotation.x = swing;
      return;
    }

    const blend = Math.min(1, 10 * dt);
    for (const limb of [this.leftArm, this.rightArm, this.leftLeg, this.rightLeg]) {
      if (!limb) continue;
      limb.rotation.x = THREE.MathUtils.lerp(limb.rotation.x, 0, blend);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
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
    bus.emit("customer:destroyed", { customer: this });
  }
}
