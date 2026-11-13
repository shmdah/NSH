import * as THREE from "three";
import { Theme } from "../data/Theme.js";

export class Building {
  constructor() {
    this.group = new THREE.Group();
    this.W = 12;
    this.D = 9;
    this.H_GF = 3.5;
    this.H_Upper = 3.2;
    this.H_Parapet = 1.1;
    this.frontZ = this.D / 2;
    this.roofLevel = this.H_GF + this.H_Upper * 2;
    this.balconyLevels = [this.H_GF, this.H_GF + this.H_Upper];

    this.materials = {
      wall: new THREE.MeshStandardMaterial({ color: Theme.wallPrimary, roughness: 0.9 }),
      wallTrim: new THREE.MeshStandardMaterial({ color: Theme.wallSecondary, roughness: 0.95 }),
      ground: new THREE.MeshStandardMaterial({ color: Theme.groundFloorWall, roughness: 0.95 }),
      recess: new THREE.MeshStandardMaterial({ color: 0x11151a, roughness: 0.8 }),
      frame: new THREE.MeshStandardMaterial({ color: Theme.frameBronze, roughness: 0.55, metalness: 0.55 }),
      glass: new THREE.MeshStandardMaterial({
        color: Theme.glass,
        roughness: 0.18,
        metalness: 0.35,
        transparent: true,
        opacity: 0.78,
      }),
      railing: new THREE.MeshStandardMaterial({ color: Theme.railing, roughness: 0.5, metalness: 0.7 }),
      canopyA: new THREE.MeshStandardMaterial({ color: Theme.signboardA, roughness: 0.75 }),
      canopyB: new THREE.MeshStandardMaterial({ color: Theme.signboardB, roughness: 0.75 }),
      signA: new THREE.MeshStandardMaterial({ color: Theme.signboardA, roughness: 0.7 }),
      signB: new THREE.MeshStandardMaterial({ color: Theme.signboardB, roughness: 0.7 }),
      roof: new THREE.MeshStandardMaterial({ color: Theme.roofConcrete, roughness: 1 }),
      tank: new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.48, metalness: 0.25 }),
      tankBand: new THREE.MeshStandardMaterial({ color: 0x41464a, roughness: 0.45, metalness: 0.65 }),
    };

    this._buildStructure();
    this._buildGroundFloor();
    this._buildUpperFloors();
    this._buildRoof();
  }

  _addBox(name, width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  _buildStructure() {
    const upperHeight = this.roofLevel - this.H_GF;
    const upperCenter = this.H_GF + upperHeight / 2;
    const wallThickness = 0.45;

    this._addBox(
      "rear-wall",
      this.W,
      upperHeight,
      wallThickness,
      this.materials.wall,
      0,
      upperCenter,
      -this.D / 2 + wallThickness / 2,
    );
    for (const side of [-1, 1]) {
      this._addBox(
        "side-wall",
        wallThickness,
        upperHeight,
        this.D,
        this.materials.wall,
        side * (this.W / 2 - wallThickness / 2),
        upperCenter,
        0,
      );
    }

    this._addBox(
      "ground-floor-rear-wall",
      this.W,
      this.H_GF,
      wallThickness,
      this.materials.ground,
      0,
      this.H_GF / 2,
      -this.D / 2 + wallThickness / 2,
    );
    for (const side of [-1, 1]) {
      this._addBox(
        "ground-floor-side-wall",
        wallThickness,
        this.H_GF,
        this.D,
        this.materials.ground,
        side * (this.W / 2 - wallThickness / 2),
        this.H_GF / 2,
        0,
      );
    }

    const frontCenterZ = this.frontZ - wallThickness / 2;
    this._addBox("shopfront-sill", this.W, 0.3, wallThickness, this.materials.ground, 0, 0.15, frontCenterZ);
    this._addBox("shopfront-header", this.W, 0.7, wallThickness, this.materials.ground, 0, 3.15, frontCenterZ);
    this._addBox("left-shop-pier", 0.5, 2.5, wallThickness, this.materials.ground, -5.75, 1.55, frontCenterZ);
    this._addBox("center-shop-pier", 1, 2.5, wallThickness, this.materials.ground, 0, 1.55, frontCenterZ);
    this._addBox("right-shop-pier", 0.5, 2.5, wallThickness, this.materials.ground, 5.75, 1.55, frontCenterZ);

    for (let floor = 0; floor < 2; floor++) {
      const baseY = this.H_GF + floor * this.H_Upper;
      this._addBox(
        "facade-floor-band",
        this.W + 0.08,
        0.14,
        0.18,
        this.materials.wallTrim,
        0,
        baseY + 0.07,
        this.frontZ + 0.015,
      );
      this._addBox(
        "facade-ceiling-band",
        this.W + 0.08,
        0.14,
        0.18,
        this.materials.wallTrim,
        0,
        baseY + this.H_Upper - 0.07,
        this.frontZ + 0.015,
      );

      const openingBottom = baseY + 0.82;
      const openingTop = baseY + 2.55;
      this._addBox(
        "facade-window-sill",
        this.W,
        0.12,
        0.18,
        this.materials.wall,
        0,
        openingBottom - 0.06,
        this.frontZ + 0.015,
      );
      this._addBox(
        "facade-window-header",
        this.W,
        0.18,
        0.18,
        this.materials.wall,
        0,
        openingTop + 0.09,
        this.frontZ + 0.015,
      );

      const openings = [-3.6, 0, 3.6];
      const openingWidth = 1.6;
      const segments = [
        [-this.W / 2, openings[0] - openingWidth / 2],
        [openings[0] + openingWidth / 2, openings[1] - openingWidth / 2],
        [openings[1] + openingWidth / 2, openings[2] - openingWidth / 2],
        [openings[2] + openingWidth / 2, this.W / 2],
      ];
      for (const [left, right] of segments) {
        const width = right - left;
        if (width <= 0) continue;
        this._addBox(
          "facade-window-pier",
          width,
          openingTop - openingBottom,
          0.18,
          this.materials.wall,
          (left + right) / 2,
          (openingBottom + openingTop) / 2,
          this.frontZ + 0.015,
        );
      }
    }

    this._addBox(
      "roof-edge-trim",
      this.W + 0.12,
      0.18,
      this.D + 0.12,
      this.materials.wallTrim,
      0,
      this.roofLevel - 0.09,
      0,
    );
  }

  _buildGroundFloor() {
    const shopWidth = 5;
    const shopHeight = 2.5;
    const shopY = 1.55;
    const recessBackZ = this.frontZ - 0.82;

    for (const [index, x] of [-3, 3].entries()) {
      const signMaterial = index === 0 ? this.materials.signA : this.materials.signB;
      const canopyMaterial = index === 0 ? this.materials.canopyA : this.materials.canopyB;

      this._addBox("shop-recess-back", shopWidth, shopHeight, 0.16, this.materials.recess, x, shopY, recessBackZ);
      for (const side of [-1, 1]) {
        this._addBox(
          "shop-recess-return",
          0.16,
          shopHeight,
          0.72,
          this.materials.ground,
          x + side * (shopWidth / 2 - 0.08),
          shopY,
          this.frontZ - 0.43,
        );
      }

      const windowWidth = 2.7;
      const windowHeight = 1.6;
      const windowX = x - 0.55;
      const windowY = 1.52;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(windowWidth, windowHeight), this.materials.glass);
      pane.name = "shop-display-glass";
      pane.position.set(windowX, windowY, this.frontZ - 0.38);
      this.group.add(pane);

      this._addBox("shop-display-mullion", 0.07, windowHeight, 0.06, this.materials.frame, windowX, windowY, this.frontZ - 0.35);

      const doorX = x + 1.45;
      const doorWidth = 0.8;
      const doorHeight = 2;
      const door = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth, doorHeight), this.materials.glass);
      door.name = "shop-door-glass";
      door.position.set(doorX, 1.38, this.frontZ - 0.37);
      this.group.add(door);
      this._addBox("shop-door-frame", 0.08, doorHeight + 0.12, 0.07, this.materials.frame, doorX + doorWidth / 2, 1.38, this.frontZ - 0.33);
      this._addBox("shop-door-handle", 0.04, 0.22, 0.05, this.materials.tankBand, doorX + 0.24, 1.38, this.frontZ - 0.31);

      this._addBox("shop-signboard", 4.4, 0.44, 0.16, signMaterial, x, 2.98, this.frontZ + 0.12);

      this._addBox("shop-awning", 5.35, 0.16, 1.2, canopyMaterial, x, 3.34, this.frontZ + 0.55);
      this._addBox("awning-valance", 5.35, 0.24, 0.12, canopyMaterial, x, 3.14, this.frontZ + 1.08);
      for (const side of [-1, 1]) {
        const bracket = this._addBox(
          "awning-bracket",
          0.1,
          0.56,
          0.1,
          this.materials.frame,
          x + side * 2.25,
          3.05,
          this.frontZ + 0.38,
        );
        bracket.rotation.x = -Math.PI / 5;
      }
    }
  }

  _buildUpperFloors() {
    for (let floor = 0; floor < 2; floor++) {
      const floorBase = this.H_GF + floor * this.H_Upper;
      const balconyLevel = this.balconyLevels[floor];
      for (const x of [-3.6, 0, 3.6]) {
        this._createWindowBay(x, floorBase + 1.685, balconyLevel);
      }
    }
  }

  _createWindowBay(x, windowY, floorY) {
    const windowWidth = 1.6;
    const windowHeight = 1.73;
    const recessZ = this.frontZ - 0.42;
    this._addBox(
      "upper-window-recess",
      windowWidth,
      windowHeight,
      0.16,
      this.materials.recess,
      x,
      windowY,
      recessZ,
    );

    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(windowWidth - 0.24, windowHeight - 0.24),
      this.materials.glass,
    );
    pane.name = "upper-window-glass";
    pane.position.set(x, windowY, this.frontZ - 0.32);
    this.group.add(pane);

    const frameZ = this.frontZ + 0.04;
    const frameThickness = 0.11;
    for (const side of [-1, 1]) {
      this._addBox(
        "upper-window-frame",
        frameThickness,
        windowHeight + frameThickness,
        0.12,
        this.materials.frame,
        x + side * (windowWidth / 2),
        windowY,
        frameZ,
      );
    }
    for (const side of [-1, 1]) {
      this._addBox(
        "upper-window-frame",
        windowWidth + frameThickness,
        frameThickness,
        0.12,
        this.materials.frame,
        x,
        windowY + side * (windowHeight / 2),
        frameZ,
      );
    }
    this._addBox("upper-window-mullion", 0.07, windowHeight - 0.08, 0.1, this.materials.frame, x, windowY, frameZ + 0.02);

    const balconyDepth = 1.25;
    const balconyZ = this.frontZ + balconyDepth / 2 - 0.02;
    this._addBox(
      "balcony-slab",
      2.1,
      0.2,
      balconyDepth,
      this.materials.wallTrim,
      x,
      floorY - 0.1,
      balconyZ,
    );

    const railHeight = 0.9;
    const railY = floorY + railHeight / 2;
    const railZ = this.frontZ + balconyDepth - 0.06;
    this._addBox("balcony-front-rail", 2.1, 0.07, 0.07, this.materials.railing, x, floorY + railHeight, railZ);
    this._addBox("balcony-bottom-rail", 2.1, 0.07, 0.07, this.materials.railing, x, floorY + 0.12, railZ);
    for (let post = -2; post <= 2; post++) {
      this._addBox("balcony-rail-post", 0.07, railHeight, 0.07, this.materials.railing, x + post * 0.48, railY, railZ);
    }
    for (const side of [-1, 1]) {
      this._addBox(
        "balcony-side-rail",
        0.07,
        railHeight,
        balconyDepth - 0.08,
        this.materials.railing,
        x + side * 1.02,
        railY,
        this.frontZ + balconyDepth / 2 - 0.02,
      );
    }
  }

  _buildRoof() {
    const roofSurface = this.roofLevel + 0.02;
    this._addBox("flat-roof-slab", this.W, 0.12, this.D, this.materials.roof, 0, this.roofLevel + 0.06, 0);

    const parapetY = roofSurface + this.H_Parapet / 2;
    const parapetThickness = 0.2;
    this._addBox("front-parapet", this.W, this.H_Parapet, parapetThickness, this.materials.wall, 0, parapetY, this.frontZ - parapetThickness / 2);
    this._addBox("rear-parapet", this.W, this.H_Parapet, parapetThickness, this.materials.wall, 0, parapetY, -this.frontZ + parapetThickness / 2);
    for (const side of [-1, 1]) {
      this._addBox(
        "side-parapet",
        parapetThickness,
        this.H_Parapet,
        this.D - 2 * parapetThickness,
        this.materials.wall,
        side * (this.W / 2 - parapetThickness / 2),
        parapetY,
        0,
      );
    }

    this._addBox("stairwell", 2.5, 2, 2.8, this.materials.wallTrim, -2.35, roofSurface + 1, -0.2);
    this._addBox("stairwell-door", 0.85, 1.55, 0.06, this.materials.frame, -2.35, roofSurface + 0.78, 1.24);
    this._addBox("stairwell-cap", 2.7, 0.12, 3, this.materials.roof, -2.35, roofSurface + 2.06, -0.2);

    for (const x of [2.4, 4.3]) {
      const stand = this._addBox("water-tank-stand", 1.35, 0.4, 1.35, this.materials.tankBand, x, roofSurface + 0.2, -1.65);
      stand.castShadow = true;

      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.55, 20), this.materials.tank);
      tank.name = "black-water-tank";
      tank.position.set(x, roofSurface + 1.175, -1.65);
      tank.castShadow = true;
      tank.receiveShadow = true;
      this.group.add(tank);

      for (const y of [roofSurface + 0.62, roofSurface + 1.65]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 8, 24), this.materials.tankBand);
        band.name = "water-tank-band";
        band.rotation.x = Math.PI / 2;
        band.position.set(x, y, -1.65);
        this.group.add(band);
      }
      this._addBox("water-tank-lid", 1.1, 0.08, 1.1, this.materials.tankBand, x, roofSurface + 1.97, -1.65);
    }
  }
}
