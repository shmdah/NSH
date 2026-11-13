import * as THREE from "three";
import { Theme } from "../data/Theme.js";
import { FoodStall } from "../entities/FoodStall.js";
import { Caravan } from "../entities/Caravan.js";
import { Building } from "../entities/Building.js";
import { Supplier } from "../entities/Supplier.js";
import { Bench } from "../entities/Bench.js";
import { State } from "./State.js";
import { bus } from "../systems/EventBus.js";

/**
 * Builds and owns the 3D street.
 *
 * Layout (world units):
 *   - road along Z centred on X = 0, 8 wide
 *   - left pavement / stall at X = -6
 *   - right pavement + parking lot at X ≈ +6 (building at Z = 0 removed)
 *   - buildings behind both pavements
 *
 * Important contract: `parkingLotPositions` is always defined. Systems read
 * it directly, so it must never be undefined.
 */
export class World {
  constructor(scene) {
    this.scene = scene;

    this.collisionObjects = [];
    this.collisionBoxes = [];
    this.benches = [];

    // Street landmarks ------------------------------------------------------
    this.supplierPosition = new THREE.Vector3(6, 0.2, 10);

    // Two marked bays on the right-hand side of the street.
    this.parkingLotPositions = [
      new THREE.Vector3(3.5, 0.2, -3),
      new THREE.Vector3(3.5, 0.2, 2),
    ];
    this.parkingLotCenter = new THREE.Vector3(6, 0.205, 0);
    this.parkingLotSize = { width: 8, depth: 10 };

    // Walking-customer queue in front of the stall.
    this.customerQueuePositions = [
      new THREE.Vector3(-3.1, 0.2, -2.2),
      new THREE.Vector3(-3.1, 0.2, 0),
      new THREE.Vector3(-3.1, 0.2, 2.2),
    ];
    this.customerSpawnPoint = new THREE.Vector3(5.5, 0.2, -31);
    this.customerExitPoint = new THREE.Vector3(5.2, 0.2, -40);

    // Drive-thru route.
    this.carSpawnPoint = new THREE.Vector3(3.5, 0.2, -28);
    this.carExitPoint = new THREE.Vector3(3.5, 0.2, 34);

    // Staff / stall anchors (updated when the caravan replaces the stall).
    this.cookPositions = [];
    this.cookInteractionPosition = new THREE.Vector3(-4.8, 0.2, 0);
    this.counterPosition = new THREE.Vector3(-4.5, 1.2, 0);
    this.waiterIdlePositions = [
      new THREE.Vector3(-3.4, 0.2, -2.6),
      new THREE.Vector3(-3.4, 0.2, 2.6),
    ];

    this.hasCaravan = State.hasCaravan;
    this.stall = null;
    this.stallCollisionBox = null;

    this._buildLighting();
    this._buildGround();
    this._buildRoad();
    this._buildPavement();
    this._buildParkingLot();
    this._buildBuildings();
    this._buildStreetProps();
    this._buildBenches();

    this.supplier = new Supplier(this.scene, this.supplierPosition);
    this.supplier.group.updateMatrixWorld(true);
    this.collisionObjects.push(this.supplier.group);

    this.supplierCollisionBox = new THREE.Box3(
      new THREE.Vector3(4.5, 0.2, 8.8),
      new THREE.Vector3(7.5, 2.6, 11.2),
    );
    this.collisionBoxes.push(this.supplierCollisionBox);

    this._updateStallVisuals(false);
    this._stallUpgradeUnsubscribe = bus.on("upgrade:caravan", () => {
      this._updateStallVisuals(true);
    });
  }

  // -------------------------------------------------------------------------
  // Environment
  // -------------------------------------------------------------------------
  _buildLighting() {
    const hemi = new THREE.HemisphereLight(Theme.skyFill, Theme.groundFill, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(Theme.sunLight, 2.6);
    this.sunLight = sun;
    sun.position.set(16, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0xff9a4a, 0.9);
    rim.position.set(-12, 9, -18);
    this.scene.add(rim);
  }

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: Theme.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildRoad() {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 90),
      new THREE.MeshStandardMaterial({ color: Theme.road, roughness: 0.95 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.012, 0);
    road.receiveShadow = true;
    this.scene.add(road);

    const lineMat = new THREE.MeshStandardMaterial({ color: Theme.roadLine, roughness: 0.8 });
    const lineGeo = new THREE.PlaneGeometry(0.16, 2.4);
    for (let z = -42; z <= 42; z += 5) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, z);
      line.receiveShadow = true;
      this.scene.add(line);
    }

