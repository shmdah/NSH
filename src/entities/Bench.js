import * as THREE from "three";

export class Bench {
  constructor(scene, position, rotationY = 0) {
    this.scene = scene;
    this.position = position.clone();
    this.seatPosition = position.clone().add(new THREE.Vector3(0, 0.2, 0));
    this.interactPosition = position.clone().add(new THREE.Vector3(0, 0, 1.2));

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.rotation.y = rotationY;
    this.scene.add(this.group);

    this.occupant = null;
    this.state = "EMPTY";

    this._buildMesh();
  }

  _buildMesh() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4e3d });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    const seatGeo = new THREE.BoxGeometry(1.5, 0.1, 0.6);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.5;
    seat.castShadow = true;
    seat.receiveShadow = true;
    this.group.add(seat);

    const backGeo = new THREE.BoxGeometry(1.5, 0.6, 0.1);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 0.8, -0.25);
    back.castShadow = true;
    this.group.add(back);

    const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.5);

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.65, 0.25, 0);
    this.group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.65, 0.25, 0);
    this.group.add(rightLeg);
  }

  isPlayerNear(playerPos) {
    const dx = playerPos.x - this.interactPosition.x;
    const dz = playerPos.z - this.interactPosition.z;
    return dx * dx + dz * dz < 4;
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
