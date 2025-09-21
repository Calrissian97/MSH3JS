// ViewHelper.js
// Simple view helper for Three r154 offering custom colors
// Landon Hull aka Calrissian97
// Inspired by fennec's Three.js OrbitControls
import * as THREE from "three";

class ViewHelper extends THREE.Object3D {
  // Static constants
  static HOVER_BACKGROUND_OPACITY = 0.1;
  static HOVER_SCALE_FACTOR = 1.4;
  static BACKGROUND_SPHERE_RADIUS = 1.6;
  static BACK_SPRITE_OPACITY = 0.5;
  static AXIS_LINE_LENGTH = 0.9;
  static AXIS_LINE_WIDTH = 3;
  static POS_X = 0;
  static POS_Y = 1;
  static POS_Z = 2;
  static NEG_X = 3;
  static NEG_Y = 4;
  static NEG_Z = 5;

  // Helper to create a div container with specified size and placement
  static getDomContainer(placement, size) {
    const div = document.createElement("div");
    const style = div.style;

    style.height = `${size}px`;
    style.width = `${size}px`;
    style.borderRadius = "100%";
    style.position = "absolute";
    style.zIndex = "1"; // Ensure it's above other elements

    const [y, x] = placement.split("-");

    style.transform = "";
    style.left = x === "left" ? "0" : x === "center" ? "50%" : "";
    style.right = x === "right" ? "0" : "";
    style.transform += x === "center" ? "translateX(-50%)" : "";
    style.top = y === "top" ? "0" : y === "bottom" ? "" : "50%";
    style.bottom = y === "bottom" ? "0" : "";
    style.transform += y === "center" ? "translateY(-50%)" : "";

    return div;
  }

  static isClick(e, startCoords, threshold = 10) {
    return (
      Math.abs(e.clientX - startCoords.x) < threshold &&
      Math.abs(e.clientY - startCoords.y) < threshold
    );
  }

