import { bus } from "../systems/EventBus.js";

export class TouchControls {
  constructor(root, input, camera) {
    this.root = root;
    this.input = input;
    this.camera = camera;

    this.joystickPointerId = null;
    this.cameraPointerId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this._lastCameraX = 0;
    this._lastCameraY = 0;

    this._buildUI();
    this._attachListeners();
  }

  _buildUI() {
    this.joystickBase = document.createElement("div");
    this.joystickBase.className = "touch-joystick-base";
    this.joystickBase.style.display = "none";
    this.root.appendChild(this.joystickBase);

    this.joystickKnob = document.createElement("div");
    this.joystickKnob.className = "touch-joystick-knob";
    this.joystickKnob.style.display = "none";
    this.root.appendChild(this.joystickKnob);

    this.jumpBtn = document.createElement("button");
    this.jumpBtn.className = "touch-jump-btn";
    this.jumpBtn.type = "button";
    this.jumpBtn.textContent = "↑";
    this.jumpBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.input.triggerJump();
    });
    this.root.appendChild(this.jumpBtn);
  }

  _attachListeners() {
    window.addEventListener("pointerdown", this._onPointerDown.bind(this), { passive: false });
    window.addEventListener("pointermove", this._onPointerMove.bind(this), { passive: false });
    window.addEventListener("pointerup", this._onPointerUp.bind(this), { passive: false });
    window.addEventListener("pointercancel", this._onPointerUp.bind(this), { passive: false });
  }

  _onPointerDown(event) {
    if (event.pointerType === "mouse") return;

    const x = event.clientX;
    const y = event.clientY;
    const screenMid = window.innerWidth / 2;

    if (x < screenMid && this.joystickPointerId === null) {
      this.joystickPointerId = event.pointerId;
      this.joystickOrigin = { x, y };

      this.joystickBase.style.display = "block";
      this.joystickBase.style.left = `${x}px`;
      this.joystickBase.style.top = `${y}px`;

      this.joystickKnob.style.display = "block";
      this.joystickKnob.style.left = `${x}px`;
      this.joystickKnob.style.top = `${y}px`;
      event.preventDefault();
      return;
    }

    if (x >= screenMid && this.cameraPointerId === null) {
      this.cameraPointerId = event.pointerId;
      this._lastCameraX = x;
      this._lastCameraY = y;
      event.preventDefault();
    }
  }

  _onPointerMove(event) {
    if (event.pointerId === this.joystickPointerId) {
      const dx = event.clientX - this.joystickOrigin.x;
      const dy = event.clientY - this.joystickOrigin.y;
      const maxDist = 60;
      const dist = Math.hypot(dx, dy);

      let clampedDx = dx;
      let clampedDy = dy;
      if (dist > maxDist) {
        const scale = maxDist / dist;
        clampedDx = dx * scale;
        clampedDy = dy * scale;
      }

      this.joystickKnob.style.left = `${this.joystickOrigin.x + clampedDx}px`;
      this.joystickKnob.style.top = `${this.joystickOrigin.y + clampedDy}px`;
      this.input.setMovementVector(clampedDx / maxDist, -clampedDy / maxDist);
      event.preventDefault();
    }

    if (event.pointerId === this.cameraPointerId) {
      const dx = event.clientX - this._lastCameraX;
      const dy = event.clientY - this._lastCameraY;

      this.camera.yaw -= dx * 0.005;
      this.camera.pitch -= dy * 0.005;
      this.camera.pitch = Math.max(-0.4, Math.min(Math.PI / 2 - 0.1, this.camera.pitch));

      this._lastCameraX = event.clientX;
      this._lastCameraY = event.clientY;
      event.preventDefault();
    }
  }

  _onPointerUp(event) {
    if (event.pointerId === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickBase.style.display = "none";
      this.joystickKnob.style.display = "none";
      this.input.setMovementVector(0, 0);
    }

    if (event.pointerId === this.cameraPointerId) {
      this.cameraPointerId = null;
    }
  }
}
