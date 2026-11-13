import * as THREE from "three";
import { damp } from "../utils/math.js";

export class Camera {
  constructor(canvas, scene) {
    this.canvas = canvas;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 8, 9);

    this.followTarget = new THREE.Vector3();
    this._idealTarget = new THREE.Vector3();
    this._lookMatrix = new THREE.Matrix4();
    this._desiredQuaternion = new THREE.Quaternion();
    this.lerpSpeed = 6;

    this.mode = "third";
    this.modePresets = {
      third: { distance: 8, pitch: 0.3 },
      first: { distance: 0.1, pitch: 0.1 },
      wide: { distance: 14, pitch: 0.6 },
    };
    this.yaw = 0;
    this.pitch = this.modePresets.third.pitch;
    this.currentYaw = this.yaw;
    this.currentPitch = this.pitch;
    this.distance = this.modePresets.third.distance;
    this.targetDistance = this.distance;
    this.minPitch = 0.08;
    this.maxPitch = Math.PI / 2 - 0.1;

    this.raycaster = new THREE.Raycaster();
    this._rayDirection = new THREE.Vector3();
    this._idealCameraPosition = new THREE.Vector3();
    this._actualCameraPosition = new THREE.Vector3();
    this._collisionObjects = [];
    this._collisionDistance = this.distance;
    this._initialized = false;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onClick = this._onClick.bind(this);

    window.addEventListener("mousemove", this._onMouseMove);
    this.canvas.addEventListener("wheel", this._onWheel, { passive: false });
    this.canvas.addEventListener("click", this._onClick);
    window.addEventListener("resize", this._onResize);
  }

  cycleMode() {
    const modes = Object.keys(this.modePresets);
    this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
    const preset = this.modePresets[this.mode];
    this.targetDistance = preset.distance;
    this.pitch = preset.pitch;
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
    return this.mode;
  }

  _onClick() {
    if (document.pointerLockElement === this.canvas) return;
    if (typeof this.canvas.requestPointerLock !== "function") return;
    const result = this.canvas.requestPointerLock();
    if (result && typeof result.catch === "function") {
      result.catch((error) => console.error("[Camera] Could not lock pointer:", error));
    }
  }

  _onMouseMove(event) {
    if (event.buttons !== 1 && document.pointerLockElement !== this.canvas) return;

    this.yaw -= event.movementX * 0.003;
    this.pitch -= event.movementY * 0.003;
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
  }

  _onWheel(event) {
    if (this.mode === "first") return;
    event.preventDefault();
    const minDistance = this.mode === "wide" ? 9 : 4;
    const maxDistance = this.mode === "wide" ? 20 : 12;
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + event.deltaY * 0.01,
      minDistance,
      maxDistance,
    );
  }

  setCollisionObjects(objects) {
    this._collisionObjects = objects;
    this.scene.updateMatrixWorld(true);
  }

  update(dt, playerPosition) {
    const idealTarget = this._idealTarget.copy(playerPosition);
    idealTarget.y += this.mode === "first" ? 1.6 : 1.5;

    this.followTarget.x = damp(this.followTarget.x, idealTarget.x, this.lerpSpeed, dt);
    this.followTarget.y = damp(this.followTarget.y, idealTarget.y, this.lerpSpeed, dt);
    this.followTarget.z = damp(this.followTarget.z, idealTarget.z, this.lerpSpeed, dt);

    const yawDifference = THREE.MathUtils.euclideanModulo(
      this.yaw - this.currentYaw + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    this.currentYaw += yawDifference * (1 - Math.exp(-this.lerpSpeed * dt));
    this.currentPitch = damp(this.currentPitch, this.pitch, this.lerpSpeed, dt);
    this.distance = damp(this.distance, this.targetDistance, this.lerpSpeed, dt);

    const offsetX = Math.sin(this.currentYaw) * Math.cos(this.currentPitch) * this.distance;
    const offsetY = Math.sin(this.currentPitch) * this.distance;
    const offsetZ = Math.cos(this.currentYaw) * Math.cos(this.currentPitch) * this.distance;
    this._idealCameraPosition.set(
      this.followTarget.x + offsetX,
      this.followTarget.y + offsetY,
      this.followTarget.z + offsetZ,
    );

    let desiredDistance = this.distance;
    if (this.mode !== "first" && this._collisionObjects.length > 0) {
      this._rayDirection.subVectors(this._idealCameraPosition, this.followTarget).normalize();
      this.raycaster.set(this.followTarget, this._rayDirection);
      this.raycaster.far = this.distance;
      const hits = this.raycaster.intersectObjects(this._collisionObjects, true);
      if (hits.length > 0) {
        desiredDistance = Math.max(0.5, hits[0].distance - 0.35);
      }
    }

    if (this.mode === "first" || desiredDistance < this._collisionDistance) {
      this._collisionDistance = desiredDistance;
    } else {
      this._collisionDistance = damp(this._collisionDistance, desiredDistance, this.lerpSpeed, dt);
    }

    const finalOffsetX = Math.sin(this.currentYaw) * Math.cos(this.currentPitch) * this._collisionDistance;
    const finalOffsetY = Math.sin(this.currentPitch) * this._collisionDistance;
    const finalOffsetZ = Math.cos(this.currentYaw) * Math.cos(this.currentPitch) * this._collisionDistance;
    this._actualCameraPosition.set(
      this.followTarget.x + finalOffsetX,
      this.followTarget.y + finalOffsetY,
      this.followTarget.z + finalOffsetZ,
    );

    if (!this._initialized) {
      this.camera.position.copy(this._actualCameraPosition);
      this._lookMatrix.lookAt(this.camera.position, this.followTarget, this.camera.up);
      this.camera.quaternion.setFromRotationMatrix(this._lookMatrix);
      this._initialized = true;
      return;
    }

    this.camera.position.x = damp(this.camera.position.x, this._actualCameraPosition.x, this.lerpSpeed, dt);
    this.camera.position.y = damp(this.camera.position.y, this._actualCameraPosition.y, this.lerpSpeed, dt);
    this.camera.position.z = damp(this.camera.position.z, this._actualCameraPosition.z, this.lerpSpeed, dt);
    this._lookMatrix.lookAt(this.camera.position, this.followTarget, this.camera.up);
    this._desiredQuaternion.setFromRotationMatrix(this._lookMatrix);
    this.camera.quaternion.slerp(
      this._desiredQuaternion,
      1 - Math.exp(-this.lerpSpeed * dt),
    );
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    window.removeEventListener("mousemove", this._onMouseMove);
    this.canvas.removeEventListener("wheel", this._onWheel);
    this.canvas.removeEventListener("click", this._onClick);
    window.removeEventListener("resize", this._onResize);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
}