    // Side lines.
    for (const x of [-3.85, 3.85]) {
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 88),
        new THREE.MeshStandardMaterial({ color: 0x8a8175, roughness: 0.9 }),
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.018, 0);
      this.scene.add(edge);
    }
  }

  _buildPavement() {
    const pavMat = new THREE.MeshStandardMaterial({ color: Theme.pavement, roughness: 0.95 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: Theme.pavementEdge, roughness: 0.95 });

    for (const x of [-6, 6]) {
      const pavement = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 88), pavMat);
      pavement.position.set(x, 0.1, 0);
      pavement.receiveShadow = true;
      pavement.castShadow = true;
      this.scene.add(pavement);

      // Kerb along the road edge.
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 88), edgeMat);
      kerb.position.set(x === -6 ? -4.06 : 4.06, 0.12, 0);
      kerb.receiveShadow = true;
      this.scene.add(kerb);
    }
  }

  _buildParkingLot() {
    const { width, depth } = this.parkingLotSize;

    const lot = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: Theme.parkingLot, roughness: 0.95 }),
    );
    lot.rotation.x = -Math.PI / 2;
    lot.position.copy(this.parkingLotCenter);
    lot.receiveShadow = true;
    this.scene.add(lot);

    // Painted border.
    this._addParkingLine(this.parkingLotCenter.x, this.parkingLotCenter.z - depth / 2 + 0.05, width, 0.1);
    this._addParkingLine(this.parkingLotCenter.x, this.parkingLotCenter.z + depth / 2 - 0.05, width, 0.1);
    this._addParkingLine(this.parkingLotCenter.x - width / 2 + 0.05, this.parkingLotCenter.z, 0.1, depth);
    this._addParkingLine(this.parkingLotCenter.x + width / 2 - 0.05, this.parkingLotCenter.z, 0.1, depth);

    // Two bays, each centred on a parkingLotPosition (X = 3.5).
    const bayLeft = 2.3;
    const bayRight = 4.7;
    for (const bayCenterZ of [-3, 2]) {
      const bayDepth = 4.2;
      const zTop = bayCenterZ - bayDepth / 2;
      const zBottom = bayCenterZ + bayDepth / 2;
      this._addParkingLine((bayLeft + bayRight) / 2, zTop, bayRight - bayLeft, 0.09);
      this._addParkingLine((bayLeft + bayRight) / 2, zBottom, bayRight - bayLeft, 0.09);
      this._addParkingLine(bayLeft, bayCenterZ, 0.09, bayDepth);
      this._addParkingLine(bayRight, bayCenterZ, 0.09, bayDepth);
    }

    // A little sign so the lot reads as a drive-thru.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: Theme.metal, roughness: 0.6, metalness: 0.4 }),
    );
    pole.position.set(9.2, 1.2, 5.2);
    pole.castShadow = true;
    this.scene.add(pole);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.8, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2e6b9e }),
    );
    board.position.set(9.2, 2.0, 5.2);
    board.rotation.y = -Math.PI / 2;
    board.castShadow = true;
    this.scene.add(board);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.12, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }),
    );
    stripe.position.set(9.2, 2.14, 5.25);
    stripe.rotation.y = -Math.PI / 2;
    this.scene.add(stripe);
  }

  _addParkingLine(x, z, width, depth) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: Theme.parkingLine, roughness: 0.8 }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.216, z);
    line.receiveShadow = true;
    this.scene.add(line);
  }

  _buildBuildings() {
    for (let side = -1; side <= 1; side += 2) {
      const baseX = side * 12.5;

      for (let z = -36; z <= 36; z += 12) {
        // The right-hand building at Z = 0 is replaced by the parking lot.
        if (side === 1 && z === 0) continue;

        const building = new Building();
        building.group.position.set(baseX, 0, z);
        building.group.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
        this.scene.add(building.group);
        this.collisionObjects.push(building.group);

        // Footprint only (12m along Z, 9m along X). Balconies are not
        // considered for ground collision, otherwise the pavement is blocked.
        this.collisionBoxes.push(new THREE.Box3(
          new THREE.Vector3(baseX - 4.5, 0, z - 6),
          new THREE.Vector3(baseX + 4.5, 11, z + 6),
        ));
      }
    }
  }

  _buildStreetProps() {
    const lampMat = new THREE.MeshStandardMaterial({ color: Theme.lampPost, roughness: 0.7, metalness: 0.4 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff0c0,
      emissive: 0xffd27a,
      emissiveIntensity: 0.6,
    });

    for (const z of [-30, -15, 15, 30]) {
      for (const x of [-7.2, 7.2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 8), lampMat);
        pole.position.set(x, 2.5, z);
        pole.castShadow = true;
        this.scene.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), lampMat);
        arm.position.set(x + (x < 0 ? 0.45 : -0.45), 4.95, z);
        this.scene.add(arm);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.22), bulbMat);
        bulb.position.set(x + (x < 0 ? 0.85 : -0.85), 4.9, z);
        this.scene.add(bulb);
      }
    }

    // Bins and crates.
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3b, roughness: 0.9 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1 });
    const props = [
      { x: -4.8, z: -6, mat: binMat, size: 0.55 },
      { x: 4.8, z: 6.5, mat: binMat, size: 0.55 },
      { x: 7.4, z: -7.5, mat: crateMat, size: 0.6 },
      { x: -7.4, z: 13, mat: crateMat, size: 0.6 },
    ];
    for (const prop of props) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(prop.size, prop.size, prop.size),
        prop.mat,
      );
      mesh.position.set(prop.x, 0.2 + prop.size / 2, prop.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  _buildBenches() {
    const positions = [
      new THREE.Vector3(-6, 0.2, 6),
      new THREE.Vector3(-6, 0.2, 9),
      new THREE.Vector3(-6, 0.2, 12),
    ];
    for (const position of positions) {
      const bench = new Bench(this.scene, position, -Math.PI / 2);
      this.benches.push(bench);
    }
  }

  // -------------------------------------------------------------------------
  // Stall / caravan swap
  // -------------------------------------------------------------------------
  _updateStallVisuals(notify = true) {
    if (this.stall) {
      const objectIndex = this.collisionObjects.indexOf(this.stall.group);
      if (objectIndex >= 0) this.collisionObjects.splice(objectIndex, 1);
      const boxIndex = this.collisionBoxes.indexOf(this.stallCollisionBox);
      if (boxIndex >= 0) this.collisionBoxes.splice(boxIndex, 1);
      this.stall.dispose?.();
      this.stall = null;
      this.stallCollisionBox = null;
    }

    this.hasCaravan = State.hasCaravan;

    this.stall = this.hasCaravan
      ? new Caravan(new THREE.Vector3(-6, 0.2, 0))
      : new FoodStall(new THREE.Vector3(-6, 0.2, 0));

    this.scene.add(this.stall.group);
    this.collisionObjects.push(this.stall.group);

    if (this.hasCaravan) {
      this.stallCollisionBox = new THREE.Box3(
        new THREE.Vector3(-7.6, 0.2, -1.2),
        new THREE.Vector3(-4.4, 2.0, 1.2),
      );
      this.cookPositions = [
        new THREE.Vector3(-6, 2.0, -0.6),
        new THREE.Vector3(-6, 2.0, 0.6),
      ];
      this.counterPosition = new THREE.Vector3(-4.5, 1.2, 0);
      this.cookInteractionPosition = new THREE.Vector3(-4.0, 0.2, 0);
      this.waiterIdlePositions = [
        new THREE.Vector3(-3.2, 0.2, -2.7),
        new THREE.Vector3(-3.2, 0.2, 2.7),
      ];
    } else {
      this.stallCollisionBox = new THREE.Box3(
        new THREE.Vector3(-6.7, 0.2, -1.3),
        new THREE.Vector3(-5.3, 1.3, 1.3),
      );
      this.cookPositions = [];
      this.counterPosition = new THREE.Vector3(-4.5, 1.2, 0);
      this.cookInteractionPosition = new THREE.Vector3(-4.8, 0.2, 0);
      this.waiterIdlePositions = [
        new THREE.Vector3(-3.4, 0.2, -2.6),
        new THREE.Vector3(-3.4, 0.2, 2.6),
      ];
    }

    this.collisionBoxes.push(this.stallCollisionBox);

    if (notify) {
      bus.emit("stall:changed", { hasCaravan: State.hasCaravan });
    }
  }

  update(dt) {
    this.stall?.update?.(dt);
  }

  setShadowMapSize(size) {
    if (!this.sunLight || this.sunLight.shadow.mapSize.width === size) return;
    this.sunLight.shadow.mapSize.set(size, size);
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null;
    this.sunLight.shadow.needsUpdate = true;
  }

  dispose() {
    this._stallUpgradeUnsubscribe?.();
    this.stall?.dispose?.();
    this.supplier.dispose();
    for (const bench of this.benches) {
      bench.group.removeFromParent();
    }
    this.benches.length = 0;
  }
}
