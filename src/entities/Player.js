import * as THREE from "three";
import { Theme } from "../data/Theme.js";

/**
 * The player avatar: modular body, swinging limbs, jump, camera-relative
 * movement and Box3 collision against world.collisionBoxes.
 */
export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.position = new THREE.Vector3(-4.4, 0.2, 8);
    this.spawnPosition = this.position.clone();
    this.velocityY = 0;
    this.gravity = -25;
    this.jumpForce = 7.5;
    this.isGrounded = true;
    this.speed = 6;
    this.walkTime = 0;
    this.heading = Math.PI;

    this._moveDirection = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._collisionBox = new THREE.Box3();
    this._collisionCenter = new THREE.Vector3();
    this._collisionSize = new THREE.Vector3(0.8, 1.8, 0.8);
    this._limbs = [];

    this.group = new THREE.Group();
    this.group.name = "player";
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    this._buildMesh();
  }

  _buildMesh() {
    const skinMaterial = new THREE.MeshStandardMaterial({ color: Theme.skin });
    const shirtMaterial = new THREE.MeshStandardMaterial({ color: 0x2d4c75 });
    const pantsMaterial = new THREE.MeshStandardMaterial({ color: Theme.pants });
    const capMaterial = new THREE.MeshStandardMaterial({ color: 0xb04b38 });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.4), shirtMaterial);
    torso.position.y = 1.1;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);

    // Apron — this is a food vendor, after all.
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.72, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xe9e2d0 }),
    );
    apron.position.set(0, 0.98, 0.23);
    this.group.add(apron);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), skinMaterial);
    neck.position.y = 1.66;
    this.group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMaterial);
    head.position.y = 1.9;
    head.castShadow = true;
    this.group.add(head);

    // Eyes.
    for (const x of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), blackMat);
      eye.position.set(x, 1.95, 0.255);
      this.group.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02), blackMat);
    mouth.position.set(0, 1.8, 0.255);
    this.group.add(mouth);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.55), capMaterial);
    cap.position.y = 2.16;
    cap.castShadow = true;
    this.group.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.3), capMaterial);
    brim.position.set(0, 2.12, 0.32);
    this.group.add(brim);

    this.leftArm = this._createLimb(-0.55, 1.5, 0, 0.25, 0.9, 0.25, shirtMaterial);
    this.rightArm = this._createLimb(0.55, 1.5, 0, 0.25, 0.9, 0.25, shirtMaterial);
    this.leftLeg = this._createLimb(-0.2, 0.6, 0, 0.3, 0.6, 0.3, pantsMaterial);
    this.rightLeg = this._createLimb(0.2, 0.6, 0, 0.3, 0.6, 0.3, pantsMaterial);
  }

  _createLimb(x, y, z, width, height, depth, material) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.y = -height / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    this.group.add(pivot);
    this._limbs.push(pivot);
    return pivot;
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  teleport(position) {
    this.position.copy(position);
    this.group.position.copy(this.position);
    this.velocityY = 0;
  }

  update(dt, input, camera) {
    const moveDirection = this._moveDirection.set(0, 0, 0);
    const yaw = camera?.currentYaw ?? camera?.yaw ?? Math.PI;
    const forward = this._forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = this._right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    if (input.isDown("KeyW") || input.isDown("ArrowUp")) moveDirection.add(forward);
    if (input.isDown("KeyS") || input.isDown("ArrowDown")) moveDirection.sub(forward);
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) moveDirection.add(right);
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) moveDirection.sub(right);

    const isMoving = moveDirection.lengthSq() > 0;
    if (isMoving) {
      moveDirection.normalize();
      const step = this.speed * dt;
      this._tryMoveAxis("x", THREE.MathUtils.clamp(this.position.x + moveDirection.x * step, -7.6, 7.6));
      this._tryMoveAxis("z", THREE.MathUtils.clamp(this.position.z + moveDirection.z * step, -35, 35));

      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
      let angleDifference = targetAngle - this.group.rotation.y;
      angleDifference = THREE.MathUtils.euclideanModulo(angleDifference + Math.PI, Math.PI * 2) - Math.PI;
      this.group.rotation.y += angleDifference * Math.min(1, 12 * dt);
      this.heading = this.group.rotation.y;
    }

    if (input.wasPressed("Space") && this.isGrounded) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }

    this.velocityY += this.gravity * dt;
    this.position.y += this.velocityY * dt;

    if (this.position.y <= 0.2) {
      this.position.y = 0.2;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    this.group.position.copy(this.position);
    this._updateAnimation(isMoving, dt);
  }

  _tryMoveAxis(axis, value) {
    const previous = this.position[axis];
    this.position[axis] = value;
    this._updateCollisionBox();

    for (const box of this.world.collisionBoxes) {
      if (this._collisionBox.intersectsBox(box)) {
        this.position[axis] = previous;
        this._updateCollisionBox();
        return false;
      }
    }
    return true;
  }

  _updateCollisionBox() {
    this._collisionCenter.set(this.position.x, this.position.y + 0.9, this.position.z);
    this._collisionBox.setFromCenterAndSize(this._collisionCenter, this._collisionSize);
  }

  _updateAnimation(isMoving, dt) {
    if (isMoving) {
      this.walkTime += dt * 10;
      const swing = Math.sin(this.walkTime) * 0.7;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing;
      this.rightLeg.rotation.x = swing;
      return;
    }

    for (const limb of this._limbs) {
      limb.rotation.x = THREE.MathUtils.damp(limb.rotation.x, 0, 10, dt);
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
