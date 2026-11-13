import * as THREE from "three";

/**
 * A pulsing red interaction circle on the ground.
 */
export class TriggerZone {
  constructor(scene, position, radius = 2.5, color = 0xff3333) {
    this.scene = scene;
    this.position = position.clone();
    this.radius = radius;
    this.color = color;
    this.elapsed = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    this._buildMesh();
  }

  _buildMesh() {
    const fill = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius, this.radius, 0.04, 40),
      new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    fill.position.y = 0.03;
    this.group.add(fill);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(this.radius - 0.07, this.radius, 48),
      new THREE.MeshBasicMaterial({
        color: this.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    this.group.add(ring);
    this.ring = ring;
  }

  setPosition(position) {
    this.position.copy(position);
    this.group.position.copy(position);
  }

  update(dt) {
    this.elapsed += dt;
    const pulse = 1 + Math.sin((this.elapsed * Math.PI * 2) / 1.6) * 0.05;
    this.group.scale.set(pulse, 1, pulse);
    if (this.ring) {
      this.ring.material.opacity = 0.55 + Math.sin(this.elapsed * 3) * 0.25;
    }
  }

  isPlayerInside(playerPosition) {
    const dx = playerPosition.x - this.position.x;
    const dz = playerPosition.z - this.position.z;
    return dx * dx + dz * dz <= this.radius * this.radius;
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
