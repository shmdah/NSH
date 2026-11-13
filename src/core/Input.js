/**
 * Centralised keyboard input.
 *
 * Tracks held and newly pressed keys for the current game frame.
 *
 * Usage:
 *   input.isDown("KeyW")      // held this frame
 *   input.wasPressed("KeyE")  // just pressed (edge)
 */
export class Input {
  constructor(target = window) {
    this.target = target;
    this._down = new Set();
    this._justPressed = new Set();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._preventSpaceScroll = this._preventSpaceScroll.bind(this);

    target.addEventListener("keydown", this._onKeyDown);
    target.addEventListener("keyup", this._onKeyUp);
    target.addEventListener("keydown", this._preventSpaceScroll);
    window.addEventListener("blur", this._onBlur);
  }

  _preventSpaceScroll(event) {
    if (event.code === "Space") event.preventDefault();
  }

  _onKeyDown(event) {
    // Don't eat browser shortcuts like Ctrl+R / Cmd+R.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (!this._down.has(event.code)) {
      this._justPressed.add(event.code);
    }
    this._down.add(event.code);
  }

  _onKeyUp(event) {
    this._down.delete(event.code);
  }

  _onBlur() {
    // Window lost focus — drop all held keys so the player doesn't slide.
    this._down.clear();
    this._justPressed.clear();
  }

  isDown(code) {
    return this._down.has(code);
  }

  wasPressed(code) {
    return this._justPressed.has(code);
  }

  /** Called at the end of each frame by the Game orchestrator. */
  endFrame() {
    this._justPressed.clear();
  }

  dispose() {
    this.target.removeEventListener("keydown", this._onKeyDown);
    this.target.removeEventListener("keydown", this._preventSpaceScroll);
    this.target.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    this._down.clear();
    this._justPressed.clear();
  }
}