  static clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }

  constructor(
    camera,
    renderer,
    placement = "bottom-right",
    size = 128,
    // Use default parameter value directly
    axesColors = [
      new THREE.Color(0xFFD700), // X: Gold
      new THREE.Color(0x648FFF), // Y: Light Blue
      new THREE.Color(0x800080), // Z: Purple
    ]
  ) {
    super();

    this.renderer = renderer;
    this.camera = camera;
    this.domElement = renderer.domElement;
    this.axesColors = axesColors;
    this.size = size;

    // Instance properties moved from globals
    this.clock = new THREE.Clock();
    this.targetPosition = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.q1 = new THREE.Quaternion();
    this.q2 = new THREE.Quaternion();
    this.point = new THREE.Vector3();
    this.turnRate = 2 * Math.PI; // turn rate in angles per second
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.mouseStart = new THREE.Vector2();
    this.mouseAngle = new THREE.Vector2();
    this.dummy = new THREE.Object3D();
    this.radius = 0;
    this.enabled = true; // Enable by default

    // Orthographic camera for the helper
    this.orthoCamera = new THREE.OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0, 4);
    this.orthoCamera.position.set(0, 0, 2);

    this.isViewHelper = true;
    this.animating = false;
    this.target = new THREE.Vector3(); // Target for camera focus
    this.dragging = false;
    this.viewport = new THREE.Vector4();
    this.offsetHeight = 0;
    this.orbitControls = null; // Optional OrbitControls reference

    // Create geometry and materials using instance methods
    this.backgroundSphere = this._getBackgroundSphere();
    this.axesLines = this._getAxesLines();
    this.spritePoints = this._getAxesSpritePoints();

    this.add(this.backgroundSphere, this.axesLines, ...this.spritePoints);

    // DOM element setup
    this.domContainer = ViewHelper.getDomContainer(placement, this.size); // Use static method
    // This may cause confusion if the parent isn't the body and doesn't have a `position:relative`
    // Consider adding a check or documentation note about this.
    if (this.domElement.parentElement) {
      this.domElement.parentElement.appendChild(this.domContainer);
    } else {
      console.warn("ViewHelper: Renderer DOM element must have a parent.");
    }


    this.domRect = this.domContainer.getBoundingClientRect();
    this._startListening();

    // Event listener reference for controls
    this.controlsChangeEvent = { listener: () => this.updateOrientation() };

    //this.update(); // Initial update
    // This caused issues with webGPU not having it's viewport yet
    this.updateOrientation(); // Initial orientation sync
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    // If disabling, immediately reset cursor and potentially hide container
    if (!enabled) {
      this.domContainer.style.cursor = ""; // Reset cursor
      this._resetSprites(); // Ensure sprites are not highlighted
      this.backgroundSphere.material.opacity = 0; // Hide background

      this.domContainer.style.zIndex = "-1"; // Hide container behind canvas
      this.domContainer.style.display = "none";
      this.domContainer.style.pointerEvents = "none";

      //const currentSize = this.renderer.getSize(new THREE.Vector2());
      //this.renderer.setViewport(0, 0, currentSize.width, currentSize.height); // Reset viewport to full canvas
      //this.renderer.setScissor(0, 0, currentSize.width, currentSize.height); // Reset scissor to full canvas
      //this.renderer.setScissorTest(false); // Disable scissor test
    } else {
      this.domContainer.style.zIndex = "1"; // Ensure it's above other elements
      this.domContainer.style.display = "block"; // Show the container
      this.domContainer.style.pointerEvents = "auto"; // Enable clicks/hovers
      this.update(); // Update dimensions
    }
  }

  // Safely reads viewport/scissor from renderer, handling WebGPURenderer null returns (Three.js r151+)
  _safeGetViewport(target) {
    if (typeof this.renderer.getViewport === "function") {
      const result = this.renderer.getViewport(target);
      if (result !== null && result !== undefined && typeof result.x === "number") {
        target.copy(result); // WebGLRenderer returns a Vector4
      } else {
        // WebGPURenderer likely returns null or undefined
        target.set(0, 0, this.domElement.clientWidth, this.domElement.clientHeight);
      }
    } else {
      target.set(0, 0, this.domElement.clientWidth, this.domElement.clientHeight);
    }
  }

  _safeGetScissor(target) {
    if (typeof this.renderer.getScissor === "function") {
      const result = this.renderer.getScissor(target);
      if (result !== null && result !== undefined && typeof result.x === "number") {
        target.copy(result);
      } else {
        target.set(0, 0, this.domElement.clientWidth, this.domElement.clientHeight);
      }
    } else {
      target.set(0, 0, this.domElement.clientWidth, this.domElement.clientHeight);
    }
  }

  _startListening() {
    this.domContainer.onpointerdown = (e) => this._onPointerDown(e);
    this.domContainer.onpointermove = (e) => this._onPointerMove(e);
    this.domContainer.onpointerleave = () => this._onPointerLeave();
    // Consider adding resize listener if layout changes affect domRect
  }

  _onPointerDown(e) {
    if (!this.enabled || this.animating === true) return;
    e.preventDefault(); // Prevent default drag behaviors

    this.mouseStart.set(e.clientX, e.clientY);
    const rotationStart = this.euler.copy(this.rotation);
    this._setRadius(); // Update radius based on current camera distance

    const drag = (event) => {
      if (!this.dragging && ViewHelper.isClick(event, this.mouseStart)) return; // Use static method

      if (!this.dragging) {
        this._resetSprites(); // Reset sprite appearance when drag starts
        this.dragging = true;
        if (this.orbitControls) this.orbitControls.enabled = false; // Disable main controls
      }

      // Calculate rotation based on mouse movement
      this.mouseAngle
        .set(event.clientX, event.clientY)
        .sub(this.mouseStart)
        .multiplyScalar((1 / this.domRect.width) * Math.PI); // Scale movement to rotation

      // Apply rotation, clamping vertical rotation
      this.rotation.x = ViewHelper.clamp( // Use static method
        rotationStart.x + this.mouseAngle.y,
        Math.PI / -2 + 0.001, // Add small epsilon to avoid gimbal lock issues
        Math.PI / 2 - 0.001
      );
      this.rotation.y = rotationStart.y + this.mouseAngle.x;
      this.updateMatrixWorld(); // Update helper's matrix

      // Update main camera position and orientation based on helper's rotation
      this.q1.copy(this.quaternion).invert();
      this.camera.position
        .set(0, 0, 1)
        .applyQuaternion(this.q1)
        .multiplyScalar(this.radius)
        .add(this.target);
      // Use camera.quaternion instead of camera.rotation for direct control
      this.camera.quaternion.copy(this.q1);

      this.updateOrientation(false); // Update sprite opacity without reading camera again
    };

    const endDrag = () => {
      document.removeEventListener("pointermove", drag, false);
      document.removeEventListener("pointerup", endDrag, false);

      if (!this.dragging) {
        // If it wasn't a drag, treat as a click
        this._handleClick(e);
      } else {
        this.dragging = false;
        if (this.orbitControls) this.orbitControls.enabled = true; // Re-enable main controls
      }
    };

    // Add temporary listeners to the document for dragging outside the helper
    document.addEventListener("pointermove", drag, false);
    document.addEventListener("pointerup", endDrag, false);
  }

  _onPointerMove(e) {
    if (!this.enabled || this.dragging) return; // Ignore hover during drag
    this.backgroundSphere.material.opacity = ViewHelper.HOVER_BACKGROUND_OPACITY;
    this._handleHover(e);
  }

  _onPointerLeave() {
    if (this.dragging) return; // Ignore leave during drag
    this.backgroundSphere.material.opacity = 0; // Hide background
    this._resetSprites(); // Reset sprite appearance
    this.domContainer.style.cursor = ""; // Reset cursor
  }

  _handleClick(e) {
    const object = this._getIntersectionObject(e);
    if (!object) return; // No sprite clicked

    this.setOrientation(object.userData.type); // Animate to the clicked orientation
  }

  _handleHover(e) {
    const object = this._getIntersectionObject(e);
    this._resetSprites(); // Reset all sprites first

    if (!object) {
      this.domContainer.style.cursor = ""; // Default cursor if nothing hovered
    } else {
      // Highlight the hovered sprite
      object.material.map.offset.x = 0.5; // Show highlighted state from texture atlas
      object.scale.multiplyScalar(ViewHelper.HOVER_SCALE_FACTOR);
      if (this.enabled)
        this.domContainer.style.cursor = "pointer"; // Pointer cursor
    }
  }

  // --- Intersection and Pointer Update ---

  _updatePointer(e) {
    // Convert mouse coords to normalized device coordinates (-1 to +1)
    this.mouse.x = ((e.clientX - this.domRect.left) / this.domRect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - this.domRect.top) / this.domRect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.orthoCamera);
  }

  _getIntersectionObject(event) {
    this._updatePointer(event);
    const intersects = this.raycaster.intersectObjects(this.spritePoints);
    return intersects.length > 0 ? intersects[0].object : null;
  }

  // --- Orientation and Animation ---

  setOrientation(orientation) {
    this._prepareAnimationData(orientation);
    this.animating = true;
  }

  _prepareAnimationData(axis) {
    // Determine target position and quaternion based on the selected axis
    switch (axis) {
      case "+x":
        this.targetPosition.set(1, 0, 0);
        this.targetQuaternion.setFromEuler(new THREE.Euler(0, Math.PI * 0.5, 0));
        break;
      case "+y":
        this.targetPosition.set(0, 1, 0);
        this.targetQuaternion.setFromEuler(new THREE.Euler(-Math.PI * 0.5, 0, 0));
        break;
      case "+z":
        this.targetPosition.set(0, 0, 1);
        this.targetQuaternion.setFromEuler(new THREE.Euler(0, 0, 0)); // Reset Euler for clarity
        break;
      case "-x":
        this.targetPosition.set(-1, 0, 0);
        this.targetQuaternion.setFromEuler(new THREE.Euler(0, -Math.PI * 0.5, 0));
        break;
      case "-y":
        this.targetPosition.set(0, -1, 0);
        this.targetQuaternion.setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, 0));
        break;
      case "-z":
        this.targetPosition.set(0, 0, -1);
        this.targetQuaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0));
        break;
      default:
        console.error("ViewHelper: Invalid axis.", axis);
        return; // Don't prepare animation for invalid axis
    }

    this._setRadius(); // Ensure radius is up-to-date
    this._prepareQuaternions(); // Calculate start and end quaternions for slerp
  }

  _setRadius() {
    // Calculate distance from camera to target (controls target or origin)
    this.radius = this.camera.position.distanceTo(this.target);
  }

  _prepareQuaternions() {
    // Target position relative to the focus point
    this.targetPosition.multiplyScalar(this.radius).add(this.target);

    // Use a dummy object to easily calculate lookAt quaternions
    this.dummy.position.copy(this.target);

    // Current orientation quaternion
    this.dummy.lookAt(this.camera.position);
    this.q1.copy(this.dummy.quaternion);

    // Target orientation quaternion
    this.dummy.lookAt(this.targetPosition);
    this.q2.copy(this.dummy.quaternion);
  }

  _animate(delta) {
    const step = delta * this.turnRate;

    // Slerp camera position
    this.q1.rotateTowards(this.q2, step);
    // Apply rotated quaternion to unit vector, scale by radius, and add target offset
    this.camera.position
      .set(0, 0, 1)
      .applyQuaternion(this.q1)
      .multiplyScalar(this.radius)
      .add(this.target);

    // Slerp camera orientation
    this.camera.quaternion.rotateTowards(this.targetQuaternion, step);

    this.updateOrientation(false); // Update sprites based on new orientation

    // Stop animation when target is reached
    if (this.q1.angleTo(this.q2) === 0) {
      this.animating = false;
    }
  }

  // --- Update and Rendering ---

  update() {
    // Update DOM rect and dimensions needed for pointer calculations
    this.domRect = this.domContainer.getBoundingClientRect();
    // Ensure offsetHeight is read from the correct element if domElement is just the canvas
    this.offsetHeight = this.domElement.clientHeight; // Use clientHeight for canvas size
    this._setRadius(); // Update radius in case camera moved
    //this.renderer.getViewport(this.viewport); // Get main viewport dimensions
    this._safeGetViewport(this.viewport); // Previous method didn't work with webGPU

    this.updateOrientation(); // Sync helper orientation with camera
  }

  updateOrientation(fromCamera = true) {
    if (this.animating && !fromCamera) {
      // If animating and called internally, don't re-read camera quaternion
    } else if (fromCamera) {
      // Sync helper's rotation to be inverse of camera's rotation
      this.quaternion.copy(this.camera.quaternion).invert();
      this.updateMatrixWorld(); // Update helper's matrix
    }

    this._updateSpritesOpacity(); // Adjust sprite visibility based on orientation
  }

  render() {
    if (!this.enabled) return; // Skip rendering if disabled
    const delta = this.clock.getDelta();
    if (this.animating) this._animate(delta);

    // Calculate viewport position for the helper
    const x = this.domRect.left;
    const y = this.renderer.domElement.clientHeight - this.domRect.bottom; // Y is from bottom in WebGL
    //const y = this.offsetHeight - this.domRect.bottom; // Y is from bottom in WebGL

    const currentViewport = new THREE.Vector4();
    //this.renderer.getViewport(currentViewport); // Get current viewport dimensions
    const currentScissor = new THREE.Vector4();
    //this.renderer.getScissor(currentScissor); // Get current scissor dimensions
    const currentScissorTest = this.renderer.getScissorTest(); // Get current scissor test state
    this._safeGetViewport(currentViewport);
    this._safeGetScissor(currentScissor);
  
    // Temporarily change renderer settings for helper rendering
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false; // Don't clear the main scene

    this.renderer.setViewport(x, y, this.size, this.size); // Set helper viewport
    this.renderer.setScissor(x, y, this.size, this.size); // Set scissor to match viewport
    this.renderer.setScissorTest(true); // Enable scissor test

    this.renderer.render(this, this.orthoCamera); // Render the helper scene

    this.renderer.setViewport(currentViewport); // Restore main viewport
    this.renderer.setScissor(currentScissor); // Restore main scissor
    this.renderer.setScissorTest(currentScissorTest); // Restore scissor test state
    this.renderer.autoClear = autoClear; // Restore autoClear setting
  }

  // --- Controls Integration ---

  setControls(controls) {
    // Remove listener from old controls if any
    if (this.orbitControls) {
      this.orbitControls.removeEventListener(
        "change",
        this.controlsChangeEvent.listener
      );
      this.target = new THREE.Vector3(); // Reset target if controls are removed
    }

    if (!controls) {
      this.orbitControls = null;
      return;
    }

    // Set new controls and add listener
    this.orbitControls = controls;
    this.orbitControls.addEventListener("change", this.controlsChangeEvent.listener);
    this.target = this.orbitControls.target; // Use controls' target
    this.updateOrientation(); // Update immediately based on new controls target
  }

  // --- Cleanup ---

  dispose() {
    // Dispose geometries and materials
    this.axesLines.geometry.dispose();
    this.axesLines.material.dispose();
    this.backgroundSphere.geometry.dispose();
    this.backgroundSphere.material.dispose();
    this.spritePoints.forEach((sprite) => {
      if (sprite.material.map) sprite.material.map.dispose();
      sprite.material.dispose();
    });

    // Remove event listeners
    this.domContainer.onpointerdown = null;
    this.domContainer.onpointermove = null;
    this.domContainer.onpointerleave = null;
    if (this.orbitControls) {
      this.orbitControls.removeEventListener(
        "change",
        this.controlsChangeEvent.listener
      );
    }

    // Remove DOM element
    if (this.domContainer.parentElement) {
      this.domContainer.parentElement.removeChild(this.domContainer);
    }
  }

  // --- Internal Geometry/Material Creation ---

  _getAxesLines() {
    const position = [];
    const color = [];

    // Create lines for X, Y, Z axes
    for (let i = 0; i < 3; i++) {
      const axisColor = this.axesColors[i].toArray();
      const start = [0, 0, 0];
      const end = [0, 0, 0];
      end[i] = ViewHelper.AXIS_LINE_LENGTH; // Positive direction

      position.push(...start, ...end);
      color.push(...axisColor, ...axisColor);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(position), 3)
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(color), 3)
    );

    // Note: linewidth > 1 deprecated in modern WebGL, might not have effect
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        linewidth: ViewHelper.AXIS_LINE_WIDTH, // May not work reliably
        vertexColors: true,
        toneMapped: false, // Ensure colors are not affected by scene lighting/tonemapping
      })
    );
  }

  _getBackgroundSphere() {
    const geometry = new THREE.SphereGeometry(ViewHelper.BACKGROUND_SPHERE_RADIUS);
    return new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x888888, // Changed color from black to light gray
        side: THREE.BackSide,
        transparent: true,
        opacity: 0, // Initially hidden, shown on hover
        depthTest: false, // Render behind other helper elements
        depthWrite: false,
        toneMapped: false,
      })
    );
  }

  _getAxesSpritePoints() {
    const axes = ["x", "y", "z"];
    return Array(6)
      .fill(0)
      .map((_, i) => {
        const isPositive = i < 3;
        const axisIndex = i % 3;
        const sign = isPositive ? "+" : "-";
        const axis = axes[axisIndex];
        const color = this.axesColors[axisIndex];

        const sprite = new THREE.Sprite(
          this._getSpriteMaterial(color, isPositive ? axis : null)
        );
        sprite.userData.type = `${sign}${axis}`; // Store axis type for click handling
        sprite.scale.setScalar(isPositive ? 0.6 : 0.4); // Smaller sprites for negative axes
        sprite.position[axis] = isPositive ? 1.2 : -1.2; // Position along the axis
        sprite.renderOrder = 1; // Render sprites above lines/sphere

        return sprite;
      });
  }

  _getSpriteMaterial(color, text = null) {
    const canvas = document.createElement("canvas");
    const size = 64; // Texture size for one state (normal/hover)
    canvas.width = size * 2; // Double width for normal and hover states
    canvas.height = size;

    const context = canvas.getContext("2d");
    const center = size / 2;
    const radius = size / 2 - 2; // Leave a small border

    // --- Draw Normal State ---
    context.beginPath();
    context.arc(center, center, radius, 0, 2 * Math.PI);
    context.closePath();
    context.fillStyle = color.getStyle();
    context.fill();

    // --- Draw Hover State (brighter/different background) ---
    context.beginPath();
    context.arc(size + center, center, radius, 0, 2 * Math.PI);
    context.closePath();
    // Example: Use white background for hover state
    context.fillStyle = "#FFFFFF"; // White background for hover
    context.fill();


    // --- Draw Text (if provided) on both states ---
    if (text !== null) {
      const fontSize = Math.max(24, size * 0.6); // Adjust font size dynamically
      context.font = `bold ${fontSize}px Arial`;
      context.textAlign = "center";
      context.textBaseline = "middle"; // Center text vertically

      // Text on Normal State
      context.fillStyle = "#FFFFFF"; // White text on colored background
      context.fillText(text.toUpperCase(), center, center);

      // Text on Hover State
      context.fillStyle = "#000000"; // Black text on white background
      context.fillText(text.toUpperCase(), size + center, center);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; // Use RepeatWrapping
    texture.repeat.x = 0.5; // Show only half the texture (normal state)

    return new THREE.SpriteMaterial({
      map: texture,
      toneMapped: false,
      transparent: true,
      depthTest: false, // Render sprites without depth testing within the helper
      depthWrite: false,
    });
  }

  _resetSprites() {
    this.spritePoints.forEach((sprite, i) => {
      const isPositive = i < 3;
      const scale = isPositive ? 0.6 : 0.4;
      sprite.scale.set(scale, scale, scale); // Reset scale
      if (sprite.material.map) { // Check if map exists before accessing offset
        sprite.material.map.offset.x = 0; // Reset texture offset to show normal state
      }
    });
  }

  _updateSpritesOpacity() {
    // Determine which side of each axis is facing the camera
    this.point.set(0, 0, 1).applyQuaternion(this.camera.quaternion); // Camera's forward vector in world space

    // Adjust opacity based on camera direction relative to each axis
    const setOpacity = (posSprite, negSprite, axisValue) => {
      const posOpacity = axisValue >= 0 ? 1 : ViewHelper.BACK_SPRITE_OPACITY;
      // Ensure material exists before setting opacity
      if (posSprite.material) posSprite.material.opacity = posOpacity;
      if (negSprite.material) negSprite.material.opacity = 1 - posOpacity + ViewHelper.BACK_SPRITE_OPACITY; // Ensure back is also visible
    };


    setOpacity(this.spritePoints[ViewHelper.POS_X], this.spritePoints[ViewHelper.NEG_X], this.point.x); // Use static constant
    setOpacity(this.spritePoints[ViewHelper.POS_Y], this.spritePoints[ViewHelper.NEG_Y], this.point.y); // Use static constant
    setOpacity(this.spritePoints[ViewHelper.POS_Z], this.spritePoints[ViewHelper.NEG_Z], this.point.z); // Use static constant
  }
}

export { ViewHelper };
