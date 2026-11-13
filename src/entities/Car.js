import * as THREE from "three";

/**
 * Low-poly car used by the drive-thru.
 *
 * The cabin is built from a roof + pillars instead of a solid box so the
 * drive-thru customer sitting inside is actually visible through the
 * (transparent) windows at every point of the drive.
 */
export class Car {
  constructor(scene, color = 0x336699) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "car";
    this.scene.add(this.group);

    this.speed = 9.5;
    this.turnSpeed = 5;
    this.isMoving = false;
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = null;

    this._direction = new THREE.Vector3();
    this._desiredQuaternion = new THREE.Quaternion();
    this._upAxis = new THREE.Vector3(0, 1, 0);
    this._wheels = [];
    this._elapsed = 0;

    this._buildMesh(color);
  }

  _buildMesh(color) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.35,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x9fc4d8,
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xfff2b0,
      emissive: 0xffdd66,
      emissiveIntensity: 0.8,
    });
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xaa1100,
      emissiveIntensity: 0.6,
    });

    // Lower body.
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.5), bodyMat);
    body.position.y = 0.62;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Bonnet / boot wedges keep the silhouette readable from far away.
    const bonnet = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.9), bodyMat);
    bonnet.position.set(0, 0.95, 1.25);
    bonnet.castShadow = true;
    this.group.add(bonnet);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.7), bodyMat);
    boot.position.set(0, 0.95, -1.3);
    boot.castShadow = true;
    this.group.add(boot);

    // Cabin roof + pillars (open sides so the passenger is visible).
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.9), bodyMat);
    roof.position.set(0, 1.6, -0.15);
    roof.castShadow = true;
    this.group.add(roof);

    const pillarGeo = new THREE.BoxGeometry(0.1, 0.62, 0.1);
    for (const x of [-0.76, 0.76]) {
      for (const z of [-1.0, 0.72]) {
        const pillar = new THREE.Mesh(pillarGeo, bodyMat);
        pillar.position.set(x, 1.29, z);
        pillar.castShadow = true;
        this.group.add(pillar);
      }
    }

    // Transparent windows.
    const sideWindowGeo = new THREE.PlaneGeometry(1.7, 0.55);
    for (const side of [-1, 1]) {
      const sideWindow = new THREE.Mesh(sideWindowGeo, glassMat);
      sideWindow.position.set(side * 0.765, 1.33, -0.15);
      sideWindow.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(sideWindow);
    }

    const frontWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.54), glassMat);
    frontWindow.position.set(0, 1.33, 0.74);
    this.group.add(frontWindow);

    const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.5), glassMat);
    rearWindow.position.set(0, 1.33, -1.04);
    rearWindow.rotation.y = Math.PI;
    this.group.add(rearWindow);

    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14);
    const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 10);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.8, roughness: 0.3 });
    for (const x of [-0.92, 0.92]) {
      for (const z of [-1.18, 1.18]) {
        const wheel = new THREE.Mesh(wheelGeo, darkMat);
        wheel.position.set(x, 0.36, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        this.group.add(wheel);
        this._wheels.push(wheel);

        const hub = new THREE.Mesh(hubGeo, hubMat);
        hub.position.set(x, 0.36, z);
        hub.rotation.z = Math.PI / 2;
        this.group.add(hub);
      }
    }

    // Lights.
    for (const x of [-0.58, 0.58]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.06), lightMat);
      headlight.position.set(x, 0.7, 1.77);
      this.group.add(headlight);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.06), tailMat);
      tail.position.set(x, 0.7, -1.77);
      this.group.add(tail);
    }

    // Bumpers.
    for (const z of [-1.79, 1.79]) {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.16, 0.12), darkMat);
      bumper.position.set(0, 0.42, z);
      this.group.add(bumper);
    }
  }

  setPosition(position) {
    this.group.position.copy(position);
  }

  driveTo(target, targetRotation = null) {
    this.targetPosition.copy(target);
    this.targetRotation = targetRotation;
    this.isMoving = true;
  }

  driveAway(target = new THREE.Vector3(3.5, 0.2, 34)) {
    this.driveTo(target, 0);
  }

  stop() {
    this.isMoving = false;
  }

  update(dt) {
    this._elapsed += dt;

    if (!this.isMoving) {
      // Idle body wobble — makes parked cars feel less like statues.
      this.group.position.y += Math.sin(this._elapsed * 2.2) * 0.00025;
      return;
    }

    this._direction.subVectors(this.targetPosition, this.group.position);
    this._direction.y = 0;
    const distance = this._direction.length();

    if (distance > 0.05) {
      this._direction.normalize();
      // Clamping the step to the remaining distance prevents overshoot.
      const step = Math.min(this.speed * dt, distance);
      this.group.position.addScaledVector(this._direction, step);
    }

    const desiredYaw = this.targetRotation ?? Math.atan2(this._direction.x, this._direction.z);
    const currentYaw = this.group.rotation.y;
    let yawDifference = THREE.MathUtils.euclideanModulo(
      desiredYaw - currentYaw + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    this.group.rotation.y = currentYaw + yawDifference * Math.min(1, this.turnSpeed * dt);

    for (const wheel of this._wheels) {
      wheel.rotation.x += dt * 9;
    }

    if (distance <= 0.12) {
      this.group.position.x = this.targetPosition.x;
      this.group.position.z = this.targetPosition.z;
      this.isMoving = false;
      if (this.targetRotation !== null) {
        this.group.rotation.y = this.targetRotation;
      }
    }
  }

  destroy() {
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
