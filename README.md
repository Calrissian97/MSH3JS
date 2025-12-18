![App Logo](https://calrissian97.github.io/MSH3JS/android-chrome-192x192.png)
# MSH3JS - 3D Model Viewer
MSH3JS is a feature-rich 3D model viewer built with **three.js** r151, specifically designed to render `.msh` files used by Pandemic Studios for their Star Wars Battlefront games as an intermediate mesh format. It supports all in-game material rendertypes, skeletal animations, and can be run as a standalone web application in any modern browser supporting webGL or as a Windows (7+) desktop application or Linux AppImage via Tauri 2.0.

## 🚀 Live Webapp
Check out the live version here: **[calrissian97.github.io/MSH3JS/](https://calrissian97.github.io/MSH3JS/)**
This mobile-friendly version requires at least webGL1 hardware and browser support, and lacks features of the Tauri release due to browser restrictions.
Features you'll be missing are: Auto-uploading of required textures, .option files, cloth ODFs for cloth simulation parameters, and transparent windows. All other features are preserved!

## 💾 Desktop Application
Binaries for the Windows desktop application can be found in the **[Releases](https://github.com/Calrissian97/MSH3JS/releases)** section of this repository, available as portable executables or installers for arm64 and x64 architectures.

## ✨ Features
-   **Core Engine**: Built on the robust and widely-used **three.js** (r151) library using the mature WebGLRenderer.
-   **File Support**:
    -   **Models**: Parses `.msh` 3D models with a custom ThreeJS loader, MSHLoader.
    -   **Textures**: Loads `.tga` textures and cubemaps, with support for `.hdr` and `.exr` environment maps.
    -   **Option Files**: Parses `.msh.option` files to apply flags like -bump, -scale, -hardskinonly, and -hiresshadow to the model.
    -   **ODF Files**: Parses cloth ODF files to pull cloth material and wind parameters for cloth simulation.
-   **Multiple files**:
    -   **Scene Creation**: Multiple msh files can be uploaded with controls for their position, rotation, and scale.
    -   **Weapon Preview**: If a unit and weapon model are uploaded the weapon mesh will be constrained to the unit model (hp_weapons in unit msh, hp_active in weapon msh required).
-   **Interactive Controls**:
    -   **Orbit Controls**: Intuitive camera manipulation (rotate, pan, zoom).
    -   **Axis Helper**: An axis gizmo to easily orient the scene.
    -   **Keyboard Shortcuts**: Quick controls for camera views, resets, and UI toggling.
-   **Physics & Simulation**:
    -   **Cloth Simulation**: Real-time cloth physics for models with cloth, with configurable wind speed and direction.
    -   **Collision Detection**: Basic collision detection for models that include cloth collision primitives (e.g., c_sphere).
    -   **Cloth Constraints**: Imported MSH cloth constraints for shear, bend, and stretch are respected.
    -   **Fixed Points**: Fixed points of a cloth are respected, moving with their weighted bone(s).
-   **Animation System**:
    -   **Apply Animations**: Import animations from separate `.msh` files and apply them to the current model.
    -   **Control Playback**: Animation playback controls: Play, Stop, Speed, and Looping.
    -   **Visualize Bones**: Skeleton visualization helper (For unit models with a clean skeleton hierarchy).
-   **Rendering & Visuals**:
    -   **API Support**: **WebGL** and **WebGL2** rendering APIs, selectable in the tweakpane controls.
    -   **Phong Shading** to better reflect the meshes in-game appearance.
    -   **Post-Processing**: Includes a Bloom pass for glow and emissive effects, adjustable in tweakpane.
    -   **Advanced Lighting**: Two configurable directional lights, one ambient light, shadows for one directional light.
    -   **Customizable Background**: Set a solid color or use an equirectangular image (`.hdr`, `.exr`, `.png`, etc).
    -   **Anti-Aliasing**: MSAA support with configurable sample counts for smooth edges.
    -   **Anisotropic Filtering**: Enhances texture quality on surfaces viewed at an angle.
    -   **Adjustable Pixel Ratio**: Increase the pixel ratio for higher-res visuals, or decrease for better performance.
-   **User Interface**:
    -   **Tweakpane**: A comprehensive UI for controlling all scene, rendering, and animation properties.
    -   **Drag-and-Drop**: Easily load models and textures by dragging them onto the viewer or via the Upload button.
    -   **Performance Stats**: A built-in monitor (`stats-gl`) to track FPS and GPU performance.
-   **Platform Support**:
    -   **Installable Webapp**: Can be installed as a Progressive Web App (PWA) on supported browsers.
    -   **WebXR Ready**: Supports immersive AR and VR experiences on compatible devices.
    -   **Tauri Integration**: Runs as a lightweight, native desktop app with file drop and "Open With" support.
-   **Persistent Settings**: App settings can be saved to localStorage to persist across sessions.

## ⌨️ Controls
The viewer includes a standard set of intuitive controls for scene navigation and interaction.

#### **Mouse Controls**
*   **Left-Click + Drag**: Rotate the camera around the focal point.
*   **Right-Click + Drag** or **Shift/Ctrl + Left-Click + Drag**: Pan the camera horizontally and vertically.
*   **Scroll Wheel**: Zoom in and out.

#### **Keyboard Shortcuts**
*   **`C`**: Toggle the visibility of the Tweakpane controls panel.
*   **`F`**: Frame the camera to fit the entire scene or selected object.
*   **`R`**: Reset the camera to its initial position and orientation.
*   **`O`**: Toggle the camera between Perspective and Orthographic projection.
*   **`X` / `Y` / `Z`**: Snap the camera to the corresponding axis view (X: side, Y: top, Z: front).
*   **`+` / `-`**: Zoom in and out incrementally.
*   **Arrow Keys**: Pan the camera.

## 📷 Screenshots
![MSH Tab](https://calrissian97.github.io/MSH3JS/screenshots/mshTab.png)

![Scene Tab](https://calrissian97.github.io/MSH3JS/screenshots/sceneTab.png)

![Anim Tab](https://calrissian97.github.io/MSH3JS/screenshots/animTab.png)

![Three Tab](https://calrissian97.github.io/MSH3JS/screenshots/threeTab.png)

![App Tab](https://calrissian97.github.io/MSH3JS/screenshots/appTab.png)

## 🛠️ Integration
You can easily embed MSH3JS into any web page.

1.  **Create a container** for the viewer, can be a div named `app` or `msh3js`, otherwise embedded directly into the document.

    ```html
    <div id="app" style="width: 800px; height: 600px; border: 1px solid #333;">
        <!-- The canvas and UI will be created here -->
    </div>
    ```

2.  **Initialize the viewer** in a script tag.

    ```html
    <script type="module">
      // Import the MSH3JS script bundle (Includes MSH3JS, ThreeJS, MeshBVH, stats-gl, and Tweakpane)
      const { default: msh3js } = await import('./msh3js.bundle.js');

      // Start the app when the DOM is ready
      document.addEventListener('DOMContentLoaded', async () => {
        await msh3js.startApp();
      });
    </script>
    ```

3.  **Recommended Styling**
    ```html
    <style>
        /* Include fonts */
        @font-face {
        font-family: 'Aurebesh';
        src: url('./Aurebesh.ttf') format('truetype');
        }
        @font-face {
        font-family: 'Orbitron';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('./Orbitron.woff2') format('woff2');
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }

        /* App styles */
        #app {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        }

        /* App Canvas styles */
        canvas {
        display: block;
        scrollbar-width: none;
        position: relative;
        padding: 0;
        margin: 0;
        }

        /* Tweakpane styles */
        :root {
        --tp-font-family: sans-serif;
        --tp-base-background-color: hsla(0, 0%, 0%, 0.80);
        --tp-base-shadow-color: hsla(0, 0%, 0%, 0.2);
        --tp-button-background-color: hsla(0, 0%, 70%, 1.0);
        --tp-button-background-color-active: hsla(0, 0%, 85%, 0.80);
        --tp-button-background-color-focus: hsla(0, 0%, 80%, 0.80);
        --tp-button-background-color-hover: hsla(0, 0%, 75%, 0.80);
        --tp-button-foreground-color: hsla(0, 0%, 0%, 1.00);
        --tp-container-background-color: hsla(0, 0%, 10%, 0.80);
        --tp-container-background-color-active: hsla(0, 0%, 25%, 0.80);
        --tp-container-background-color-focus: hsla(0, 0%, 20%, 0.80);
        --tp-container-background-color-hover: hsla(0, 0%, 15%, 0.80);
        --tp-container-foreground-color: hsla(0, 0%, 80%, 1.00);
        --tp-groove-foreground-color: hsla(0, 0%, 10%, 1.00);
        --tp-input-background-color: hsla(0, 0%, 10%, 0.90);
        --tp-input-background-color-active: hsla(0, 0%, 25%, 0.90);
        --tp-input-background-color-focus: hsla(0, 0%, 20%, 0.90);
        --tp-input-background-color-hover: hsla(0, 0%, 15%, 0.90);
        --tp-input-foreground-color: hsla(0, 0%, 80%, 1.00);
        --tp-label-foreground-color: hsla(0, 0%, 80%, 1.00);
        --tp-monitor-background-color: hsla(0, 0%, 8%, 0.90);
        --tp-monitor-foreground-color: hsla(0, 0%, 80%, 1.00);
        }

        /* Force selected font on Tweakpane elements */
        #tweakpaneContainer {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1;
        width: 290px;
        /* Define a variable for the font, defaulting to Orbitron */
        --tweakpane-font: "Orbitron";
        }
        #tweakpaneContainer * {
        font-family: var(--tweakpane-font), sans-serif;
        }

        /* Custom scrollbar for Tweakpane root container */
        .tp-rotv::-webkit-scrollbar {
        width: 8px;
        }
        .tp-rotv::-webkit-scrollbar-track {
        background: var(--tp-input-background-color, #1a1a1a);
        border-radius: 4px;
        }
        .tp-rotv::-webkit-scrollbar-thumb {
        background-color: var(--tp-container-foreground-color, #808080);
        border-radius: 4px;
        border: 2px solid var(--tp-input-background-color, #1a1a1a);
        }
        .tp-rotv::-webkit-scrollbar-thumb:hover {
        background-color: var(--tp-button-background-color, #999999);
        }

        /* App loading bar styles */
        #loading-container {
        position: absolute;
        bottom: 30px;
        right: 30px;
        display: none;
        z-index: 2;
        align-items: center;
        color: #FFFFFF;
        font-family: 'Orbitron', sans-serif;
        text-shadow: 1px 1px 2px black;
        }
        #loading-text {
        margin-right: 10px;
        font-size: 1em;
        }
        .loading-sphere {
        display: inline-block;
        width: 15px;
        height: 15px;
        background-color: #648FFF;
        border-radius: 50%;
        margin: 0 4px;
        opacity: 0.2;
        transition: opacity 0.9s ease;
        }
    </style>
    ```

## ⚙️ Configuration Options
You can pass an `options` object to `startApp` to customize the initial state of the viewer. Below is a comprehensive list of available settings.

```javascript
<script type="module">
    // Import the MSH3JS script bundle
    const { default: msh3js } = await import('./msh3js.bundle.js');

    // Start the app when the DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      const options = {
        AA: null, // {boolean} Enable/disable anti-aliasing. Overrides sampleCount if set to false.
        AAsampleCount: null, // {number} Desired anti-aliasing sample count (e.g., 0, 2, 4, 8). 0 disables AA.
        anisotropicFiltering: null,
        ambLightColor: null, // {string} Hex color string for the ambient light (e.g., "#4d4d4d").
        ambLightIntensity: null, // {number} Intensity of the ambient light (e.g., 1.0).
        autoRotate: null, // {boolean} Enable/disable automatic rotation of the camera.
        autoRotateSpeed: null, // {number} Speed of auto-rotation (e.g., 0.5).
        backgroundColor: null, // {string} Hex color string for the scene background (e.g., "#000000").
        backgroundImage: null, // {string} URL or path to a background image (e.g., "test.png").
        /* bloom: {
             enabled: null, // {boolean} Enable/disable bloom
             threshold: null, // {number} Threshold for bloom (0.0 - 1.0).
             strength: null, // {number} Strength of bloom (0.0 - 3.0).
             radius: null, // {number} Radius of bloom (0.0 - 1.0).
        }, */
        /* cloth: {
             enabled: null, // {boolean} Enable/disable cloth simulations.
             windSpeed: null, // {number} Speed of the wind affecting cloth (0.0 - 10.0).
             windDirection: null, // {number} Direction of the wind in degrees (0 - 360).
        }, */
        controlDamping: null, // {boolean} Enable/disable damping for camera controls.
        /* dirLight1: {
             color: null, // {string} Hex color string for the primary directional light.
             intensity: null, // {number} Intensity of the primary directional light.
             azimuth: null, // {number} Azimuth angle in degrees (0 - 360) for primary light direction.
             elevation: null, // {number} Elevation angle in degrees (-90 - 90) for primary light direction.
        }, */
        /* dirLight2: {
             color: null, // {string} Hex color string for the secondary directional light.
             intensity: null, // {number} Intensity of the secondary directional light.
             azimuth: null, // {number} Azimuth angle in degrees (0 - 360) for secondary light direction.
             elevation: null, // {number} Elevation angle in degrees (-90 - 90) for secondary light direction.
        }, */
        displayHelpers: null, // {boolean} If true, enables dirLight, dirLight2, ViewHelper, Grid, and Skeleton helpers.
        displayStats: null, // {boolean} Show/hide the performance stats panel.
        displayTweakpane: null, // {boolean} Show/hide the Tweakpane UI.
        enableShadows: null, // {boolean} Enable/disable shadows.
        GPU: null, // {string} "default", "low-power", or "high-performance".
        pixelRatio: null, // {number} Device pixel ratio multiplier (e.g., 1.0, 2.0).
        renderingAPI: null, // {string} "webgl" or "webgl2". Will fall back if not supported.
        tweakpaneFont: null, // {string} Font family name for Tweakpane (e.g., "Orbitron", "Aurebesh", "sans-serif").
        /* viewHelperColors: {
             x: null, // {number} Hex color for the X-axis (e.g., 0xAA0000).
             y: null, // {number} Hex color for the Y-axis (e.g., 0x00AA00).
             z: null, // {number} Hex color for the Z-axis (e.g., 0x0000AA).
        }, */
        /* xr: {
             AR: null, // {boolean} Enable/disable Augmented Reality (AR) viewing.
             VR: null, // {boolean} Enable/disable Virtual Reality (VR) viewing.
        }, */
        /* size: {
             width: null, // {string} CSS width value for the app container (e.g., "100%", "800px").
             height: null, // {string} CSS height value for the app container (e.g., "100%", "600px").
        }, */
        /* urls: [ // {Array<string>} An array of URLs to MSH, TGA, or msh.option files to load.
             'path/to/your/model.msh',
             'path/to/your/model.msh.option',
             'path/to/your/texture.tga',
        ], */
      };

      msh3js.startApp(options);
    });
</script>
```
Note that these options will override any saved settings.

## 📝 Requirements
-   **Desktop App**: Tauri desktop apps require [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section), this is installed by default in Windows 10+.
-   **Development**: [Node.js/npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Tauri](https://v2.tauri.app/start/prerequisites/) (Only for development).

## 📄 License
This project is licensed under the **GNU General Public License v3.0**. See the `LICENSE` file in the repository for the full license text.
