"use strict";
// msh3js.js - Main for msh3js msh model viewer
// (c) 2025 by Landon Hull aka Calrissian97
// This code is licensed under GPL 3.0

// Module Imports -----------------------------------------------------------
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MSHLoader } from "MSHLoader";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
// Note: The following will be imported dynamically instead
//import { ViewHelper } from "view-helper";
//import { Pane } from "tweakpane";
//import Stats from "stats-gl";
//import "webgl-lint";

// Global app object/namespace for application state and data
const msh3js = {
  // Debugging flag
  debug: true,
  // App options
  options: {
    controlDamping: true, // orbitControls damping
    autoRotate: true, // auto-rotate flag
    autoRotateSpeed: 0.5, // auto-rotate speed
    backgroundColor: "#000000", // background color
    backgroundImage: "test.png", // background image
    enableGrid: true, // Visibility of ground plane
    enableDirLightHelper: true, // Visibility of directional light helper
    enableDirLightHelper2: false, // Visibility of directional light helper
    dirLightColor: "#b3b3b3", // Directional light color
    dirLightIntensity: 1.0, // Directional light intensity
    dirLightAzimuth: 90.0, // Directional light azimuth (Rotation in degrees by Y axis)
    dirLightElevation: 30.0, // Directional light elevation (Rotation in degrees by X axis)
    dirLight2Color: "#ffffff",
    dirLight2Intensity: 0.0, // Disable secondary directional light by default
    dirLight2Azimuth: 270.0,
    dirLight2Elevation: -30.0,
    ambLightColor: "#4d4d4d", // Ambient light color
    ambLightIntensity: 1.0, // Ambient light intensity
    enableViewHelper: false, // Visibility of view helper
    viewHelperColors: { x: 0xAA0000, y: 0x00AA00, z: 0x0000AA }, // View helper colors
    enableShadows: true, // Enable shadows
    preferredGPU: "high-performance", // GPU preference
    aa: false, // anti-aliasing flag
    sampleCount: 0, // sample count
    pixelRatio: 1.0, // pixel ratio
    showStats: false, // Show stats flag
    showSkeleton: false,
    clothSim: true, // Enable cloth simulation
    clothWindSpeed: 2.0, // Wind speed for cloth simulation
    clothWindDirection: 280.0, // Wind direction in degrees (0-360)
    renderingAPI: 'webgl2', // webgl, webgl2, or webgpu
    tweakpaneFont: "Orbitron", // Font for Tweakpane UI
    AR: false, // Enable AR viewing
    VR: false, // Enable VR viewing
    bloomEnabled: false, // Enable bloom effect
    bloomThreshold: 0.85, // Bloom threshold
    bloomStrength: 0.5, // Bloom strength
    bloomRadius: 0.3, // Bloom radius
  },
  // Three.JS objects
  three: {
    // Three.JS loading manager
    loadingManager: null,
    // Three.js texture loader
    textureLoader: null,
    // Three.js exr loader
    exrLoader: null,
    // Three.js hdr loader
    rgbeLoader: null,
    // Three.js tga loader
    tgaLoader: null,
    // Three.JS msh loader
    mshLoader: null,
    // Object(s) constructed from imported msh
    msh: [],
    // Three.JS scene
    scene: null,
    // Three.JS animation mixer
    mixer: null,
    // Three.JS camera
    camera: null,
    // Three.JS orbit orbitControls
    orbitControls: null,
    // Three.JS webGL, webGL2 or webGPU renderer
    renderer: null,
    // Three.JS directional light
    dirLight: null,
    // Three.JS directional light helper
    dirLightHelper: null,
    // Three.JS directional light
    dirLight2: null,
    // Three.JS directional light helper
    dirLightHelper2: null,
    // Three.JS ambient light
    ambLight: null,
    // Three.JS grid helper
    gridHelper: null,
    // Three.JS view gizmo
    viewHelper: null,
    // Skeleton helper
    skeletonHelper: null,
    // Three.JS cube camera for environment mapping
    cubeCamera: null,
    // Camera state for cubecam optimization
    lastCameraPosition: null,
    lastCameraQuaternion: null,
  },
  // Proxy object(s) for tweakpane to decouple from three
  ui: {
    mshName: "Click to upload",
    mshSize: 0,
    mshLastModified: "",
    models: [],
    materials: [],
    missingTextures: [],
    sceneName: "",
    animations: [],
    currentAnimation: 'None',
    animationSpeed: 1.0,
    animationPlaying: false,
    animationLoop: true,
    textureURLs: [],
  },
  // App rendering time
  renderTime: 0.0,
  // App rendering interval (for 30fps animations by default)
  renderInterval: 1000 / 30,
  // (HTML canvas) rendering canvas
  canvas: null,
  // webGL, webGL2, or webGPU rendering context
  context: null,
  // Stats object
  stats: null,
  // Tweakpane GUI Pane object
  pane: null,
  // App size
  size: null,
  // Splashscreen svg
  splashScreen: null,
  // App listener flags
  _listeners: {
    fileDrop: null,
    fileInput: null,
    resize: null,
  },
  // (HTML div) container for app and canvas
  _appContainer: null,
  // (HTML div) container for tweakpane controls
  _tweakpaneContainer: null,
  // Loading bar elements
  _loadingBar: {
    container: null,
    spheres: [],
  },
  // service worker
  _serviceWorker: null,
  // Dynamically Imported modules (ViewHelper, Stats, Tweakpane, webgl-lint)
  _modules: {},
  // Input files
  _files: {},
  // Animation-only input files
  _animFiles: {},
  // HTML file input
  _fileInput: null,
  // Client capabilities
  _supportedFeatures: {
    webGL: { supported: false, aa: false, maxSamples: 0, reverseDepth: false, sampleCountOptions: [] }, // WebGL support flag
    webGL2: { supported: false, aa: false, maxSamples: 0, reverseDepth: true, sampleCountOptions: [] }, // WebGL2 support flag
    localStorage: false, // LocalStorage support flag
    persistentStorage: false, // PersistentStorage support flag
    _serviceWorker: false, // ServiceWorker support flag
  },
  // Reverse depth buffer flag (for large geometries)
  _useReverseDepth: false,

  // Initializes app state and populates msh3js object
  async initApp(params) {
    if (msh3js.debug) console.log("initApp::params:", params);

    // Test for localStorage permissions
    if (window.localStorage) {
      const testItem = "__storage_test__";
      try {
        window.localStorage.setItem(testItem, testItem);
        window.localStorage.removeItem(testItem);
        msh3js._supportedFeatures.localStorage = true;
        if (msh3js.debug) console.log("initApp::localStorage available.");
      } catch (e) {
        console.error("initApp::localStorage error:", e);
      }
    }

    // Update options object from localStorage (User preferences)
    if (msh3js._supportedFeatures.localStorage) {
      if (localStorage.getItem("msh3js_options")) {
        Object.assign(
          msh3js.options,
          JSON.parse(localStorage.getItem("msh3js_options"))
        );
        if (msh3js.debug)
          console.log(
            "initApp::msh3js_options object loaded from localStorage."
          );
      }
    }

    // Get canvas and canvas container
    msh3js.canvas = params.appCanvas;
    msh3js._appContainer = params._appContainer;

    // Get loading bar elements
    msh3js._loadingBar.container = document.getElementById("loading-container");
    msh3js._loadingBar.spheres = document.querySelectorAll(".loading-sphere");


    // Process passed app options (Overrides options from localStorage if present)
    if (params.AA != null) msh3js.options.aa = params.AA;
    if (params.AAsampleCount != null)
      msh3js.options.sampleCount = params.AAsampleCount;
    if (params.autoRotate != null)
      msh3js.options.autoRotate = params.autoRotate;
    if (params.autoRotateSpeed != null)
      msh3js.options.autoRotateSpeed = params.autoRotateSpeed;
    if (params.backgroundColor != null)
      msh3js.options.backgroundColor = params.backgroundColor;
    if (params.backgroundImage != null)
      msh3js.options.backgroundImage = params.backgroundImage;
    if (params.controlDamping != null)
      msh3js.options.controlDamping = params.controlDamping;
    if (params.displayHelpers != null) {
      msh3js.options.enableDirLightHelper = params.displayHelpers;
      msh3js.options.enableDirLightHelper2 = params.displayHelpers;
      msh3js.options.enableViewHelper = params.displayHelpers;
      msh3js.options.enableGrid = params.displayHelpers;
    }
    if (params.displayShadows != null)
      msh3js.options.enableShadows = params.displayShadows;
    if (params.displayStats != null)
      msh3js.options.showStats = params.displayStats;
    if (params.GPU != null) msh3js.options.preferredGPU = params.GPU;

    // Get pixel ratio
    msh3js.options.pixelRatio =
      params.pixelRatio ??
      msh3js.options.pixelRatio ??
      window.devicePixelRatio ??
      1.0;
    if (msh3js.debug)
      console.log("initApp::pixelRatio:", msh3js.options.pixelRatio);

    // Get canvas size and record
    msh3js.size = {
      width: msh3js.canvas.clientWidth * msh3js.options.pixelRatio,
      height: msh3js.canvas.clientHeight * msh3js.options.pixelRatio,
    }
    if (msh3js.debug)
      console.log("initApp::appSize:", msh3js.size.width, "x", msh3js.size.height);

    // Register service worker to serve app content
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js");
        msh3js._serviceWorker = registration.active;
        msh3js._supportedFeatures._serviceWorker = true;
        if (msh3js.debug) console.log("initApp::Service Worker registered with scope:",
          registration.scope);
      } catch (e) {
        console.error("initApp::Service Worker registration failed:", e);
      }
      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.action === 'reload') {
          console.log('Service Worker requested page reload.');
          window.location.reload();
        }
      });
    }
    // Get supported graphics features
    await msh3js.getSupportedGraphicsFeatures();

    // Have webGL2 as default, webGL as fallback, webGPU as final option
    if (msh3js._supportedFeatures.webGL2.supported === true) {
      if (msh3js._supportedFeatures.webGL2.aa === true) {
        msh3js.options.aa = true; // Enable AA if supported by default
        msh3js.options.sampleCount = 2; // Set sample count to 2x by default
      }
    } else if (msh3js._supportedFeatures.webGL.supported === true) {
      if (msh3js._supportedFeatures.webGL.aa === true) {
        msh3js.options.aa = true;
        msh3js.options.sampleCount = 2;
      }
    }
    else {
      // No supported graphics API found
      console.error("initApp::No supported graphics API found.");
      return null;
    }

    // Check for persistent storage
    msh3js.getPersistentStorageSupport();

    if (msh3js.debug)
      console.log("initApp::Supported features:", msh3js._supportedFeatures);

    // Get launch files (if any)
    if (await msh3js.getLaunchFiles() === true) {
      await msh3js.processFiles(msh3js._files);
    }
    // Create file input and display splashscreen
    msh3js.createFileInput();
    msh3js.manageListeners("add", "fileDropCanvas");
    msh3js.manageListeners("add", "resize");
    if (msh3js.debug) console.log("initApp::msh3js initialized", msh3js);
    // Return app object
    return msh3js;
  },

  // Main entrypoint that calls initApp with passed params and sets render method
  async startApp(
    canvas = null,
    options = {
      AA: null,
      AAsampleCount: null,
      ambientLighting: null,
      autoRotate: null,
      autoRotateSpeed: null,
      backgroundColor: null,
      backgroundImage: null,
      controlDamping: null,
      dirLight: null,
      dirLight2: null,
      displayHelpers: null,
      displayShadows: null,
      displayStats: null,
      displayTweakpane: null,
      GPU: null,
      pixelRatio: null,
    }
  ) {
    if (msh3js.debug) {
      // Check for passed options
      let optionsPassed = false;
      for (const key in options) {
        if (options[key] !== null) {
          optionsPassed = true;
          break;
        }
      }
      console.log("startApp::canvas:", canvas);
      console.log("startApp::options:", optionsPassed ? options : "defaults");
    }

    // Get canvas container (a div or the body if not found)
    let _appContainer = document.getElementById("app") ?? document.getElementById("msh3js") ?? document.body;
    msh3js._tweakpaneContainer = document.getElementById("tweakpaneContainer") ?? document.createElement("div");
    msh3js._tweakpaneContainer.id = "tweakpaneContainer";

    // Make the container draggable
    msh3js.makeDraggable(msh3js._tweakpaneContainer);
    msh3js.makeResizable(msh3js._tweakpaneContainer);

    _appContainer.appendChild(msh3js._tweakpaneContainer);
    // Either get canvas from param or from HTML or create a new one and append it to the container
    let appCanvas = canvas ?? _appContainer.getElementById("msh3jsCanvas") ??
      _appContainer.querySelector("canvas") ??
      msh3js.createCanvas({ id: "msh3jsCanvas", width: msh3js.size.width, height: msh3js.size.height }, true);

    // Get passed app options
    const params = { appCanvas: appCanvas, _appContainer: _appContainer };
    if (options.AA !== null) params.aa = options.AA;
    if (options.AAsampleCount !== null)
      params.sampleCount = options.AAsampleCount;
    if (options.ambientLighting !== null)
      params.ambientLighting = options.ambientLighting;
    if (options.autoRotate !== null) params.autoRotate = options.autoRotate;
    if (options.autoRotateSpeed !== null)
      params.autoRotateSpeed = options.autoRotateSpeed;
    if (options.backgroundColor !== null)
      params.backgroundColor = options.backgroundColor;
    if (options.backgroundImage !== null)
      params.backgroundImage = options.backgroundImage;
    if (options.controlDamping !== null)
      params.controlDamping = options.controlDamping;
    if (options.dirLight !== null) params.dirLight = options.dirLight;
    else params.dirLight = { color: "#b3b3b3", intensity: 1.0, azimuth: 90.0, elevation: 30.0 };
    if (options.dirLight2 !== null) params.dirLight2 = options.dirLight2;
    else params.dirLight2 = { color: "#ffffff", intensity: 0.0, azimuth: -90.0, elevation: -30.0 };
    if (options.displayHelpers !== null)
      params.displayHelpers = options.displayHelpers;
    if (options.displayShadows !== null)
      params.displayShadows = options.displayShadows;
    if (options.displayStats !== null)
      params.displayStats = options.displayStats;
    if (options.displayTweakpane !== null)
      params.displayTweakpane = options.displayTweakpane;
    if (options.GPU !== null) params.preferredGPU = options.GPU;
    if (options.pixelRatio !== null) params.pixelRatio = options.pixelRatio;

    if (msh3js.debug)
      if (!msh3js._modules.webglLint)
        msh3js._modules.webglLint = await import("webgl-lint");

    msh3js.params = params;
    // Initialize the app object
    const initialized = await msh3js.initApp(params);
    if (!initialized) {
      console.error("startApp::Failed to initialize app:", msh3js);
      // Alert the user about the requirement
      alert("Error: This application requires WebGL(1|2) or WebGPU graphics support to run.\n\n" +
        "Please try using a modern browser like Chrome, Firefox, Edge, or Safari," +
        " or check your browser's settings to ensure WebGL/WebGPU is enabled."
      );
      return msh3js;
    }
    if (msh3js.debug) console.log("startApp: App started.");
    await msh3js.startThree(params);
  },

  // Add or remove Stats.js from app
  async initStats(enabled = true) {
    if (enabled === true) {
      if (!msh3js.stats) {
        // Check if Stats is already imported
        let Stats;
        if (msh3js._modules.Stats)
          Stats = msh3js._modules.Stats;
        else {
          const statsModule = await import("stats-gl");
          Stats = statsModule.default;
          msh3js._modules.Stats = Stats;
        }

        if (msh3js.three.renderer) {
          // Initialize stats
          const stats = new Stats({
            trackGPU: true,
            trackHz: true,
            logsPerSecond: 4,
            graphsPerSecond: 4,
            samplesLog: 40,
            samplesGraph: 40,
            precision: 2,
            mode: 0
          });

          stats.init(msh3js.three.renderer);
          msh3js.stats = stats;
          // Add stats to HTML body if not already present
          if (!msh3js._appContainer.contains(msh3js.stats.dom))
            msh3js._appContainer.appendChild(msh3js.stats.dom);
          if (msh3js.debug)
            console.log(
              "initStats::Stats dom object", msh3js.stats.dom, "appended to HTML body.\n",
              "initStats::Stats initialized:", msh3js.stats);
        }
      }
    } else {
      // Remove stats from HTML body if already present
      if (msh3js.stats && msh3js._appContainer.contains(msh3js.stats.dom)) {
        const canvas = msh3js.stats.dom.querySelector("canvas");
        if (canvas) msh3js.stats.dom.removeChild(canvas);
        msh3js._appContainer.removeChild(msh3js.stats.dom);
        if (msh3js.debug)
          console.log("initStats::Stats deconstructed and removed from HTML body.");
      }
      msh3js.stats = null;
    }
    return msh3js.stats;
  },

  // Setup any unpopulated three.js components
  async initThree() {
    // Note: This function will not overwrite existing objects
    if (!msh3js.three.scene) msh3js.createScene();
    if (!msh3js.three.camera) msh3js.createCamera();
    if (!msh3js.three.orbitControls) msh3js.createOrbitControls();
    if (!msh3js.three.renderer || !msh3js.context) {
      const { renderer, context } = await msh3js.createRenderer({
        renderingAPI: msh3js._supportedFeatures.webGL2.supported ? "webGL2" : "webGL",
        size: msh3js.size,
        pixelRatio: msh3js.options.pixelRatio,
        GPU: msh3js.options.preferredGPU,
        AA: msh3js.options.aa,
        sampleCount: msh3js.options.sampleCount,
        reverseDepth: msh3js._useReverseDepth,
        canvas: msh3js.canvas,
      });
      msh3js.three.renderer = renderer;
      msh3js.context = context;
    }
    if (!msh3js.three.loadingManager)
      msh3js.createLoaders();
    if (!msh3js.three.viewHelper)
      if (msh3js.options.enableViewHelper === true)
        await msh3js.createViewHelper();
  },

  // Begins three.js setup and rendering
  async startThree(params = {}) {
    THREE.ColorManagement.enabled = true;
    await msh3js.initThree();

    // Adjust three to passed param options
    if (params.ambientLighting != null) {
      // Set ambient light color and intensity THREE MUST EXIST
      msh3js.three.ambLight.color.set(params.ambientLighting.color);
      msh3js.three.ambLight.intensity = params.ambientLighting.intensity;
    } else {
      msh3js.three.ambLight.color.set(msh3js.options.ambLightColor);
      msh3js.three.ambLight.intensity = msh3js.options.ambLightIntensity;
    }
    if (params.dirLight != null) {
      // Set directional light color and intensity THREE MUST EXIST
      msh3js.three.dirLight.color.set(params.dirLight.color);
      msh3js.three.dirLight.intensity = params.dirLight.intensity;
    } else {
      msh3js.three.dirLight.color.set(msh3js.options.dirLightColor);
      msh3js.three.dirLight.intensity = msh3js.options.dirLightIntensity;
    }
    if (params.dirLight2 != null) {
      // Set directional light color and intensity THREE MUST EXIST
      msh3js.three.dirLight2.color.set(params.dirLight2.color);
      msh3js.three.dirLight2.intensity = params.dirLight2.intensity;
    } else {
      msh3js.three.dirLight2.color.set(msh3js.options.dirLight2Color);
      msh3js.three.dirLight2.intensity = msh3js.options.dirLight2Intensity;
    }
    // Optionally set up tweakpane and stats if needed
    if (params.displayTweakpane !== false) {
      await msh3js.initTweakpane(params.displayTweakpane);
    }
    if (msh3js.debug === true) msh3js.options.showStats = true;
    if (params.showStats !== false) {
      await msh3js.initStats(msh3js.options.showStats);
    }
    // Set animation loop
    if (msh3js.three.renderer) {
      msh3js.three.renderer.setAnimationLoop(msh3js.render);
    }
    if (msh3js.debug) console.log("startThree: Three.js started.");
  },

  // Setup and return tweakpane pane
  async initTweakpane(enabled = true) {
    // Dispose of any existing pane to prevent duplicates
    if (msh3js.pane) msh3js.pane.dispose();
    if (enabled === false) return null;

    // Dynamically import Tweakpane and its plugins if they haven't been loaded yet.
    let Pane, TweakpanePluginHtmlColorPicker;
    if (msh3js._modules.Pane) {
      Pane = msh3js._modules.Pane;
      TweakpanePluginHtmlColorPicker = msh3js._modules.TweakpanePluginHtmlColorPicker;
    } else {
      // Otherwise, import tweakpane and plugins
      const tweakpaneModule = await import("tweakpane");
      if (msh3js.debug) console.log("initTweakpane::Tweakpane Module:", tweakpaneModule, "imported.");
      TweakpanePluginHtmlColorPicker = await import("tweakpane-plugin-html-color-picker");
      if (msh3js.debug) console.log("initTweakpane::Tweakpane Plugin Module:", TweakpanePluginHtmlColorPicker, "imported.");
      Pane = tweakpaneModule.Pane;
      msh3js._modules.Pane = Pane;
      msh3js._modules.TweakpanePluginHtmlColorPicker = TweakpanePluginHtmlColorPicker;
    }
    // Initialize the main Tweakpane instance and register the imported plugins.
    const pane = new Pane({ title: "Controls", expanded: true, container: msh3js._tweakpaneContainer }); // Main pane
    pane.registerPlugin(TweakpanePluginHtmlColorPicker);
    // Create the main tab layout for organizing controls.
    const tab = pane.addTab({
      pages: [
        // Tabs for orbitControls and app settings
        { title: "MSH" },
        { title: "Scene" },
        { title: "Anim" },
        { title: "Three" },
        { title: "App" },
      ],
    });
    const mshTab = tab.pages[0];
    const controlsTab = tab.pages[1];
    const animationsTab = tab.pages[2];
    const threeTab = tab.pages[3];
    const appSettingsTab = tab.pages[4];

    // MSH Info Folder: Display read-only information about the loaded MSH file.
    const mshFileNameBinding = mshTab.addBinding(
      msh3js.ui,
      "mshName",
      { label: "Filename:", readonly: true }
    );
    mshFileNameBinding.element.style.cursor = "pointer";
    mshFileNameBinding.element.addEventListener("click", msh3js.clickFileInput);

    const mshFileSizeBinding = mshTab.addBinding(
      msh3js.ui,
      "mshSize",
      { label: "Filesize:", readonly: true, format: (v) => `${Math.round(v)} bytes` }
    );
    const mshFileLastModBinding = mshTab.addBinding(
      msh3js.ui,
      "mshLastModified",
      { label: "Last Modified:", readonly: true }
    );
    const mshFileSceneNameBinding = mshTab.addBinding(
      msh3js.ui,
      "sceneName",
      { label: "Scene Name:", readonly: true }
    );
    mshTab.addBlade({ view: "separator" });

    // Models Folder: Create a folder for each model within the MSH file.
    const mshModelsFolder = mshTab.addFolder({ title: "Models", expanded: true });
    for (let i = 0; i < msh3js.ui.models.length; i++) {
      const model = msh3js.ui.models[i];
      if (msh3js.debug) console.log("initTweakpane::Model: ", model, "added to pane.");
      const modelFolder = mshModelsFolder.addFolder({ title: model.name, expanded: false });
      // Store original transforms if they don't exist
      if (!model.userData.originalPosition) {
        model.userData.originalPosition = model.position.clone();
      }
      if (!model.userData.originalRotation) {
        model.userData.originalRotation = model.rotation.clone();
      }
      modelFolder.addBinding(model, "visible", { label: "Visible" });

      // Position and Rotation Folders (only for non-cloth meshes)
      if (!model.userData.isCloth) {
        const positionFolder = modelFolder.addFolder({ title: "Position", expanded: true });
        positionFolder.addBinding(model.position, "x", { min: -100, max: 100, step: 0.1, label: "X" });
        positionFolder.addBinding(model.position, "y", { min: -100, max: 100, step: 0.1, label: "Y" });
        positionFolder.addBinding(model.position, "z", { min: -100, max: 100, step: 0.1, label: "Z" });
        positionFolder.addButton({ title: "Reset" }).on("click", () => {
          if (model.userData.originalPosition) {
            model.position.copy(model.userData.originalPosition);
            // Tweakpane doesn't automatically refresh bound values on external changes,
            // so we need to tell it to refresh.
            pane.refresh();
          }
        });

        const rotationFolder = modelFolder.addFolder({ title: "Rotation", expanded: true });
        rotationFolder.addBinding(model.rotation, "x", { min: -Math.PI, max: Math.PI, step: 0.01, label: "X" })
          .on('change', (ev) => {
            model.rotation.x = ev.value;
          });
        rotationFolder.addBinding(model.rotation, "y", { min: -Math.PI, max: Math.PI, step: 0.01, label: "Y" }).on(
          "change",
          (ev) => {
            model.rotation.y = ev.value;
          }
        );
        rotationFolder.addBinding(model.rotation, "z", { min: -Math.PI, max: Math.PI, step: 0.01, label: "Z" })
          .on('change', (ev) => {
            model.rotation.z = ev.value;
          });
        rotationFolder.addButton({ title: "Reset" }).on("click", () => {
          if (model.userData.originalRotation) {
            model.rotation.copy(model.userData.originalRotation);
            pane.refresh();
          }
        });
      }

      // Vertex Colors Toggle
      if (model.geometry.attributes.color != null && model.geometry.attributes.color.count > 0) {
        // If the model has vertex colors, add a toggle to enable/disable them.
        model.userData.vertexColors = true;
        modelFolder.addBinding(model.userData, "vertexColors", { label: "Vertex Colors" }).on("change", () => {
          // When toggled, update the vertexColors property on all of the mesh's materials.
          for (let mat of model.material)
            mat.vertexColors = model.userData.vertexColors;
        });
      }
    }
    mshTab.addBlade({ view: "separator" });
    // Materials in the msh
    const mshMaterialsFolder = mshTab.addFolder({ title: "Materials", expanded: true }); // Main folder for all materials.
    for (let i = 0; i < msh3js.ui.materials.length; i++) {
      const material = msh3js.ui.materials[i];
      if (msh3js.debug) console.log("initTweakpane::Material: ", material, "added to pane.");

      // Define the four possible texture slots from the MSH material data.
      const textureSlots = {
        'TX0D': material.texture ?? material.matd.tx0d ?? 'Unassigned',
        'TX1D': material.texture ? 'Unassigned' : material.matd.tx1d ?? 'Unassigned',
        'TX2D': material.texture ? 'Unassigned' : material.matd.tx2d ?? 'Unassigned',
        'TX3D': material.texture ? 'Unassigned' : material.matd.tx3d ?? 'Unassigned',
      };

      // Create a sub-folder for this specific material.
      const materialFolder = mshMaterialsFolder.addFolder({ title: material.name, expanded: false });
      materialFolder.addBinding(material.three, "wireframe", { label: "Wireframe" });

      // Add a sub-folder for material attributes if they exist
      if (material.matd && material.matd.atrb) {
        const atrbFolder = materialFolder.addFolder({ title: "Attributes", expanded: true });
        // Find the name of the active render type
        const renderTypeName = Object.keys(material.matd.atrb.renderFlags).find(key => material.matd.atrb.renderFlags[key] === true) || 'unknown';
        atrbFolder.addBinding(material.matd.atrb, 'renderType', {
          readonly: true,
          label: "Render Type",
          format: (v) => `${v} (${renderTypeName})`,
        });

        // Conditionally show data0 and data1 for relevant render types
        const renderType = material.matd.atrb.renderType;
        if ([3, 7, 11, 25].includes(renderType)) { // scrolling, animated, detail, pulsate
          atrbFolder.addBinding(material.matd.atrb, 'data0', { readonly: true, label: "Data 0" });
          atrbFolder.addBinding(material.matd.atrb, 'data1', { readonly: true, label: "Data 1" });
        }
        // Add bitFlags directly to the attributes folder
        for (const [flag, isEnabled] of Object.entries(material.matd.atrb.bitFlags)) {
          if (isEnabled) {
            atrbFolder.addBinding({ [flag]: isEnabled }, flag, { readonly: true });
          }
        }
      }

      if (textureSlots.TX0D !== 'Unassigned') {
        const texturesFolder = materialFolder.addFolder({ title: "Textures", expanded: true });
        // List all assigned textures, add missing textures to the array
        for (const [label, textureName] of Object.entries(textureSlots)) {
          if (textureName !== 'Unassigned') {
            // Create a text input to display the filename.
            const textureControl = texturesFolder.addBinding(textureSlots, label, {
              label: label,
              readonly: true,
            });
          }
        }
      }
    }

    // Missing Textures Folder: Display textures that are required but not yet loaded.
    if (msh3js.ui.missingTextures.length > 0) {
      mshTab.addBlade({ view: "separator" });
      const missingTexturesFolder = mshTab.addFolder({ title: "Missing Textures", expanded: true });
      missingTexturesFolder.addBlade({ view: 'separator' });
      // Add a read-only text field for each missing texture.
      msh3js.ui.missingTextures.forEach((textureName, index) => {
        const dummy = { file: textureName };
        missingTexturesFolder.addBinding(dummy, 'file', { readonly: true, label: `File ${index + 1}` });
      });
    }

    // Rendering options Folder on the "App" tab.
    const renderingFolder = appSettingsTab.addFolder({ title: "Rendering" });

    // Create AA control(s)
    const aaControlWebgl = msh3js.generateAAControl(msh3js._supportedFeatures.webGL.sampleCountOptions, renderingFolder);
    const aaControlWebgl2 = msh3js.generateAAControl(msh3js._supportedFeatures.webGL2.sampleCountOptions, renderingFolder);

    // Switch visibility of AA controls
    if (msh3js._supportedFeatures.webGL2.supported === true) {
      aaControlWebgl.hidden = true;
      aaControlWebgl2.hidden = false;
    } else {
      aaControlWebgl.hidden = false;
      aaControlWebgl2.hidden = true;
    }

    // Pixel Ratio Slider for performance tuning.
    const pixelRatioControl = renderingFolder
      .addBinding(msh3js.options, "pixelRatio", {
        label: "Pixel Ratio",
        min: 0.25,
        max: 3.0,
        step: 0.25,
      })
      .on("change", async () => {
        if (msh3js.debug)
          console.log("Pixel ratio set to:", msh3js.options.pixelRatio);
        msh3js.three.renderer.setPixelRatio(msh3js.options.pixelRatio);
        msh3js.resize();
      });

    // GPU Preference Control (high-performance vs low-power).
    const gpuControl = renderingFolder
      .addBinding(msh3js.options, "preferredGPU", {
        label: "GPU Preference",
        options: {
          default: "default",
          low: "low-power",
          high: "high-performance",
        },
      })
      .on("change", async () => {
        if (msh3js.debug)
          console.log("GPU Preference set to:", msh3js.options.preferredGPU);
        await msh3js.recreateRenderer();
      });

    // Stats toggle to show/hide the performance monitor.
    const statsControl = renderingFolder
      .addBinding(msh3js.options, "showStats", {
        label: "Show Stats",
      })
      .on("change", async () => {
        await msh3js.initStats(msh3js.options.showStats); // Toggle stats
        if (msh3js.debug)
          console.log("Stats set to:", msh3js.options.showStats);
      });

    // Lights Folder on the "Scene" tab.
    const lightsFolder = controlsTab.addFolder({
      title: "Lights",
      expanded: true,
    });

    const directionalLight1Folder = lightsFolder.addFolder({
      title: "Directional Light 1",
      expanded: true,
    });

    // Controls for the primary directional light.
    directionalLight1Folder.addBinding(msh3js.options, "dirLightColor", {
      label: "Color",
      view: "html-color-picker",
    }).on("change", () => {
      msh3js.three.dirLight.color.set(new THREE.Color(msh3js.options.dirLightColor));
      msh3js.three.dirLightHelper.update();
    });
    directionalLight1Folder.addBinding(msh3js.three.dirLight, "intensity", {
      label: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    });
    directionalLight1Folder.addBinding(msh3js.options, "dirLightAzimuth", {
      label: "Azimuth",
      min: 0,
      max: 360,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight, msh3js.options.dirLightAzimuth, msh3js.options.dirLightElevation);
    });
    directionalLight1Folder.addBinding(msh3js.options, "dirLightElevation", {
      label: "Elevation",
      min: -90,
      max: 90,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight, msh3js.options.dirLightAzimuth, msh3js.options.dirLightElevation);
    });
    directionalLight1Folder
      .addBinding(msh3js.options, "enableDirLightHelper", {
        label: "Show Helper",
      })
      .on("change", () => {
        msh3js.three.dirLightHelper.visible =
          msh3js.options.enableDirLightHelper;
        if (msh3js.debug)
          console.log(
            "Directional light helper set to:",
            msh3js.options.enableDirLightHelper ? "on" : "off"
          );
      });

    const directionalLight2Folder = lightsFolder.addFolder({
      title: "Directional Light 2",
      expanded: false,
    });

    // Controls for the secondary directional light.
    directionalLight2Folder.addBinding(msh3js.options, "dirLight2Color", {
      label: "Color",
      view: "html-color-picker",
    }).on("change", () => {
      msh3js.three.dirLight2.color.set(new THREE.Color(msh3js.options.dirLight2Color));
      msh3js.three.dirLightHelper2.update();
    });
    directionalLight2Folder.addBinding(msh3js.three.dirLight2, "intensity", {
      label: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    });
    directionalLight2Folder.addBinding(msh3js.options, "dirLight2Azimuth", {
      label: "Azimuth",
      min: 0,
      max: 360,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight2, msh3js.options.dirLight2Azimuth, msh3js.options.dirLight2Elevation);
    });
    directionalLight2Folder.addBinding(msh3js.options, "dirLight2Elevation", {
      label: "Elevation",
      min: -90,
      max: 90,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight2, msh3js.options.dirLight2Azimuth, msh3js.options.dirLight2Elevation);
    });
    directionalLight2Folder
      .addBinding(msh3js.options, "enableDirLightHelper2", {
        label: "Show Helper",
      })
      .on("change", () => {
        msh3js.three.dirLightHelper2.visible =
          msh3js.options.enableDirLightHelper2;
        if (msh3js.debug)
          console.log(
            "Directional light helper set to:",
            msh3js.options.enableDirLightHelper2 ? "on" : "off"
          );
      });

    // Ambient Light Folder for global, non-directional lighting.
    const ambientLightFolder = lightsFolder.addFolder({
      title: "Ambient Light",
      expanded: true,
    });
    ambientLightFolder.addBinding(msh3js.options, "ambLightColor", {
      label: "Color",
      view: "html-color-picker",
    }).on("change", () => {
      msh3js.three.ambLight.color.set(new THREE.Color(msh3js.options.ambLightColor));
    });
    ambientLightFolder.addBinding(msh3js.three.ambLight, "intensity", {
      label: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    });

    // Background Folder for scene background color and image settings.
    const bgFolder = controlsTab.addFolder({
      title: "Background",
      expanded: true,
    });
    bgFolder
      .addBinding(msh3js.options, "backgroundColor", {
        label: "Background Color",
        view: "html-color-picker",
      })
      .on("change", () => {
        // When color is changed, remove any background image
        msh3js.three.scene.backgroundTexture = null;
        msh3js.three.scene.background = new THREE.Color(
          msh3js.options.backgroundColor
        );
        if (msh3js.debug)
          console.log(
            "Background set to color:",
            msh3js.options.backgroundColor,
            "and image cleared."
          );
      });

    // Button to upload a background image.
    bgFolder.addButton({ title: "Upload Background Image" }).on("click", () => {
      // Create and click a hidden file input.
      msh3js.createBackgroundImageInput().click();
    });

    // View Folder for camera and viewport helper controls.
    const viewFolder = controlsTab.addFolder({
      title: "View",
      expanded: true,
    });

    // Auto-Rotate toggle for the camera.
    const autoRotateControl = viewFolder // Controls for autorotate
      .addBinding(msh3js.options, "autoRotate", { label: "Auto-Rotate" })
      .on("change", () => {
        // Update autorotate directly on controls
        if (msh3js.three.orbitControls) {
          msh3js.three.orbitControls.autoRotate = msh3js.options.autoRotate;
        }
        if (msh3js.debug)
          console.log(
            "AutoRotate set to:",
            msh3js.options.autoRotate ? "on" : "off"
          );
        // Show/hide speed control
        if (autoRotateSpeedControl) autoRotateSpeedControl.hidden = !msh3js.options.autoRotate;
      });

    // Auto-Rotate speed slider.
    const autoRotateSpeedControl = viewFolder // Controls for autorotate speed
      .addBinding(msh3js.options, "autoRotateSpeed", {
        label: "Auto-Rotate Speed",
        min: 0.01,
        max: 20,
      })
      .on("change", () => {
        // Update autorotate speed directly on controls
        if (msh3js.three.orbitControls) {
          msh3js.three.orbitControls.autoRotateSpeed = msh3js.options.autoRotateSpeed;
        }
        if (msh3js.debug)
          console.log(
            "AutoRotateSpeed set to:",
            msh3js.options.autoRotateSpeed
          );
      });
    // Hide initially if autoRotate is off
    if (autoRotateSpeedControl) autoRotateSpeedControl.hidden = !msh3js.options.autoRotate;

    const dampingControl = viewFolder // Camera controls damping (inertia) toggle.
      .addBinding(msh3js.options, "controlDamping", {
        label: "Controls Damping",
      })
      .on("change", () => {
        // Update damping directly on controls
        if (msh3js.three.orbitControls) {
          msh3js.three.orbitControls.enableDamping = msh3js.options.controlDamping;
          msh3js.three.orbitControls.update(); // Apply change immediately if needed
        }
        if (msh3js.debug)
          console.log(
            "Damping set to:",
            msh3js.options.controlDamping ? "on" : "off"
          );
      });

    // Grid plane visibility toggle.
    const gridHelperControl = viewFolder
      .addBinding(msh3js.options, "enableGrid", { label: "Show Grid" })
      .on("change", () => {
        msh3js.three.gridHelper.visible = msh3js.options.enableGrid;
        if (msh3js.debug)
          console.log(
            "Grid helper set to:",
            msh3js.three.gridHelper.visible ? "on" : "off"
          );
      });

    // View Helper (axis gizmo) visibility toggle.
    const viewHelperControl = viewFolder
      .addBinding(msh3js.options, "enableViewHelper", {
        label: "Show Axis Helper",
      })
      .on("change", async () => {
        if (msh3js.options.enableViewHelper === true) {
          if (msh3js.three.viewHelper == null)
            await msh3js.createViewHelper();

          if (msh3js.three.viewHelper.domElement)
            msh3js.three.viewHelper.setEnabled(true);

        } else {
          if (msh3js.three.viewHelper.domElement) {
            msh3js.three.viewHelper.setEnabled(false);
          }
        }
        if (msh3js.debug)
          console.log(
            "View helper set to:",
            msh3js.options.enableViewHelper ? "on" : "off"
          );
      });

    const graphicsApiFolder = threeTab.addFolder({
      title: "Renderer",
      expanded: false,
    });

    graphicsApiFolder.addBinding(msh3js.options, 'renderingAPI', {
      label: 'Graphics API',
      options: {
        'WebGL': 'webgl',
        'WebGL2': 'webgl2',
        'WebGPU': 'webgpu',
      },
    }).on('change', (ev) => {
      if (msh3js.debug) console.log("Graphics API selection changed to:", ev.value);
      // TODO: Implement renderer recreation logic here.
      // For now, we can just log the change.
      // msh3js.recreateRenderer();
    });

    const bloomFolder = threeTab.addFolder({
      title: "Bloom",
      expanded: false,
    });

    bloomFolder.addBinding(msh3js.options, "bloomEnabled", { label: "Enable Bloom" }).on("change", (ev) => {
      if (msh3js.debug) console.log("Bloom set to:", ev.value);
    });

    bloomFolder.addBinding(msh3js.options, "bloomThreshold", {
      label: "Threshold",
      min: 0, max: 1, step: 0.01
    }).on("change", (ev) => {
      if (msh3js.debug) console.log("Bloom threshold set to:", ev.value);
    });

    bloomFolder.addBinding(msh3js.options, "bloomStrength", {
      label: "Strength",
      min: 0, max: 3, step: 0.01
    }).on("change", (ev) => {
      if (msh3js.debug) console.log("Bloom strength set to:", ev.value);
    });

    bloomFolder.addBinding(msh3js.options, "bloomRadius", {
      label: "Radius",
      min: 0, max: 1, step: 0.01
    }).on("change", (ev) => {
      if (msh3js.debug) console.log("Bloom radius set to:", ev.value);
    });

    const clothFolder = threeTab.addFolder({
      title: "Cloth Simulation",
      expanded: true,
    });

    clothFolder.addBinding(msh3js.options, "clothSim", { label: "Enable Cloth Sim" }).on("change", () => {
      if (msh3js.options.clothSim) msh3js.initClothSimulations();
      else msh3js.resetClothSimulations();
      if (msh3js.debug)
        console.log("Cloth simulation set to:", msh3js.options.clothSim ? "on" : "off");
    });

    clothFolder.addBinding(msh3js.options, "clothWindSpeed", {
      label: "Wind Speed",
      min: 0,
      max: 10,
      step: 0.1
    });
    clothFolder.addBinding(msh3js.options, "clothWindDirection", {
      label: "Wind Direction",
      min: 0,
      max: 360,
      step: 1
    });

    const xrFolder = threeTab.addFolder({
      title: "WebXR",
      expanded: false,
    });

    xrFolder.addBinding(msh3js.options, "AR", {
      label: "AR",
    }).on("change", () => {
      //if (msh3js.options.AR) msh3js.initAR();
      //else msh3js.resetAR();
      if (msh3js.debug)
        console.log("AR set to:", msh3js.options.AR ? "on" : "off");
    });

    xrFolder.addBinding(msh3js.options, "VR", {
      label: "VR",
    }).on("change", () => {
      //if (msh3js.options.VR) msh3js.initVR();
      //else msh3js.resetVR();
      if (msh3js.debug)
        console.log("VR set to:", msh3js.options.VR ? "on" : "off");
    });

    // Preferences Folder for saving and clearing settings.
    const preferencesFolder = appSettingsTab.addFolder({
      title: "Preferences",
      expanded: true,
    });

    // Dropdown to select the UI font.
    preferencesFolder.addBinding(msh3js.options, 'tweakpaneFont', {
      label: 'UI Font',
      options: {
        Orbitron: 'Orbitron',
        Aurebesh: 'Aurebesh',
        System: 'sans-serif',
      },
    }).on('change', (ev) => {
      // Update the CSS variable on the container to change the font.
      if (msh3js._tweakpaneContainer) {
        msh3js._tweakpaneContainer.style.setProperty('--tweakpane-font', ev.value);
      }
    });

    // Button to save current app options to localStorage.
    const saveBtn = preferencesFolder.addButton({
      title: "Save",
      label: "Options",
    });
    saveBtn.on("click", () => {
      if (msh3js._supportedFeatures.localStorage === true) {
        window.localStorage.setItem(
          "msh3js_options",
          JSON.stringify(msh3js.options)
        );
        if (msh3js.debug) console.log("User preferences saved.");
      }
    });

    // Button to clear saved preferences from localStorage.
    const cacheBtn = preferencesFolder.addButton({
      title: "Clear",
      label: "",
    });
    cacheBtn.on("click", () => {
      if (msh3js._serviceWorker) {
        msh3js._serviceWorker.postMessage({ action: "clearCache" });
      }
      if (msh3js._supportedFeatures.localStorage) {
        window.localStorage.removeItem("msh3js_options");
      }
    });

    // Animation list
    const animationsFolder = animationsTab.addFolder({
      title: "Animation Selection",
      expanded: true,
    });

    // Animation playback options
    const animationsPlaybackFolder = animationsTab.addFolder({
      title: "Animation Playback",
      expanded: true,
    });

    // Prepare options for the dropdown, starting with the default
    const animOptions = [{ text: 'None', value: 'None' }];
    const allAnimNames = new Set();
    // Populate animation list if they exist
    for (const msh of msh3js.three.msh) {
      if (msh.animations && msh.animations.length > 0) {
        for (const anim of msh.animations) {
          allAnimNames.add(anim.name);
        }
      }
    }
    // Add unique animation names to the dropdown options
    for (const name of allAnimNames) {
      animOptions.push({ text: name, value: name });
    }

    // Button to import additional animations
    animationsTab.addButton({ title: "Import Animations..." }).on("click", () => {
      const animFileInput = msh3js.createAnimationFileInput();
      if (animFileInput) animFileInput.click();
    });

    // Add dropdown to select animation, which will be present even if no model is loaded
    const animationDropdown = animationsFolder.addBinding(msh3js.ui, 'currentAnimation', {
      label: 'Current Animation:',
      options: animOptions,
    }).on('change', (ev) => {
      // When an animation is selected, just stop any currently playing one. Don't auto-play.
      msh3js.stopAllAnimations(false);
    });
    msh3js.ui.animationDropdown = animationDropdown; // Store the reference

    // Add toggle for showing the skeleton
    // Doesn't work correctly

    animationsFolder.addBinding(msh3js.options, 'showSkeleton', {
      label: 'Show Skeleton'
    }).on('change', (ev) => {
      if (msh3js.debug) console.log("Skeleton visibility set to:", ev.value);
      if (msh3js.three.skeletonHelper)
        msh3js.three.skeletonHelper.visible = ev.value;
    });


    // Add slider to adjust playback speed
    animationsPlaybackFolder.addBinding(msh3js.ui, "animationPlaying", {
      label: "Status",
      readonly: true,
      format: (v) => v ? 'Playing' : 'Stopped',
    });

    // Add buttons for starting/stopping
    animationsPlaybackFolder.addButton({ title: "Play" }).on("click", () => {
      if (msh3js.ui.currentAnimation !== 'None') {
        msh3js.playAnimation(msh3js.ui.currentAnimation);
      }
    });

    animationsPlaybackFolder.addButton({ title: "Stop" }).on("click", () => {
      msh3js.stopAllAnimations(false);
    });

    // Add slider to adjust playback speed
    animationsPlaybackFolder.addBinding(msh3js.ui, "animationSpeed", {
      label: "Playback Speed",
      min: 0.1,
      max: 4.0,
      step: 0.1,
    }).on("change", (ev) => {
      if (msh3js.debug) console.log(`Animation speed set to: ${ev.value}`);
      // Update animation mixer speed for all loaded MSH models
      if (msh3js.three.mixer) msh3js.three.mixer.timeScale = ev.value;
    });

    // Add checkbox to toggle looping
    animationsPlaybackFolder.addBinding(msh3js.ui, "animationLoop", {
      label: "Looping",
    }).on("change", (ev) => {
      // If an animation is currently playing, update its loop mode.
      if (msh3js.three.mixer && msh3js.three.mixer._actions.length > 0) {
        msh3js.three.mixer._actions.forEach(action => {
          action.setLoop(ev.value ? THREE.LoopRepeat : THREE.LoopOnce);
          // If we are turning looping off, we need to reset and play to apply the change
          // if the animation was already past its natural end.
          if (!ev.value) {
            action.reset().play();
          }
        });
      }
    });

    // Assign the newly created pane to the global object.
    msh3js.pane = pane;
    if (msh3js.debug)
      console.log("initTweakpane::Tweakpane controls created:", pane);

    // Refresh the pane to ensure all bindings and visibility states are up-to-date.
    msh3js.pane.refresh();

    return pane;
  },

  // Updates just the animation list in Tweakpane without rebuilding the whole UI.
  updateAnimationList() {
    if (!msh3js.pane || !msh3js.ui.animationDropdown) {
      if (msh3js.debug) console.log("updateAnimationList:: Pane or dropdown not ready, skipping update.");
      return;
    }

    if (msh3js.debug) console.log("updateAnimationList:: Refreshing animation dropdown.");

    // Prepare the new list of options, starting with the default 'None'.
    const newAnimOptions = [{ text: 'None', value: 'None' }];
    const allAnimNames = new Set();

    // Gather all unique animation names from all loaded MSH objects.
    for (const msh of msh3js.three.msh) {
      if (msh.animations && msh.animations.length > 0) {
        for (const anim of msh.animations) {
          allAnimNames.add(anim.name);
        }
      }
    }

    // Add the unique names to our options list.
    for (const name of allAnimNames) {
      newAnimOptions.push({ text: name, value: name });
    }

    // Update the options on the existing Tweakpane control.
    msh3js.ui.animationDropdown.options = newAnimOptions;
  },

  // Manages listeners by group (renderTrigger, resize, fileDrop) and action (add/remove)
  manageListeners(action, group) {
    if (msh3js.debug) console.log("manageListeners::params::action:", action, "group:", group);

    if (group === "fileDropCanvas") {
      const dropZone = msh3js.canvas ?? msh3js._appContainer.getElementById("msh3jsCanvas") ?? msh3js.createCanvas({ id: "msh3jsCanvas", width: msh3js.size.width, height: msh3js.size.height });
      if (dropZone) {
        if (action === "add") {
          if (!msh3js._listeners.fileDrop) {
            try {
              dropZone.addEventListener("dragenter", msh3js.preventDrag);
              dropZone.addEventListener("dragover", msh3js.preventDrag);
              dropZone.addEventListener("drop", msh3js.drop);
              msh3js._listeners.fileDrop = true;
            } catch (e) { console.error("manageListeners::Error adding fileDrop listeners:", e); }
          }
        } else if (action === "remove") {
          if (msh3js._listeners.fileDrop) {
            try {
              dropZone.removeEventListener("dragenter", msh3js.preventDrag);
              dropZone.removeEventListener("dragover", msh3js.preventDrag);
              dropZone.removeEventListener("drop", msh3js.drop);
              msh3js._listeners.fileDrop = null;
            } catch (e) { console.error("manageListeners::Error removing fileDrop listeners:", e); }
          }
        } else {
          console.warn("manageListeners::Unknown action:", action);
        }
      }
    } else if (group === "fileInput") {
      if (action === "add") {
        if (!msh3js._listeners.fileInput) {
          try {
            msh3js._fileInput.addEventListener("change", msh3js.handleFileInput);
            msh3js._listeners.fileInput = true;
          } catch (e) { console.error("manageListeners::Error adding fileInput listener:", e); }
        }
      } else if (action === "remove") {
        if (msh3js._listeners.fileInput) {
          try {
            msh3js._fileInput.removeEventListener("change", msh3js.handleFileInput);
            msh3js._listeners.fileInput = false;
          } catch (e) { console.error("manageListeners::Error removing fileInput listener:", e); }
        }
      }
    } else if (group === "resize") {
      if (action === "add") {
        if (!msh3js._listeners.resize) {
          try {
            window.addEventListener("resize", msh3js.resize);
            msh3js._listeners.resize = true;
          } catch (e) { console.error("manageListeners::Error adding resize listener:", e); }
        }
      } else if (action === "remove") {
        if (msh3js._listeners.resize) {
          try {
            window.removeEventListener("resize", msh3js.resize);
            msh3js._listeners.resize = false;
          } catch (e) { console.error("manageListeners::Error removing resize listener:", e); }
        }
      } else {
        console.warn("manageListeners::Unknown action:", action);
      }
    } else { console.warn("manageListeners::Unknown group:", group); }
  },

  // Main render function
  async render(time) {
    const elapsedTime = (time - (msh3js.renderTime || time)) / 1000.0;
    // If there's a mixer, update it. The speed is handled by mixer.timeScale.
    if (msh3js.three.mixer) msh3js.three.mixer.update(elapsedTime);

    const refractiveMeshes = [];

    // Update scrolling textures
    if (msh3js.three.msh.length > 0) {
      for (const msh of msh3js.three.msh) {
        // Animate materials
        for (const material of msh.materials) {
          // Collect refractive meshes for the cubecam update
          if (material.matd?.atrb?.renderFlags?.refracted) {
            msh.group.traverse((child) => {
              if (child.isMesh && (Array.isArray(child.material) ? child.material.includes(material.three) : child.material === material.three))
                refractiveMeshes.push(child);
            });
          }
          // Handle scrolling textures
          if (material.scrolling && material.three.map?.userData.isScrolling) {
            const scrollData = material.three.map.userData;
            // Use an internal timer to ensure frame-rate independence
            scrollData._scrollTimeU = (scrollData._scrollTimeU + scrollData.scrollSpeedU * elapsedTime) % 1.0;
            scrollData._scrollTimeV = (scrollData._scrollTimeV + scrollData.scrollSpeedV * elapsedTime) % 1.0;
            material.three.map.offset.set(scrollData._scrollTimeU, scrollData._scrollTimeV);
            // Also scroll the specularMap if it exists and is marked for scrolling
            if (material.three.specularMap?.userData.isScrolling) {
              material.three.specularMap.offset.set(scrollData._scrollTimeU, scrollData._scrollTimeV);
            }
          }
          // Handle animated textures
          if (material.three.map?.userData.isAnimated) {
            const animData = material.three.map.userData;
            const { gridSize, totalFrames, fps } = animData;
            animData._animationTime += elapsedTime; // Use internal timer
            const frameDuration = 1 / fps;
            const currentFrame = Math.floor(animData._animationTime / frameDuration) % totalFrames;

            const row = Math.floor(currentFrame / gridSize);
            const col = currentFrame % gridSize;

            // The UVs are mapped to the first cell, so we just need to offset.
            material.three.map.offset.x = (col / gridSize);
            material.three.map.offset.y = -(row / gridSize); // Negative offset to move "down" the texture

            // Also animate the specularMap if it exists and is marked for animation
            if (material.three.specularMap?.userData.isAnimated) {
              material.three.specularMap.offset.copy(material.three.map.offset);
            }
          }
          // Handle pulsating materials
          if (material.pulsate && !material.three.userData.alwaysOn && material.three.userData.pulseSpeed) {
            const { minBrightness, pulseSpeed } = material.three.userData;
            // Scale the raw pulseSpeed (0-255) down to a reasonable frequency for the sine wave.
            const pulse = (1 + Math.sin(time / 1000 * (pulseSpeed / 2))) / 2; // Oscillates between 0 and 1
            const brightness = minBrightness + pulse * (1.0 - minBrightness);
            material.three.color.setScalar(brightness);
          }
        }
        // Update cloth simulation if enabled
        if (msh3js.options.clothSim) {
          if (msh.clothSimulations && msh.clothSimulations.length > 0) {
            for (const clothSim of msh.clothSimulations) {
              msh3js.updateClothSimulation(clothSim, elapsedTime);
            }
          }
        }
      }
    }
    msh3js.renderTime = time;

    msh3js.three.orbitControls.update();

    // Update the cube camera for refraction, only if refractive meshes exist
    if (msh3js.three.cubeCamera && refractiveMeshes.length > 0) {
      // Check if the camera has moved since the last frame
      let cameraMoved = false;
      if (msh3js.three.lastCameraPosition && msh3js.three.lastCameraQuaternion) {
        if (!msh3js.three.lastCameraPosition.equals(msh3js.three.camera.position) ||
          !msh3js.three.lastCameraQuaternion.equals(msh3js.three.camera.quaternion)) {
          cameraMoved = true;
        }
      } else {
        // First frame, always consider it as "moved" to trigger the initial cubemap render
        cameraMoved = true;
      }

      // Only update the cubemap if the camera has moved
      if (cameraMoved) {
        // Calculate the center of all refractive objects
        const center = new THREE.Vector3();
        const box = new THREE.Box3();
        for (const mesh of refractiveMeshes) box.expandByObject(mesh);
        box.getCenter(center);
        msh3js.three.cubeCamera.position.copy(center);

        // Hide refractive objects
        for (const mesh of refractiveMeshes) mesh.visible = false;

        // Update the cubemap
        msh3js.three.cubeCamera.update(msh3js.three.renderer, msh3js.three.scene);

        // Store the new camera state for the next frame's comparison
        msh3js.three.lastCameraPosition.copy(msh3js.three.camera.position);
        msh3js.three.lastCameraQuaternion.copy(msh3js.three.camera.quaternion);

        // Show refractive objects again
        for (const mesh of refractiveMeshes) mesh.visible = true;
      }
    }
    // Clear color buffer
    msh3js.three.renderer.clear(true, true, true);

    // Render a frame
    msh3js.three.renderer.render(
      msh3js.three.scene,
      msh3js.three.camera
    );

    if (msh3js.options.enableViewHelper === true) {
      if (msh3js.three.viewHelper) {
        msh3js.three.renderer.clearDepth();
        msh3js.three.viewHelper.render();
      }
    }

    if (msh3js.options.showStats === true) {
      if (msh3js.stats != null)
        msh3js.stats.update();
    }
  },

  // Determines if canvas and app are out of sync and resizes if so
  resize() {
    if (msh3js.debug)
      console.log(
        "resize::App size is",
        msh3js.size.width,
        "x",
        msh3js.size.height,
        "\nCanvas size is",
        msh3js.canvas.clientWidth,
        "x",
        msh3js.canvas.clientHeight,
        "\nRenderer size is",
        msh3js.canvas.width,
        "x",
        msh3js.canvas.height
      );

    // Update app size to match new canvas size x pixel ratio
    msh3js.size.width =
      msh3js.canvas.clientWidth * msh3js.options.pixelRatio;
    msh3js.size.height =
      msh3js.canvas.clientHeight * msh3js.options.pixelRatio;

    // If the internal buffer is out of sync...
    if (
      msh3js.canvas.width !== Math.floor(msh3js.size.width) ||
      msh3js.canvas.height !== Math.floor(msh3js.size.height)
    ) {
      if (msh3js.debug)
        console.log(
          "resize::Canvas and app out of sync! Resizing renderer to:",
          Math.floor(msh3js.size.width),
          "x",
          Math.floor(msh3js.size.height)
        );

      // Resize renderer
      if (msh3js.three.renderer != null)
        msh3js.three.renderer.setSize(
          Math.floor(msh3js.size.width),
          Math.floor(msh3js.size.height),
          false
        );

      // Resize camera
      if (msh3js.three.camera != null) {
        msh3js.three.camera.aspect =
          msh3js.canvas.clientWidth / msh3js.canvas.clientHeight;
        msh3js.three.camera.updateProjectionMatrix();
      }

      // Resize viewHelper
      if (msh3js.options.enableViewHelper === true)
        msh3js.three.viewHelper.update();

      // Resize splashScreen
      if (msh3js.splashScreen !== null) {
        msh3js.splashScreen.setAttribute("width", msh3js.size.width + "px");
        msh3js.splashScreen.setAttribute("height", msh3js.size.height + "px");
      }
      return true;
    }
    return false;
  },

  // Prevents default drag behavior
  preventDrag(e) {
    e.preventDefault();
    e.stopPropagation();
  },

  // Function to handle file drops
  async drop(e) {
    e.stopPropagation();
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (msh3js.debug) console.log("drop::Files dropped:", droppedFiles);
    msh3js.addFiles(droppedFiles);
    await msh3js.processFiles(msh3js._files);
  },

  // Click file input
  clickFileInput(e) {
    const fileInput = msh3js._fileInput ?? document.getElementById("fileInput") ?? msh3js.createFileInput();
    if (fileInput)
      fileInput.click();
  },

  // Adds input files to a global files object
  addFiles(files) {
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      if ((lowerName.endsWith(".msh") || lowerName.endsWith(".tga") || lowerName.endsWith(".msh.option")) && msh3js._files[lowerName] == null) {
        msh3js._files[lowerName] = {
          file: file,
          url: URL.createObjectURL(file),
          processed: false, // Flag to track if the file has been processed
        };
      }
    }
    if (msh3js.debug) console.log("addFiles::Files added:", files);
  },

  // Process input files for rendering, returns success if msh processed
  async processFiles(files) {
    // Start Three
    if (msh3js.three.scene == null) await msh3js.startThree(msh3js.params);
    // Check for msh files and add them
    let fileProcessed = false;
    const mshFilesToProcess = [];
    // Only process files that have not been processed yet
    const filesToProcess = Object.values(msh3js._files).filter(f => !f.processed);
    for (const fileObj of filesToProcess) {
      if (fileObj.file.name.toLowerCase().endsWith(".msh")) {
        // Load msh file with MSHLoader
        const mshScene = await msh3js.three.mshLoader.loadAsync(fileObj.url);
        if (msh3js.debug) console.log("processFiles::Loaded msh:", mshScene);
        // Populate msh data object
        msh3js.three.msh.push(
          {
            fileName: fileObj.file.name,
            fileSize: fileObj.file.size,
            lastModified: fileObj.file.lastModified,
            textures: [],
            requiredTextures: mshScene.userData.textures,
            materials: mshScene.userData.materials,
            models: mshScene.userData.models,
            sceneInfo: mshScene.userData.sceneInfo,
            group: mshScene,
            hasCloth: mshScene.userData.hasCloth,
            hasShadowVolume: mshScene.userData.hasShadowVolume,
            hasVertexColors: mshScene.userData.hasVertexColors,
            animations: mshScene.userData.animations,
            keyframes: mshScene.userData.keyframes,
          }
        );
        mshFilesToProcess.push(msh3js.three.msh.at(-1));
        // Add msh to Three scene
        msh3js.three.scene.add(mshScene);
        fileProcessed = true;
        fileObj.processed = true; // Mark as processed
      }

      // After loading, check for hardpoint attachments
      for (const newMshData of mshFilesToProcess) {
        const newMshScene = newMshData.group;
        const hpActive = newMshScene.getObjectByName('hp_active');

        if (hpActive) {
          if (msh3js.debug) console.log(`processFiles::Found "hp_active" in ${newMshData.fileName}`);

          // Search for 'hp_weapons' in all other loaded meshes
          let hpWeapons = null;
          let parentMshGroup = null;

          for (const existingMsh of msh3js.three.msh) {
            if (existingMsh.group === newMshScene) continue; // Don't check against itself

            const foundHpWeapons = existingMsh.group.getObjectByName('hp_weapons');
            if (foundHpWeapons) {
              hpWeapons = foundHpWeapons;
              parentMshGroup = existingMsh.group;
              break; // Found it, stop searching
            }
          }

          if (hpWeapons) {
            if (msh3js.debug) console.log(`processFiles::Found "hp_weapons" in ${parentMshGroup.name}. Attaching ${newMshData.fileName}.`);

            // Ensure world matrices are up-to-date before calculations
            msh3js.three.scene.updateMatrixWorld(true);

            // Get the world matrices of the hardpoints
            const hpWeaponsMatrix = hpWeapons.matrixWorld.clone();
            const hpActiveMatrix = hpActive.matrixWorld.clone();

            // Calculate the transformation to align hp_active to hp_weapons
            // M = T_weapon * T_active_inverse
            const alignMatrix = new THREE.Matrix4().multiplyMatrices(hpWeaponsMatrix, hpActiveMatrix.invert());

            // Apply this alignment to the new mesh's current world matrix
            newMshScene.matrix.premultiply(alignMatrix);
            newMshScene.matrix.decompose(newMshScene.position, newMshScene.quaternion, newMshScene.scale);
            hpWeapons.attach(newMshScene);
          }
        }
      }

      // After adding the scene, traverse it to find a SkinnedMesh and create a SkeletonHelper
      if (mshFilesToProcess.length > 0) {
        for (const msh of msh3js.three.msh) {
          if (msh3js.three.skeletonHelper) break; // A helper already exists.
          msh.group.traverse((child) => {
            // Create one helper for the first SkinnedMesh found
            if (child.isSkinnedMesh && !msh3js.three.skeletonHelper) {
              msh3js.three.scene.updateMatrixWorld(true);
              const helper = new THREE.SkeletonHelper(child);
              helper.name = "skeletonHelper";
              helper.visible = msh3js.options.showSkeleton;
              msh3js.three.scene.add(helper);
              msh3js.three.skeletonHelper = helper;
            }
          });
        }
      }
    }

    // After loading MSH files, check for and apply .msh.option files
    for (const mshData of msh3js.three.msh) {
      const optionFileName = mshData.fileName.toLowerCase() + ".option";
      const optionFileObj = msh3js._files[optionFileName];

      if (optionFileObj) {
        if (msh3js.debug) console.log(`processFiles::Found option file for ${mshData.fileName}`);
        const optionText = await optionFileObj.file.text();
        const lines = optionText.split(/\r?\n/);

        for (const line of lines) {
          const parts = line.trim().split(/\s+/).filter(p => p); // Split by whitespace and remove empty parts
          for (let i = 0; i < parts.length; i++) {
            const command = parts[i].toLowerCase();

            if (command === "-bump") {
              // Process all subsequent parts as texture names until another flag or the end of the line is found.
              let j = i + 1;
              while (j < parts.length && !parts[j].startsWith('-')) {
                const textureName = parts[j].toLowerCase();
                const bumpTextureName = textureName.replace(/(\.tga)?$/, "_bump.tga");
                if (msh3js.debug) console.log(`processFiles::-bump rule found. Applying ${bumpTextureName} to materials using ${textureName}.tga`);

                // Find materials using this texture and add the bump map requirement
                for (const material of mshData.materials) {
                  if (material.matd?.tx0d?.toLowerCase() === `${textureName}.tga`) {
                    material.matd.tx1d = bumpTextureName; // This will be picked up by the texture loader.
                    mshData.requiredTextures.push(bumpTextureName);
                  }
                }
                j++; // Move to the next part
              }
              i = j - 1; // Update the outer loop index to continue after the processed textures.
            }
          }
        }
        optionFileObj.processed = true; // Mark as processed
        fileProcessed = true;
      }
    }

    // Check for textures and assign them to Three materials if required
    // Iterate over all files for texture assignment, as textures might be needed by newly added models
    for (const fileObj of Object.values(msh3js._files)) {
      if (fileObj.file.name.toLowerCase().endsWith(".tga")) {
        // Check if the texture is required by any of the loaded MSH files.
        let required = false;
        for (const msh of msh3js.three.msh) {
          if (msh.requiredTextures.includes(fileObj.file.name.toLowerCase()) || msh.requiredTextures.includes(fileObj.file.name.toLowerCase().replace(/_bump\.tga$/, '.tga'))) {
            required = true;
            break; // Found a requirement, no need to check other MSH files.
          }
        }
        if (required) {
          // If the texture has already been processed, skip reloading it.
          if (fileObj.processed) continue;

          // Load tga file with TGALoader
          console.log("msh3js::processFiles::Loading texture:", fileObj.file.name);
          let material = null; // Hoist material to be accessible in catch block
          try {
            const ThreeTexture = await msh3js.three.tgaLoader.loadAsync(fileObj.url);
            ThreeTexture.name = fileObj.file.name;
            ThreeTexture.colorSpace = THREE.SRGBColorSpace;
            ThreeTexture.wrapS = THREE.RepeatWrapping;
            ThreeTexture.wrapT = THREE.RepeatWrapping;
            ThreeTexture.flipY = true;

            // Assign texture to all materials in all MSH files that require it.
            for (const msh of msh3js.three.msh) {
              if (!msh.requiredTextures.includes(fileObj.file.name.toLowerCase())) {
                // Also check for existingTextureName + _bump.tga for later .option uploading
                const baseTextureName = fileObj.file.name.toLowerCase().replace(/_bump\.tga$/, '.tga');
                if (!msh.requiredTextures.includes(baseTextureName)) continue;
              }

              msh.textures.push(ThreeTexture);
              for (material of msh.materials) {
                if (material.texture != undefined) {
                  // Handle generated cloth material
                  if (material.texture.toLowerCase() === fileObj.file.name.toLowerCase()) {
                    material.three.map = ThreeTexture;
                    material.three.wireframe = false;
                    if (msh3js.debug) console.log("msh3js::processFiles::Cloth texture found for material:", material);
                    material.three.needsUpdate = true;
                    msh.textures.push(ThreeTexture);
                  }
                }
                if (material.matd != null) {
                  // Handle tx0d (diffuse map)
                  if (material.matd.tx0d && material.matd.tx0d.toLowerCase() === fileObj.file.name.toLowerCase()) {
                    // Assign texture as diffuse map
                    material.three.map = ThreeTexture;
                    material.three.wireframe = false;
                    material.three.needsUpdate = true;
                    msh.textures.push(ThreeTexture);

                    // If the material is specular, extract the alpha channel from the diffuse map.
                    if (material.specular) {
                      const { data, width, height } = ThreeTexture.image;
                      const channels = data.length / (width * height);

                      // Always use RGBAFormat for the DataTexture to ensure consistency.
                      const alphaData = new Uint8Array(width * height * 4);
                      const format = THREE.RGBAFormat;
                      for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
                        const alpha = (channels === 4) ? data[i + 3] : 255;
                        alphaData[j] = alpha;     // R
                        alphaData[j + 1] = alpha; // G
                        alphaData[j + 2] = alpha; // B
                        alphaData[j + 3] = alpha; // A
                      }

                      // Construct new DataTexture from pulled alpha channel
                      const alphaTexture = new THREE.DataTexture(alphaData, width, height, format);
                      alphaTexture.flipY = true;
                      alphaTexture.colorSpace = THREE.LinearSRGBColorSpace;
                      alphaTexture.wrapS = THREE.RepeatWrapping;
                      alphaTexture.wrapT = THREE.RepeatWrapping;
                      alphaTexture.needsUpdate = true;
                      material.three.specularMap = alphaTexture;
                      alphaTexture.name = ThreeTexture.name + "_alpha";
                      msh.textures.push(alphaTexture);
                      if (msh3js.debug) console.log('processFiles::RGBA DataTexture constructed for specularMap from alpha channel.');

                    }

                    if (material.glow) {
                      material.three.emissive = new THREE.Color(0xffffff); // Use white to not tint the map
                      material.three.emissiveMap = ThreeTexture; // The texture itself provides the glow color
                    }

                    // If rendertype is ice refraction
                    if (material.matd.atrb.renderFlags.refracted || material.matd.atrb.renderFlags.ice) {
                      // Create CubeCamera on-demand if it doesn't exist
                      if (!msh3js.three.cubeCamera) {
                        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
                          format: THREE.RGBAFormat,
                          generateMipmaps: true,
                          minFilter: THREE.LinearMipmapLinearFilter
                        });
                        msh3js.three.cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);
                        msh3js.three.cubeCamera.name = "CubeCamera";
                        if (msh3js.debug) console.log("processFiles::CubeCamera created for refraction.");
                      }
                      material.three.envMap = msh3js.three.cubeCamera.renderTarget.texture;
                      material.three.envMap.mapping = THREE.CubeRefractionMapping;
                      material.three.refractionRatio = 0.9;
                      material.three.combine = THREE.MixOperation; // Blend with base color
                      if (msh3js.debug) console.log('processFiles::Refraction enabled for material:', material.name);
                    }

                    // If material is flagged as scrolling (DATA0-Horizontal speed, DATA1-Vertical speed, clone texture and have its offset adjusted in renderloop
                    if (material.scrolling) {
                      const scrollingTexture = ThreeTexture.clone();
                      scrollingTexture.wrapS = THREE.RepeatWrapping;
                      scrollingTexture.wrapT = THREE.RepeatWrapping;
                      scrollingTexture.userData.isScrolling = true;
                      // Store scroll speeds in userData. Speeds are often small, so we divide.
                      scrollingTexture.userData.scrollSpeedU = (material.matd.atrb.data0 || 0) / 255.0;
                      scrollingTexture.userData.scrollSpeedV = (material.matd.atrb.data1 || 0) / 255.0;
                      scrollingTexture.userData._scrollTimeU = 0; // Internal timer for U
                      scrollingTexture.userData._scrollTimeV = 0; // Internal timer for V
                      material.three.map = scrollingTexture;
                      scrollingTexture.name = ThreeTexture.name + "_scrolling";
                      msh.textures.push(scrollingTexture);
                      if (msh3js.debug) console.log('processFiles::Scrolling RGBA DataTexture created by cloning diffuseMap for material:', material);

                      // If a specular map exists, it should scroll too.
                      if (material.three.specularMap) {
                        const scrollingSpecularMap = material.three.specularMap.clone();
                        scrollingSpecularMap.userData.isScrolling = true;
                        material.three.specularMap = scrollingSpecularMap;
                        scrollingSpecularMap.name = material.three.specularMap.name + "_scrolling";
                        material.three.needsUpdate = true;
                        msh.textures.push(scrollingSpecularMap);
                      }

                      // If glowScroll
                      if (material.matd.atrb.renderFlags.glowScroll) {
                        material.three.emissive = new THREE.Color(0xffffff);
                        material.three.emissiveMap = scrollingTexture;
                        material.three.needsUpdate = true;
                      }
                    }

                    // If material is flagged as animated
                    if (material.matd.atrb.renderFlags.animated) {
                      const totalFrames = material.matd.atrb.data0 || 4; // Default to 4 frames if not specified
                      const fps = material.matd.atrb.data1 || 10; // Default to 10 fps

                      // The number of frames must be a perfect square.
                      const gridSize = Math.sqrt(totalFrames);
                      if (Math.floor(gridSize) !== gridSize)
                        console.warn(`Animated texture for material "${material.name}" has ${totalFrames} frames, which is not a perfect square. Animation may not work correctly.`);

                      const animatedTexture = ThreeTexture.clone();
                      animatedTexture.wrapS = THREE.RepeatWrapping;
                      animatedTexture.wrapT = THREE.RepeatWrapping;
                      // Store animation data for the render loop
                      animatedTexture.userData.isAnimated = true;
                      animatedTexture.userData.gridSize = gridSize;
                      animatedTexture.userData.totalFrames = totalFrames;
                      animatedTexture.userData.fps = fps;
                      animatedTexture.userData._animationTime = 0; // Add a personal timer
                      material.three.map = animatedTexture;
                      animatedTexture.name = ThreeTexture.name + "_animated";
                      msh.textures.push(animatedTexture);

                      // If a specular map exists, it should animate too.
                      if (material.three.specularMap) {
                        const animatedSpecularMap = material.three.specularMap.clone();
                        animatedSpecularMap.userData.isAnimated = true;
                        material.three.specularMap = animatedSpecularMap;
                        msh.textures.push(animatedSpecularMap);
                      }
                      if (msh3js.debug) console.log('processFiles::Animated RGBA DataTexture created by cloning diffuseMap for material:', material);
                    }

                    // If material rendertype is energy/pulsate (DATA0- Minimum Brightness, DATA1- Blink Speed)
                    if (material.pulsate) {
                      const pulseSpeed = material.matd.atrb.data1 || 0;
                      if (pulseSpeed === 0) {
                        // A speed of 0 means it's always on at max brightness
                        material.three.userData.alwaysOn = true;
                        if (msh3js.debug) console.log('processFiles::Pulsating material Always On- Data1=0:', material.name);
                      } else {
                        // Store pulsation parameters in userData for the render loop.
                        material.three.userData.minBrightness = (material.matd.atrb.data0 || 0) / 255.0;
                        material.three.userData.pulseSpeed = pulseSpeed;
                        if (msh3js.debug) console.log('processFiles::Pulsating material configured:', material.name);
                      }
                    }
                  }

                  // Handle tx1d (bump/normal/detail maps)
                  if (material.matd.tx1d && material.matd.tx1d.toLowerCase() === fileObj.file.name.toLowerCase()) {
                    if (material.matd.atrb && (material.matd.atrb.renderFlags.lightMap || material.matd.atrb.renderFlags.detail)) {
                      if (msh3js.debug) console.log('msh3js::processFiles::Detail/Lightmap texture found for material:', material.name);
                      const detailTexture = ThreeTexture.clone();
                      detailTexture.colorSpace = THREE.LinearSRGBColorSpace;
                      detailTexture.wrapS = THREE.RepeatWrapping;
                      detailTexture.wrapT = THREE.RepeatWrapping;
                      // Use data0 and data1 for tiling/scaling
                      if (material.matd.atrb) {
                        const scaleU = material.matd.atrb.data0 > 0 ? material.matd.atrb.data0 : 1;
                        const scaleV = material.matd.atrb.data1 > 0 ? material.matd.atrb.data1 : 1;
                        detailTexture.repeat.set(scaleU, scaleV);
                      }
                      material.three.lightMap = detailTexture;
                      material.three.lightMapIntensity = 2.0; // Boost intensity to make it more visible
                      material.three.needsUpdate = true;
                      msh.textures.push(detailTexture);
                    }
                    else if (material.matd.atrb) {
                      if (msh3js.debug) {
                        if (material.matd.atrb.renderFlags.refracted || material.matd.atrb.renderFlags.ice)
                          console.log('msh3js::processFiles::Bumpmap for refraction found for material:', material.name);
                        else console.log('msh3js::processFiles::Bumpmap/Normalmap texture found for material:', material.name);
                      }

                      // If refracted, always treat TX1D as a bump map for distortion.
                      if (material.matd.atrb.renderFlags.refracted || material.matd.atrb.renderFlags.ice) {
                        ThreeTexture.colorSpace = THREE.LinearSRGBColorSpace;
                        material.three.bumpMap = ThreeTexture;
                        material.three.bumpScale = 0.05; // A smaller value provides more subtle distortion.
                      } else {
                        // Check if the texture is grayscale to determine if it's a bump map.
                        if (msh3js.isTextureGrayscale(ThreeTexture)) {
                          if (msh3js.debug) console.log('msh3js::processFiles::Texture detected as bump map (grayscale).');
                          ThreeTexture.colorSpace = THREE.LinearSRGBColorSpace;
                          material.three.bumpMap = ThreeTexture;
                          material.three.bumpScale = 0.1; // Default bump scale
                        } else { // Otherwise, treat it as a normal map.
                          if (msh3js.debug) console.log('msh3js::processFiles::Texture detected as normal map (color).');
                          ThreeTexture.colorSpace = THREE.LinearSRGBColorSpace;
                          material.three.normalMap = ThreeTexture;
                        }
                      }
                      material.three.needsUpdate = true;
                      msh.textures.push(ThreeTexture);
                    }
                  }

                  // Handle tx2d (detail map, treated as a lightmap)
                  if (material.matd.tx2d && material.matd.tx2d.toLowerCase() === fileObj.file.name.toLowerCase()) {
                    // For most render types, tx2d is a detail map (which we treat as a lightMap).
                    // The 'detail' and 'lightMap' render types are exceptions that use tx1d.
                    if (material.matd.atrb && (!material.matd.atrb.renderFlags.detail && !material.matd.atrb.renderFlags.lightMap)) {
                      if (msh3js.debug) console.log('msh3js::processFiles::Detail map (from TX2D) found for material:', material.name);
                      const detailTexture = ThreeTexture.clone();
                      detailTexture.colorSpace = THREE.SRGBColorSpace;
                      detailTexture.wrapS = THREE.RepeatWrapping;
                      detailTexture.wrapT = THREE.RepeatWrapping;
                      // Use data0 and data1 for tiling/scaling if available
                      if (material.matd.atrb) {
                        const scaleU = material.matd.atrb.data0 > 0 ? material.matd.atrb.data0 : 1;
                        const scaleV = material.matd.atrb.data1 > 0 ? material.matd.atrb.data1 : 1;
                        detailTexture.repeat.set(scaleU, scaleV);
                      }
                      material.three.lightMap = detailTexture;
                      material.three.lightMapIntensity = 2.0; // Boost intensity to make it more visible
                      material.three.needsUpdate = true;
                      msh.textures.push(detailTexture);
                    }
                    else {
                      // Treat as bumpMap/normalMap
                      // Check if the texture is grayscale to determine if it's a bump map.
                      if (msh3js.isTextureGrayscale(ThreeTexture)) {
                        if (msh3js.debug) console.log('msh3js::processFiles::Texture detected as bump map (grayscale).');
                        ThreeTexture.colorSpace = THREE.LinearSRGBColorSpace;
                        material.three.bumpMap = ThreeTexture;
                        material.three.bumpScale = 0.1; // Default bump scale
                      } else { // Otherwise, treat it as a normal map.
                        if (msh3js.debug) console.log('msh3js::processFiles::Texture detected as normal map (color).');
                        ThreeTexture.colorSpace = THREE.LinearSRGBColorSpace;
                        material.three.normalMap = ThreeTexture;
                      }
                    }
                  }

                  // Handle tx3d (always cubemap/envmap)
                  if (material.matd.tx3d && material.matd.tx3d.toLowerCase() === fileObj.file.name.toLowerCase()) {
                    if (msh3js.debug) console.log('msh3js::processFiles::Cubemap texture found for material:', material);
                    // The main cubemap for reflections
                    const cubeTexture = msh3js.convertCrossToCube(ThreeTexture);
                    material.three.envMap = cubeTexture;
                    material.three.needsUpdate = true;
                    msh.textures.push(ThreeTexture); // Keep original for reference
                    cubeTexture.name = ThreeTexture.name + "_cubeTexture";
                    msh.textures.push(cubeTexture);
                  }
                }
              }
              fileObj.processed = true; // Mark as processed
              fileProcessed = true;
            }
          } catch (error) {
            console.error("msh3js::processFiles::Error loading texture:", fileObj.file.name, "For material:", material, error);
          }

        } else if (msh3js.three.msh.length > 0) {
          // If MSH files have been loaded and this texture is not required by any of them, discard it.
          if (msh3js.debug) console.log(`processFiles::Discarding unrequired texture: ${fileObj.file.name}`);
          delete msh3js._files[fileObj.file.name.toLowerCase()];
        }
      }
    }

    // Clear previous UI data before populating with new data
    msh3js.ui.models = [];
    msh3js.ui.materials = [];

    // Populate msh3js.ui elements w/msh data
    for (const msh of msh3js.three.msh) {
      for (const material of msh.materials) {
        msh3js.ui.materials.push(material);
      }
      msh.group.traverse((childObj) => { if (childObj.isMesh) msh3js.ui.models.push(childObj); });
    }
    msh3js.ui.mshName = msh3js.three.msh.at(-1).fileName;
    msh3js.ui.mshSize = msh3js.three.msh.at(-1).fileSize;
    msh3js.ui.mshLastModified = new Date(msh3js.three.msh.at(-1).lastModified).toLocaleString();
    msh3js.ui.sceneName = msh3js.three.msh.at(-1).sceneInfo.name;

    // Re-calculate the list of all missing textures from scratch
    const missingTextureNames = new Set();
    for (const msh of msh3js.three.msh) {
      for (const requiredTexture of msh.requiredTextures) {
        const texture = requiredTexture.toLowerCase();
        // Check against the master list of provided files (_files)
        const textureFound = msh3js._files.hasOwnProperty(texture);
        if (!textureFound) missingTextureNames.add(texture);
      }
    }
    msh3js.ui.missingTextures = Array.from(missingTextureNames);

    // If the loaded model has cloth, enable the simulation by default
    if (msh3js.three.msh.at(-1).hasCloth) {
      msh3js.options.clothSim = true;
      if (msh3js.pane) msh3js.pane.refresh(); // Update the UI checkbox
      await msh3js.initClothSimulations(); // Start the simulation immediately
    }

    // If a file was processed, update scene-dependent elements like light helpers
    if (fileProcessed) {
      msh3js.frameCamera(); // Frame the camera on the entire scene
      // Recalculate light positions based on the new total scene bounds
      msh3js.calculateLightPosition(msh3js.three.dirLight, msh3js.options.dirLightAzimuth, msh3js.options.dirLightElevation);
      msh3js.calculateLightPosition(msh3js.three.dirLight2, msh3js.options.dirLight2Azimuth, msh3js.options.dirLight2Elevation);

      // Calculate the total bounding box of all loaded MSH objects
      const totalBoundingBox = new THREE.Box3();
      for (const msh of msh3js.three.msh) {
        const mshBBox = new THREE.Box3().setFromObject(msh.group, true);
        if (!mshBBox.isEmpty()) {
          totalBoundingBox.union(mshBBox);
        }
      }

      // Determine a reasonable size for the helpers based on the scene's bounding sphere radius
      const sceneRadius = totalBoundingBox.getBoundingSphere(new THREE.Sphere()).radius;
      const helperSize = Math.max(1, sceneRadius * 0.2); // At least 1 unit, or 20% of radius

      // Dispose and recreate dirLightHelper 1, ensuring it targets the world origin
      msh3js.three.scene.remove(msh3js.three.dirLightHelper);
      msh3js.three.dirLightHelper.dispose();
      msh3js.three.dirLight.target.position.set(0, 0, 0); // Retarget to origin
      msh3js.three.dirLightHelper = new THREE.DirectionalLightHelper(msh3js.three.dirLight, helperSize);
      msh3js.three.dirLightHelper.visible = msh3js.options.enableDirLightHelper;
      msh3js.three.scene.add(msh3js.three.dirLightHelper);

      // Dispose and recreate dirLightHelper 2, ensuring it targets the world origin
      msh3js.three.scene.remove(msh3js.three.dirLightHelper2);
      msh3js.three.dirLightHelper2.dispose();
      msh3js.three.dirLight2.target.position.set(0, 0, 0); // Retarget to origin
      msh3js.three.dirLightHelper2 = new THREE.DirectionalLightHelper(msh3js.three.dirLight2, helperSize);
      msh3js.three.dirLightHelper2.visible = msh3js.options.enableDirLightHelper2;
      msh3js.three.scene.add(msh3js.three.dirLightHelper2);
    }
    // Reconstruct Tweakpane pane if already present
    if (msh3js.pane != null) await msh3js.initTweakpane(true);
    if (msh3js.debug) console.log("processFiles::Files processed:", msh3js._files);

    // Cleanup URLs after loading is complete
    for (const fileObj of Object.values(msh3js._files)) {
      URL.revokeObjectURL(fileObj.url);
      fileObj.url = null;
    }

    // Return true if at least one file was processed
    return fileProcessed;
  },

  // Call necessary functions on input files
  async handleFileInput(e) {
    const files = e.target.files;
    if (msh3js.debug) console.log("handleFileInput::Files selected:", files);
    msh3js.addFiles(files);
    await msh3js.processFiles(msh3js._files)
  },
  // Handles the file input for the background image
  async handleBackgroundImageInput(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileURL = URL.createObjectURL(file);
    msh3js.loadAndSetBackground(fileURL, file.name.toLowerCase());
  },

  // Handles the file input for animation-only MSH files
  async handleAnimationFileInput(e) {
    const files = e.target.files;
    if (msh3js.debug) console.log("handleAnimationFileInput::Files selected:", files);
    if (files.length > 0) {
      await msh3js.importAnimations(files);
    }
  },

  // Get launch fileHandles from launchQueue and populate msh3js.files
  async getLaunchFiles() {
    if (!window.launchQueue) {
      if (msh3js.debug) console.log("getLaunchFiles::launchQueue API not supported.");
      return Promise.resolve(false);
    }

    return new Promise(resolve => {
      let promiseResolved = false;

      // Set a small timeout to resolve the promise if no files are launched.
      // This prevents the app from hanging on a normal launch.
      setTimeout(() => {
        if (!promiseResolved) {
          if (msh3js.debug) console.log("getLaunchFiles::No launch files detected within timeout.");
          promiseResolved = true;
          resolve(false);
        }
      }, 250); // A short delay is enough to catch a file-based launch.

      window.launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files && launchParams.files.length > 0 && !promiseResolved) {
          if (msh3js.debug) console.log("getLaunchFiles::App launched with files:", launchParams.files);
          promiseResolved = true;

          const files = [];
          for (const fileHandle of launchParams.files) {
            files.push(await fileHandle.getFile());
          }
          msh3js.addFiles(files);

          // Resolve with true, indicating files were processed on launch.
          resolve(true);
        }
      });
    });
  },

  // Get client device graphics features support for web apis, reverse depth, anti-aliasing
  async getSupportedGraphicsFeatures(canvases = null) {
    let webglCanvas;
    let webgl2Canvas;

    if (canvases) {
      // Get passed canvases if present
      if (canvases.webglCanvas) webglCanvas = canvases.webglCanvas;
      else
        webglCanvas = msh3js.createCanvas({
          id: "webglCanvas",
        }, false);
      if (canvases.webgl2Canvas) webgl2Canvas = canvases.webgl2Canvas;
      else
        webgl2Canvas = msh3js.createCanvas({
          id: "webgl2Canvas",
        }, false);
    } else {
      // Create canvases if not passed
      webglCanvas = msh3js.createCanvas({
        id: "webglCanvas",
      }, false);
      webgl2Canvas = msh3js.createCanvas({
        id: "webgl2Canvas",
      }, false);
    }

    try {
      // Detect WebGL Support
      if (
        webglCanvas.getContext("webgl") ||
        webglCanvas.getContext("experimental-webgl")
      ) {
        msh3js._supportedFeatures.webGL.supported = true;

        // Check for AA support in webgl
        let gl = webglCanvas.getContext("webgl", { antialias: true });
        if (gl) {
          const att = gl.getContextAttributes();
          msh3js._supportedFeatures.webGL.aa = att.antialias === true;
          msh3js._supportedFeatures.webGL.maxSamples = 2;
        } else {
          gl = webglCanvas.getContext("webgl", { antialias: false });
        }

        // Check for reverse depth buffer support
        const extClipControl = gl.getExtension("EXT_clip_control");
        if (extClipControl) msh3js._supportedFeatures.webGL.reverseDepth = true;

        // Check for loseContext support
        const extLoseContext = gl.getExtension("WEBGL_lose_context");
        gl.finish(); // Let browser know we're done with this context
        try {
          if (extLoseContext) extLoseContext.loseContext();
        } catch (e) { } finally { gl = null; } // Release context
      }
    } catch (e) {
      if (msh3js.debug)
        console.error("getSupportedGraphicsFeatures::WebGL error: ", e);
    } finally {
      if (msh3js.debug)
        console.log(
          "getSupportedGraphicsFeatures::WebGL support:",
          msh3js._supportedFeatures.webGL.supported,
          "\nWebGL AA support:",
          msh3js._supportedFeatures.webGL.aa,
          "\nWebGL Reverse depth buffer support:",
          msh3js._supportedFeatures.webGL.reverseDepth
        );
    }

    try {
      // Detect WebGL2 Support
      if (webgl2Canvas.getContext("webgl2")) {
        msh3js._supportedFeatures.webGL2.supported = true;
        msh3js._supportedFeatures.webGL2.reverseDepth = true;

        // Check for AA support in webgl2 and get max samples
        let gl2 = webgl2Canvas.getContext("webgl2", { antialias: true });
        if (gl2) {
          const att = gl2.getContextAttributes();
          msh3js._supportedFeatures.webGL2.aa = att.antialias === true;
          msh3js._supportedFeatures.webGL2.maxSamples = gl2.getParameter(gl2.MAX_SAMPLES);
        } else {
          msh3js._supportedFeatures.webGL2.aa = false;
          gl2 = webgl2Canvas.getContext("webgl2", { antialias: false });
        }
        const extLoseContext = gl2.getExtension("WEBGL_lose_context");
        gl2.finish(); // Finished with this context
        try {
          if (extLoseContext) extLoseContext.loseContext();
        } catch (e) { } finally { gl2 = null; } // Release context
      }
    } catch (e) {
      if (msh3js.debug)
        console.error("getSupportedGraphicsFeatures::WebGL2 error: ", e);
    } finally {
      if (msh3js.debug)
        console.log(
          "getSupportedGraphicsFeatures::WebGL2 support:",
          msh3js._supportedFeatures.webGL2.supported,
          "\nWebGL2 AA support:",
          msh3js._supportedFeatures.webGL2.aa,
          "\nWebGL2 max AA samples:",
          msh3js._supportedFeatures.webGL2.maxSamples,
        );
    }
    webglCanvas = null;
    webgl2Canvas = null;

    // AA sample count options for each API
    msh3js._supportedFeatures.webGL.sampleCountOptions = [{ text: "Disabled", value: 0 }];
    msh3js._supportedFeatures.webGL2.sampleCountOptions = [{ text: "Disabled", value: 0 }];

    if (msh3js._supportedFeatures.webGL.aa === true)
      msh3js._supportedFeatures.webGL.sampleCountOptions.push({ text: "2x", value: 2 });

    if (msh3js._supportedFeatures.webGL2.aa === true)
      msh3js._supportedFeatures.webGL2.sampleCountOptions.push({ text: "2x", value: 2 });

    if (msh3js._supportedFeatures.webGL2.maxSamples >= 4)
      msh3js._supportedFeatures.webGL2.sampleCountOptions.push({ text: "4x", value: 4 });

    if (msh3js._supportedFeatures.webGL2.maxSamples >= 8)
      msh3js._supportedFeatures.webGL2.sampleCountOptions.push({ text: "8x", value: 8 });

    if (msh3js._supportedFeatures.webGL2.maxSamples >= 16)
      msh3js._supportedFeatures.webGL2.sampleCountOptions.push({ text: "16x", value: 16 });

  },

  // Get persistent storage support
  async getPersistentStorageSupport() {
    // Check for persistent storage
    if (window.navigator.storage && window.navigator.storage.persisted) {
      const allowed = await window.navigator.storage.persisted();
      if (msh3js.debug)
        console.log(
          "getPersistentStorageSupport::Persistent Storage allowed:",
          allowed
        );
      const persists = await window.navigator.storage.persist();
      msh3js._supportedFeatures.persistentStorage = persists;
      if (msh3js.debug)
        console.log(
          "getPersistentStorageSupport::Persistent Storage enabled:",
          persists
        );
    }
  },

  // Create HTML canvas element for DOM and return it
  createCanvas(params, inject = false) {
    if (!params.id) params.id = "canvas";
    if (!params.width) params.width = 64;
    if (!params.height) params.height = 64;

    const newCanvas = document.createElement("canvas");
    newCanvas.id = params.id;
    newCanvas.width = params.width;
    newCanvas.height = params.height;
    if (msh3js.debug)
      console.log(
        "createCanvas::New canvas created:",
        newCanvas.id,
        "with size:",
        newCanvas.width,
        "x",
        newCanvas.height
      );
    if (inject === true) {
      msh3js._appContainer.appendChild(newCanvas);
      if (msh3js.debug)
        console.log("createCanvas::Canvas injected into _appContainer.");
    }
    return newCanvas;
  },

  // Create renderer using passed params and return it along with its context and canvas
  async createRenderer(
    params = {
      renderingAPI: null,
      size: null,
      pixelRatio: null,
      GPU: null,
      AA: null,
      sampleCount: null,
      reverseDepth: null,
      canvas: null,
    }
  ) {
    if (params.renderingAPI == null) params.renderingAPI = msh3js._supportedFeatures.webGL2.supported ? "webgl2" : "webgl";
    if (params.size == null) params.size = msh3js.size ?? { width: 64, height: 64 };
    if (params.pixelRatio == null) params.pixelRatio = msh3js.options.pixelRatio ?? 1.0;
    if (params.GPU == null) params.GPU = msh3js.options.preferredGPU ?? "default";
    if (params.AA == null) params.AA = msh3js.options.aa ?? false;
    if (params.sampleCount == null) params.sampleCount = msh3js.options.sampleCount ?? 1;
    if (params.reverseDepth == null) params.reverseDepth = msh3js._useReverseDepth ?? false;

    // Populate params
    let newRenderer, newContext, newCanvas, rendererParams;

    // New canvas (Or passed one)
    if (params.canvas != null)
      newCanvas = params.canvas;
    else
      newCanvas = msh3js.createCanvas({
        id: "msh3jsCanvas",
        width: params.size.width,
        height: params.size.height,
      }, true);

    // Populate renderer params
    rendererParams = {
      canvas: newCanvas,
      antialias: params.AA,
      sampleCount: params.sampleCount,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: params.GPU,
      reverseDepthBuffer: params.reverseDepth,
      useLegacyLights: true,
    };

    if (msh3js.debug)
      console.log("createRenderer::Renderer Params: ", rendererParams);

    try {
      newRenderer = new THREE.WebGLRenderer(rendererParams);
      newContext = newRenderer.getContext();
      newRenderer.debug = {
        checkShaderErrors: msh3js.debug,
        onShaderError: null
      };
    } catch (e) {
      console.error("createRenderer::Error initializing WebGLRenderer:", e);
    }

    newRenderer.setSize(params.size.width, params.size.height, false);
    newRenderer.setPixelRatio(params.pixelRatio);
    newRenderer.setClearColor(0x0000AA);
    newRenderer.autoClear = false;
    //newRenderer.outputEncoding = THREE.sRGBEncoding; //r151
    newRenderer.outputColorSpace = THREE.LinearSRGBColorSpace; //r152+

    msh3js.three.renderer = newRenderer;
    msh3js.context = newContext;
    msh3js.canvas = newCanvas;

    if (msh3js.debug) {
      let rendererType = "WebGL";
      if (params.renderingAPI === "webgl2") rendererType = "WebGL2";
      console.log("createRenderer::New", rendererType, "renderer created:", newRenderer);
    }
    return { renderer: newRenderer, context: newContext, canvas: newCanvas };
  },

  // Recreates the renderer, canvas, and related components
  async recreateRenderer() {
    if (msh3js.debug)
      console.log("recreateRenderer::Recreating renderer...");
    // Nullify the animation loop
    if (msh3js.three.renderer) msh3js.three.renderer.setAnimationLoop(null);
    // Remove and nullify stats
    await msh3js.initStats(false);
    // Dispose of viewHelper
    if (msh3js.three.viewHelper) {
      msh3js.three.viewHelper.dispose();
      msh3js.three.viewHelper = null;
    }
    // Nullify orbitControls
    if (msh3js.three.orbitControls) {
      msh3js.three.orbitControls.dispose();
      msh3js.three.orbitControls = null;
    }
    // Dispose of renderer and context
    if (msh3js.three.renderer) {
      msh3js.three.renderer.dispose();
      msh3js.three.renderer = null;
    }
    if (msh3js.context) {
      const extLoseContext = msh3js.context.getExtension("WEBGL_lose_context");
      try {
        if (extLoseContext) extLoseContext.loseContext();
      } catch (e) {
        console.error("recreateRenderer::Error losing context:", e);
      } finally {
        msh3js.context = null;
      }
    }
    if (msh3js.canvas && msh3js._appContainer.contains(msh3js.canvas)) {
      msh3js._appContainer.removeChild(msh3js.canvas);
      msh3js.canvas = null;
    }
    // Create and inject new canvas into the DOM
    msh3js.canvas = msh3js.createCanvas({
      id: "msh3jsCanvas",
      width: msh3js.size.width,
      height: msh3js.size.height,
    }, true);

    await msh3js.initThree();
    msh3js.three.renderer.setAnimationLoop(msh3js.render);
    await msh3js.initStats(msh3js.options.showStats);
    if (msh3js.three.msh.length > 1)
      msh3js.frameCamera(); // Frame entire scene if multiple msh files are imported
    else if (msh3js.three.msh.length > 0)
      msh3js.frameCamera(msh3js.three.msh.at(-1).group);
    if (msh3js.debug)
      console.log("recreateRenderer::Renderer recreated.");
  },

  // Create and assign Three.js scene
  createScene() {
    msh3js.three.scene = new THREE.Scene();
    msh3js.three.scene.name = "MSH3JS_Scene";

    msh3js.three.scene.background = new THREE.Color(msh3js.options.backgroundColor);
    // Create a single animation mixer for the scene
    msh3js.three.mixer = new THREE.AnimationMixer(msh3js.three.scene);
    msh3js.three.mixer.name = "sceneAnimationMixer";
    if (msh3js.debug) console.log("createScene::AnimationMixer created for the scene.");

    // Add ambient light
    msh3js.three.ambLight = new THREE.AmbientLight(msh3js.options.ambLightColor, msh3js.options.ambLightIntensity);
    msh3js.three.ambLight.name = "ambientLight";
    msh3js.three.scene.add(msh3js.three.ambLight);

    // Add directional light
    msh3js.three.dirLight = new THREE.DirectionalLight(msh3js.options.dirLightColor, msh3js.options.dirLightIntensity);
    msh3js.three.dirLight.name = "directionalLight1";
    msh3js.three.dirLight.target.name = "directionalLight1Target";
    msh3js.three.dirLight.castShadow = msh3js.options.enableShadows;
    if (msh3js.three.dirLight.castShadow === true) {
      msh3js.three.dirLight.shadow.mapSize.width = 512;
      msh3js.three.dirLight.shadow.mapSize.height = 512;
      // Shadow camera bounds based on imported msh bbox
      if (msh3js.three.msh.length > 0 && msh3js.three.msh[-1].sceneInfo != null) {
        const radius = msh3js.three.msh[-1].sceneInfo.radius;
        // Set camera bounds based on radius
        msh3js.three.dirLight.shadow.camera.near = 0.5;
        msh3js.three.dirLight.shadow.camera.far = radius * 3.0;
        msh3js.three.dirLight.shadow.camera.left = -radius * 1.5;
        msh3js.three.dirLight.shadow.camera.right = radius * 1.5;
        msh3js.three.dirLight.shadow.camera.top = radius * 1.5;
        msh3js.three.dirLight.shadow.camera.bottom = -radius * 1.5;
      } else {
        msh3js.three.dirLight.shadow.camera.left = -10;
        msh3js.three.dirLight.shadow.camera.right = 10;
        msh3js.three.dirLight.shadow.camera.top = 10;
        msh3js.three.dirLight.shadow.camera.bottom = -10;
        msh3js.three.dirLight.shadow.camera.near = 0.5;
        msh3js.three.dirLight.shadow.camera.far = 500;
      }
      // Shadow bias
      msh3js.three.dirLight.shadow.bias = -0.001;
    }
    msh3js.calculateLightPosition(msh3js.three.dirLight, msh3js.options.dirLightAzimuth, msh3js.options.dirLightElevation);
    msh3js.three.scene.add(msh3js.three.dirLight);
    msh3js.three.dirLight.target.position.set(0, 0, 0);
    msh3js.three.scene.add(msh3js.three.dirLight.target);
    // Add helper for directional light
    msh3js.three.dirLightHelper = new THREE.DirectionalLightHelper(msh3js.three.dirLight, 5);
    msh3js.three.dirLightHelper.name = "directionalLightHelper1";
    msh3js.three.dirLightHelper.visible = msh3js.options.enableDirLightHelper;
    msh3js.three.scene.add(msh3js.three.dirLightHelper);

    // Add directional light 2
    msh3js.three.dirLight2 = new THREE.DirectionalLight(0xaaaaff, 0.0);
    msh3js.three.dirLight2.name = "directionalLight2";
    msh3js.three.dirLight2.target.name = "directionalLight2Target";
    msh3js.three.dirLight2.castShadow = false;
    msh3js.three.dirLight2.position.set(-msh3js.three.dirLight.position.x, // Inverse direction of dirLight by default
      -msh3js.three.dirLight.position.y, -msh3js.three.dirLight.position.z);
    msh3js.three.dirLight2.target.position.set(0, 0, 0);
    msh3js.three.scene.add(msh3js.three.dirLight2);
    msh3js.three.scene.add(msh3js.three.dirLight2.target);

    // Add helper for directional light 2
    msh3js.three.dirLightHelper2 = new THREE.DirectionalLightHelper(msh3js.three.dirLight2, 5);
    msh3js.three.dirLightHelper2.name = "directionalLightHelper2";
    msh3js.three.dirLightHelper2.visible = msh3js.options.enableDirLightHelper2;
    msh3js.three.scene.add(msh3js.three.dirLightHelper2);

    // Add grid helper
    msh3js.three.gridHelper = new THREE.GridHelper(10, 10);
    msh3js.three.gridHelper.name = "gridHelper";
    msh3js.three.gridHelper.visible = msh3js.options.enableGrid;
    msh3js.three.scene.add(msh3js.three.gridHelper);

    if (msh3js.debug) console.log("createScene::Scene created: ", msh3js.three.scene);
    return msh3js.three.scene;
  },

  // Calculate directional light positions
  calculateLightPosition(dirLight = null, azimuth = null, elevation = null) {
    // Determine which light to use if not specified
    const lightToUpdate = dirLight ?? msh3js.three.dirLight ?? msh3js.three.dirLight2;
    if (!lightToUpdate) return;

    // Use the correct options based on which light is being updated
    if (lightToUpdate === msh3js.three.dirLight) {
      azimuth = azimuth ?? msh3js.options.dirLightAzimuth;
      elevation = elevation ?? msh3js.options.dirLightElevation;
    } else if (lightToUpdate === msh3js.three.dirLight2) {
      azimuth = azimuth ?? msh3js.options.dirLight2Azimuth;
      elevation = elevation ?? msh3js.options.dirLight2Elevation;
    }

    // Calculate the total bounding box of all loaded MSH objects to correctly position the light
    const totalBoundingBox = new THREE.Box3();
    if (msh3js.three.msh.length > 0) {
      for (const msh of msh3js.three.msh) {
        const mshBBox = new THREE.Box3().setFromObject(msh.group, true);
        if (!mshBBox.isEmpty()) {
          totalBoundingBox.union(mshBBox);
        }
      }
    }

    const sceneSphere = totalBoundingBox.getBoundingSphere(new THREE.Sphere());
    const center = sceneSphere.center;
    const radius = sceneSphere.radius > 0 ? sceneSphere.radius : 10; // Use a default radius if scene is empty
    const distance = radius * 1.5; // Position the light 1.5x the scene radius away from the center
    // Convert to radians and calculate light position
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    const x = (distance * Math.sin(phi) * Math.cos(theta)) + center.x;
    const y = (distance * Math.cos(phi)) + center.y;
    const z = (distance * Math.sin(phi) * Math.sin(theta)) + center.z;
    // Set light positions if present
    if (lightToUpdate) {
      lightToUpdate.position.set(x, y, z);
      if (msh3js.three.dirLightHelper) msh3js.three.dirLightHelper.update();
      if (msh3js.three.dirLightHelper2) msh3js.three.dirLightHelper2.update();
    }
  },

  // Create and assign Three.js camera
  // TODO: Adjust based on scene size
  createCamera() {
    const aspect = (msh3js.size.width > 0 && msh3js.size.height > 0) ? (msh3js.size.width / msh3js.size.height) : 1;
    msh3js.three.camera = new THREE.PerspectiveCamera(
      75, // fov
      aspect, // aspect ratio
      0.1, // near plane
      10000 // far plane
    ); // Create a new Three.JS camera
    msh3js.three.camera.position.set(0, 1, 5); // Set camera position
    // Initialize properties for cubecam optimization
    msh3js.three.lastCameraPosition = new THREE.Vector3();
    msh3js.three.lastCameraQuaternion = new THREE.Quaternion();
    msh3js.three.camera.name = "sceneCamera";
    if (msh3js.debug) console.log("createCamera::Camera created: ", msh3js.three.camera);
    return msh3js.three.camera;
  },

  // Frame camera to fit an object's bounding box
  frameCamera(obj = null, margin = 1.0) {
    if (!msh3js.three.camera) msh3js.createCamera(); // Ensure camera exists

    const target = new THREE.Box3();

    // If an object is passed, frame it. Otherwise, frame the entire scene.
    if (obj) {
      target.setFromObject(obj, true);
    } else if (msh3js.three.msh.length > 0) {
      for (const msh of msh3js.three.msh) {
        const mshBBox = new THREE.Box3().setFromObject(msh.group, true);
        if (!mshBBox.isEmpty()) {
          target.union(mshBBox);
        }
      }
    }

    if (target.isEmpty()) {
      return false;
    }

    const center = target.getCenter(new THREE.Vector3());
    const sphere = target.getBoundingSphere(new THREE.Sphere());
    const radius = sphere.radius;

    if (radius <= 0) {
      console.warn("frameCamera::Object has no radius. Framing at object center.");
      msh3js.three.camera.position.copy(center).add(new THREE.Vector3(0, 0, 1)); // 1 unit away on Z
      msh3js.three.camera.lookAt(center);
      if (msh3js.three.orbitControls) {
        msh3js.three.orbitControls.target.copy(center);
        msh3js.three.orbitControls.minDistance = msh3js.three.camera.near * 1.05;
        msh3js.three.orbitControls.maxDistance = msh3js.three.camera.far * 0.95;
        msh3js.three.orbitControls.update();
      }
      msh3js.three.camera.updateProjectionMatrix();
      return true;
    }

    // Calculate distance to fit object in view
    const fov = msh3js.three.camera.fov * (Math.PI / 180);
    const sin = Math.sin(fov / 2);
    if (Math.abs(sin) < 1e-6) return false; // Avoid division by zero
    let distance = Math.abs(radius / sin);
    distance *= margin; // Apply margin
    const direction = new THREE.Vector3();
    msh3js.three.camera.getWorldDirection(direction);
    if (direction.lengthSq() < 0.0001) {
      direction.set(0, 0, -1);
    }
    // Position camera
    msh3js.three.camera.position.copy(center).addScaledVector(direction.negate(), distance);
    // Point camera
    msh3js.three.camera.lookAt(center);
    if (msh3js.three.orbitControls) {
      msh3js.three.orbitControls.target.copy(center);
      msh3js.three.orbitControls.update();
      // Dynamically adjust near and far planes based on the new camera distance.
      msh3js.three.camera.near = Math.max(0.1, distance / 100);
      msh3js.three.camera.far = distance * 100; // Set far plane to be 4x the camera distance.
      msh3js.three.orbitControls.minDistance = msh3js.three.camera.near * 1.05;
      msh3js.three.orbitControls.maxDistance = msh3js.three.camera.far * 0.95;
    }
    msh3js.three.camera.updateProjectionMatrix(); // Apply new near/far planes

    // Check if the scene depth is large enough to warrant a reverse depth buffer.
    const depthRatio = msh3js.three.camera.far / msh3js.three.camera.near;
    if (depthRatio > 8000) { // Reverse depth threshold
      let canUseReverseDepth = false;
      if (msh3js._supportedFeatures.webGL2.supported || msh3js._supportedFeatures.webGL.reverseDepth) {
        canUseReverseDepth = true;
      }

      // If reverse depth is beneficial and not already active, recreate the renderer.
      if (canUseReverseDepth && !msh3js._useReverseDepth) {
        if (msh3js.debug) {
          console.log(`frameCamera::High depth ratio (${depthRatio.toFixed(0)}) detected. Enabling reverse depth buffer.`);
        }
        msh3js._useReverseDepth = true;
        msh3js.recreateRenderer(); // This will use the new _useReverseDepth value.
      }
    }
    if (msh3js.debug) {
      if (obj) {
        console.log("frameCamera::Camera framed to object: ", obj);
      } else {
        console.log("frameCamera::Camera framed to scene.");
      }
    }
    return true;
  },

  // Create and assign Three.js orbit controls
  createOrbitControls(camera = null, canvas = null) {
    if (camera == null) camera = msh3js.three.camera ?? msh3js.createCamera();
    if (canvas == null) canvas = msh3js.canvas;
    // Safety check
    if (msh3js.canvas == null) {
      console.warn("createOrbitControls::No canvas present!");
      msh3js.canvas = msh3js.createCanvas({
        id: "msh3jsCanvas",
        width: msh3js.size.width,
        height: msh3js.size.height,
      }, true);
      canvas = msh3js.canvas;
    }

    msh3js.three.orbitControls = new OrbitControls(camera, canvas);
    msh3js.three.orbitControls.name = "orbitControls";
    msh3js.three.orbitControls.target.set(0, 1, 0);
    msh3js.three.orbitControls.minDistance = camera.near * 1.1;
    msh3js.three.orbitControls.maxDistance = camera.far * 0.9;
    msh3js.three.orbitControls.listenToKeyEvents(window);
    msh3js.three.orbitControls.keyPanSpeed = 1.5;
    msh3js.three.orbitControls.autoRotate = msh3js.options.autoRotate;
    msh3js.three.orbitControls.autoRotateSpeed = msh3js.options.autoRotateSpeed;
    msh3js.three.orbitControls.enableDamping = msh3js.options.controlDamping;
    if (msh3js.debug)
      console.log("createOrbitControls::Controls created: ", msh3js.three.orbitControls);
    return msh3js.three.orbitControls;
  },

  // Create and assign Three.js view helper
  async createViewHelper(camera = null, renderer = null, controls = null, colors = null) {
    if (camera == null) camera = msh3js.three.camera ?? msh3js.createCamera();
    if (renderer == null) renderer = msh3js.three.renderer;
    // Safety checks
    if (msh3js.canvas == null) {
      console.warn("createViewHelper::No canvas present!");
      msh3js.canvas = msh3js.createCanvas({
        id: "msh3jsCanvas",
        width: msh3js.size.width,
        height: msh3js.size.height,
      }, true);
      msh3js._appContainer.appendChild(msh3js.canvas);
      console.log(
        "createViewHelper::Canvas created and appended to _appContainer."
      );
    }
    if (msh3js.three.renderer == null) {
      console.warn(
        "createViewHelper::No renderer present!");
      const { renderer, context } = await msh3js.createRenderer({
        renderingAPI: msh3js._supportedFeatures.webGL2.supported ? "webgl2" : "webgl",
        size: msh3js.size,
        pixelRatio: msh3js.options.pixelRatio,
        GPU: msh3js.options.preferredGPU,
        AA: msh3js.options.aa,
        sampleCount: msh3js.options.sampleCount,
        reverseDepth: msh3js._useReverseDepth,
        canvas: msh3js.canvas,
      });
      msh3js.three.renderer = renderer;
      msh3js.context = context;
    }
    if (controls == null) controls =
      msh3js.three.orbitControls ?? msh3js.createOrbitControls(camera, msh3js.canvas);
    if (colors == null) colors =
      [new THREE.Color(msh3js.options.viewHelperColors.x),
      new THREE.Color(msh3js.options.viewHelperColors.y),
      new THREE.Color(msh3js.options.viewHelperColors.z)];

    let ViewHelper;
    // Check if ViewHelper is already imported
    if (msh3js._modules.ViewHelper) {
      ViewHelper = msh3js._modules.ViewHelper;
    }
    else {
      const viewHelperModule = await import("view-helper");
      ViewHelper = viewHelperModule.ViewHelper;
      msh3js._modules.ViewHelper = ViewHelper;
    }

    // Get canvas size
    const canvasSize = new THREE.Vector2(
      msh3js.canvas.clientWidth,
      msh3js.canvas.clientHeight
    );
    // Get smallest dimension and calculate helper size from it x 0.2
    const minSide = Math.min(canvasSize.x, canvasSize.y);
    const helperSize = Math.round(minSide * 0.2);

    // Create viewHelper and set its controls
    msh3js.three.viewHelper = new ViewHelper(
      camera,
      renderer,
      "bottom-right",
      helperSize,
      colors
    );

    msh3js.three.viewHelper.setControls(controls);
    if (msh3js.debug)
      console.log("createViewHelper::ViewHelper created: ", msh3js.three.viewHelper);
    return msh3js.three.viewHelper;
  },

  // Create and assign Three.js loading manager, instantiate loaders
  createLoaders() {
    THREE.Cache.enabled = true;
    msh3js.three.loadingManager = new THREE.LoadingManager();
    // Set up loading manager events
    msh3js.three.loadingManager.onStart = function (url, items, total) {
      if (msh3js._loadingBar.container) {
        msh3js._loadingBar.container.style.display = 'flex';
      }
      if (msh3js.debug)
        console.log(
          "LoadingManager::Started loading:",
          url,
          " for ",
          total,
          "items."
        );
    };
    msh3js.three.loadingManager.onProgress = function (url, loaded, total) {
      const progress = loaded / total;
      const spheresToShow = Math.ceil(progress * msh3js._loadingBar.spheres.length);
      msh3js._loadingBar.spheres.forEach((sphere, index) => {
        sphere.style.opacity = index < spheresToShow ? '1.0' : '0.2';
      });
      if (msh3js.debug)
        console.log(
          "LoadingManager::In progress:",
          url,
          " : " + loaded + " / " + total
        );
    };
    msh3js.three.loadingManager.onLoad = function () {
      if (msh3js._loadingBar.container) {
        msh3js._loadingBar.container.style.display = 'none';
      }
      if (msh3js.debug) console.log("LoadingManager::Finished!");
    };
    msh3js.three.loadingManager.onError = function (url) {
      if (msh3js.debug)
        console.error("LoadingManager::Error!", url);
    };

    // Instantiate texture, tga, and msh model loaders w/our loadingManager
    msh3js.three.textureLoader = new THREE.TextureLoader(msh3js.three.loadingManager);
    msh3js.three.exrLoader = new EXRLoader(msh3js.three.loadingManager);
    msh3js.three.rgbeLoader = new RGBELoader(msh3js.three.loadingManager);
    msh3js.three.tgaLoader = new TGALoader(msh3js.three.loadingManager);
    msh3js.three.mshLoader = new MSHLoader(msh3js.three.loadingManager);
  },

  // Create and append HTML file input
  createFileInput() {
    let fileInput = msh3js._fileInput ?? document.getElementById("fileInput") ?? null;
    if (fileInput != null) return fileInput;
    try {
      fileInput = document.createElement("input");
      fileInput.id = "fileInput";
      fileInput.type = "file";
      fileInput.style.display = "none";
      fileInput.multiple = true;
      fileInput.accept = ".msh,.tga,.msh.option";
      msh3js._appContainer.appendChild(fileInput);
      msh3js._fileInput = fileInput;
      msh3js.manageListeners("add", "fileInput");

    } catch (e) { console.error("createFileInput::Error creating file input:", e); }
    if (msh3js.debug)
      console.log("createFileInput::File input created: ", fileInput);
    return fileInput;
  },

  // Creates a hidden file input specifically for importing animations
  createAnimationFileInput() {
    let animFileInput = document.getElementById("animFileInput");
    if (animFileInput) return animFileInput;
    try {
      animFileInput = document.createElement("input");
      animFileInput.id = "animFileInput";
      animFileInput.type = "file";
      animFileInput.style.display = "none";
      animFileInput.multiple = true;
      animFileInput.accept = ".msh";
      msh3js._appContainer.appendChild(animFileInput);
      animFileInput.addEventListener("change", msh3js.handleAnimationFileInput);
    } catch (e) { console.error("createAnimationFileInput::Error creating file input:", e); }
    return animFileInput;
  },

  // Create and append HTML file input for background image
  createBackgroundImageInput() {
    let bgFileInput = document.getElementById("bgFileInput");
    // If it exists, remove it and create a new one to clear the event listener and value
    if (bgFileInput) bgFileInput.remove();

    try {
      bgFileInput = document.createElement("input");
      bgFileInput.id = "bgFileInput";
      bgFileInput.type = "file";
      bgFileInput.style.display = "none";
      // Accept common image formats supported by THREE's loaders
      bgFileInput.accept = "image/png, image/jpeg, image/jpg, image/webp, .tga, .exr, .hdr";
      msh3js._appContainer.appendChild(bgFileInput);
      bgFileInput.addEventListener("change", msh3js.handleBackgroundImageInput, { once: true });
    } catch (e) { console.error("createBackgroundImageInput::Error creating file input:", e); }

    return bgFileInput;
  },

  // Generates an AA control for tweakpane
  generateAAControl(sampleCountOptions = null, renderingFolder = null) {
    if (sampleCountOptions && renderingFolder) {
      // Anti-Aliasing Selection List
      const aaControl = renderingFolder
        .addBinding(msh3js.options, "sampleCount", {
          index: 0,
          label: "Anti-Aliasing",
          options: sampleCountOptions,
        })
        .on("change", async () => {
          msh3js.options.aa = msh3js.options.sampleCount > 0; // Toggle AA based on sampleCount
          if (msh3js.debug)
            console.log("Anti-Aliasing mode set to:", msh3js.options.sampleCount, "x");
          // Recreate canvas/context with new parameters
          await msh3js.recreateRenderer();
          if (msh3js.options.sampleCount > 0) {
            for (const material of msh3js.three.msh.at(-1).materials) {
              if (material.transparent) {
                material.three.alphaToCoverage = true;
                material.three.needsUpdate = true;
              }
            }
          }
        });
      return aaControl;
    }
  },

  // Convert traditional cubemap to envmap (cubeTexture)
  convertCrossToCube(texture) {
    const { data, width, height } = texture.image;

    // Create a temporary canvas to hold the full cross image from raw data
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = width;
    fullCanvas.height = height;
    const fullCtx = fullCanvas.getContext('2d');

    // Create an ImageData object and put the raw TGA data into it
    const imageData = fullCtx.createImageData(width, height);
    imageData.data.set(data);
    fullCtx.putImageData(imageData, 0, 0);

    const image = fullCanvas; // Use the canvas as the image source
    // Assuming a 4x3 layout for horizontal cross
    const faceWidth = image.width / 4;
    const faceHeight = image.height / 3;
    // Define source coordinates for each face from the cross image
    const faces = [
      { name: 'px', sx: 2 * faceWidth, sy: 1 * faceHeight }, // +x
      { name: 'nx', sx: 0 * faceWidth, sy: 1 * faceHeight }, // -x
      { name: 'py', sx: 1 * faceWidth, sy: 0 * faceHeight }, // +y
      { name: 'ny', sx: 1 * faceWidth, sy: 2 * faceHeight }, // -y
      { name: 'pz', sx: 1 * faceWidth, sy: 1 * faceHeight }, // +z
      { name: 'nz', sx: 3 * faceWidth, sy: 1 * faceHeight }, // -z, often on the far right
    ];

    const canvases = [];

    for (let i = 0; i < 6; i++) {
      const face = faces[i];
      const canvas = document.createElement('canvas');
      canvas.width = faceWidth;
      canvas.height = faceHeight;
      const context = canvas.getContext('2d');
      // Draw the correct part of the source image onto the canvas
      context.drawImage(image, face.sx, face.sy, faceWidth, faceHeight, 0, 0, faceWidth, faceHeight);
      canvases.push(canvas);
    }

    const cubeTexture = new THREE.CubeTexture(canvases);
    cubeTexture.needsUpdate = true;
    cubeTexture.colorSpace = THREE.SRGBColorSpace;
    return cubeTexture;
  },
  // Check if a texture is grayscale
  isTextureGrayscale(texture, tolerance = 5, sampleSize = 100) {
    const { data, width, height } = texture.image;
    const channels = data.length / (width * height);

    // Textures with 1 (Luminance) or 2 (LuminanceAlpha) channels are inherently grayscale.
    if (channels === 1 || channels === 2) return true;

    // We can only sample pixels for RGB and RGBA textures.
    if (channels < 3) return false; // Should not happen if the above cases are handled.

    const numPixels = width * height;
    const step = Math.max(1, Math.floor(numPixels / sampleSize));

    let grayscalePixels = 0;
    let sampledPixels = 0;

    for (let i = 0; i < numPixels; i += step) {
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];

      const rgDiff = Math.abs(r - g);
      const rbDiff = Math.abs(r - b);
      const gbDiff = Math.abs(g - b);

      if (rgDiff <= tolerance && rbDiff <= tolerance && gbDiff <= tolerance) {
        grayscalePixels++;
      }
      sampledPixels++;
    }

    // If over 90% of sampled pixels are grayscale, consider the texture grayscale.
    return (grayscalePixels / sampledPixels) > 0.9;
  },
  // Loads a texture and sets it as the scene background.
  async loadAndSetBackground(url, filename) {
    if (!msh3js.three.textureLoader) msh3js.createLoaders();

    let loader = msh3js.three.textureLoader; // Default to standard image loader

    // Select the correct loader based on file extension
    if (filename.endsWith('.tga')) {
      loader = msh3js.three.tgaLoader;
    } else if (filename.endsWith('.exr')) {
      loader = msh3js.three.exrLoader;
    } else if (filename.endsWith('.hdr')) {
      loader = msh3js.three.rgbeLoader;
    }

    try {
      const backgroundTexture = await loader.loadAsync(url);
      backgroundTexture.mapping = THREE.EquirectangularReflectionMapping;
      backgroundTexture.colorSpace = THREE.SRGBColorSpace;

      msh3js.three.scene.background = backgroundTexture;
      msh3js.three.scene.environment = backgroundTexture; // Also set as environment map for reflections

      if (msh3js.debug) console.log(`loadAndSetBackground::Successfully set ${filename} as background and environment.`);
    } catch (error) {
      console.error(`loadAndSetBackground::Error loading background image ${filename}:`, error);
      alert(`Failed to load background image: ${filename}\n\n${error}`);
    } finally {
      URL.revokeObjectURL(url); // Clean up the object URL
    }
  },

  // Imports and applies animations from one or more MSH files to the currently loaded model(s).
  async importAnimations(files) {
    if (!msh3js.three.msh || msh3js.three.msh.length === 0) {
      alert("Please load a base model before importing animations.");
      return;
    }

    // Get a set of all bone names from the currently loaded model(s).
    // This will be used to filter the incoming animation tracks.
    const existingBoneNames = new Set();
    for (const msh of msh3js.three.msh) {
      msh.group.traverse((child) => {
        if (child.isBone) existingBoneNames.add(child.name);
      });
    }

    let animationsAdded = false;
    for (const file of files) {
      if (file.name.toLowerCase().endsWith(".msh")) {
        const fileURL = URL.createObjectURL(file);
        try {
          // Load the MSH file but only use its animation data.
          const animScene = await msh3js.three.mshLoader.loadAsync(fileURL);

          if (animScene.animations && animScene.animations.length > 0) {
            if (msh3js.debug) console.log(`importAnimations::Found ${animScene.animations.length} animations in ${file.name}`);

            // Add these new animation clips to every currently loaded MSH group.
            // This assumes the skeleton is compatible.
            for (const msh of msh3js.three.msh) {
              for (const sourceClip of animScene.animations) {
                // Prepend the source MSH filename to the animation name to ensure uniqueness.
                // e.g., "run.msh" with clip "anim" becomes "run_anim".
                const sourceFileName = file.name.replace(/\.msh$/i, '');
                const newAnimationName = `${sourceFileName}_${sourceClip.name}`;

                // Avoid adding duplicate animations
                if (!THREE.AnimationClip.findByName(msh.group.animations, newAnimationName)) {
                  // Filter the tracks to include only those for bones that exist in the target model.
                  const filteredTracks = sourceClip.tracks.filter(track => {
                    // The track name is formatted as "boneName.property".
                    const boneName = track.name.split('.')[0];
                    return existingBoneNames.has(boneName);
                  });

                  if (msh3js.debug) console.log(`importAnimations::Clip "${sourceClip.name}" renamed to "${newAnimationName}" and filtered from ${sourceClip.tracks.length} to ${filteredTracks.length} tracks.`);

                  const newClip = new THREE.AnimationClip(newAnimationName, sourceClip.duration, filteredTracks);
                  msh.group.animations.push(newClip);
                  msh.animations.push({ name: newAnimationName }); // Also update our internal list
                  animationsAdded = true;
                }
              }
            }
          }
        } catch (error) {
          console.error(`importAnimations::Error processing animation file ${file.name}:`, error);
        }
        URL.revokeObjectURL(fileURL);
      }
    }
    // If we successfully added animations, rebuild the UI to show them.
    if (animationsAdded) {
      msh3js.updateAnimationList(); // Efficiently update only the dropdown
      if (msh3js.debug) console.log("importAnimations::Animation list updated.");
    }
  },

  // Initialize cloth simulations for all cloth meshes
  async initClothSimulations() {
    if (!msh3js.three.msh || msh3js.three.msh.length === 0) return;

    // Dynamically import MeshBVH if not already loaded
    let MeshBVH;
    if (msh3js._modules.MeshBVH) {
      MeshBVH = msh3js._modules.MeshBVH;
    } else {
      try {
        const bvhModule = await import("three-mesh-bvh");
        MeshBVH = bvhModule.MeshBVH;
        msh3js._modules.MeshBVH = MeshBVH;
        if (msh3js.debug) console.log("initClothSimulations::MeshBVH module dynamically imported.");
      } catch (e) {
        console.error("initClothSimulations::Failed to import MeshBVH:", e);
        return; // Can't proceed without BVH
      }
    }

    for (const msh of msh3js.three.msh) {
      msh.clothSimulations = []; // Always re-initialize or clear existing simulations for this MSH

      const clothMeshes = [];
      const collisionObjects = [];

      msh.group.traverse((obj) => {
        if (obj.isMesh) {
          if (obj.userData.isCloth) {
            clothMeshes.push(obj);
          } else if (obj.name.toLowerCase().startsWith("c_")) {
            collisionObjects.push(obj);
          }
        }
      });

      // Build BVH for all collision objects
      for (const collisionObj of collisionObjects) {
        // The BVH is stored on the geometry for later access
        collisionObj.geometry.boundsTree = new MeshBVH(collisionObj.geometry);
      }

      for (const clothMesh of clothMeshes) {
        const geometry = clothMesh.geometry;
        const positionAttr = geometry.getAttribute('position');

        if (!positionAttr) continue;

        let clothData = null;
        for (const model of msh.models) {
          if (model.modl.geom && model.modl.geom.cloth) {
            if (clothMesh.name === model.modl.geom.cloth.name) {
              clothData = model.modl.geom.cloth;
              break;
            }
          }
        }

        const particles = [];
        const constraints = [];
        const vertexCount = positionAttr.count;

        for (let i = 0; i < vertexCount; i++) {
          const x = positionAttr.getX(i);
          const y = positionAttr.getY(i);
          const z = positionAttr.getZ(i);
          const worldPos = new THREE.Vector3(x, y, z);
          clothMesh.localToWorld(worldPos);

          particles.push({
            position: worldPos.clone(),
            previousPosition: worldPos.clone(),
            originalPosition: new THREE.Vector3(x, y, z),
            velocity: new THREE.Vector3(0, 0, 0),
            mass: 1.0,
            fixed: false,
            bone: null, // To store a reference to the attached bone object
            boneOffset: null, // To store the initial offset from the bone
          });
        }

        // Combine FIDX and FWGT data to create attachments.
        const attachments = [];
        if (clothData && clothData.fidx?.fixedPoints && clothData.fwgt?.boneNames) {
          const fixedPoints = clothData.fidx.fixedPoints;
          const boneNames = clothData.fwgt.boneNames;
          const count = Math.min(fixedPoints.length, boneNames.length);

          for (let i = 0; i < count; i++) {
            attachments.push({
              vertexIndex: fixedPoints[i],
              boneName: boneNames[i].toLowerCase()
            });
          }
        }

        // Find the "bone" Object3Ds and link them to the particles.
        if (attachments.length > 0) {
          msh.group.traverse((child) => {
            if (child.isObject3D && child.name) {
              const objectName = child.name.toLowerCase();
              for (const attachment of attachments) {
                if (attachment.boneName === objectName) {
                  const particleIndex = attachment.vertexIndex;
                  if (particleIndex < particles.length) {
                    particles[particleIndex].fixed = true; // Mark as "fixed" to a bone
                    particles[particleIndex].bone = child; // Store the object reference
                    // Calculate and store the particle's initial position relative to the bone's local space.
                    const boneInverseMatrix = new THREE.Matrix4().copy(child.matrixWorld).invert();
                    const offset = particles[particleIndex].position.clone().applyMatrix4(boneInverseMatrix);
                    particles[particleIndex].boneOffset = offset;
                  }
                }
              }
            }
          });
        }

        if (clothData && clothData.fidx && clothData.fidx.fixedPoints) {
          for (const fixedIndex of clothData.fidx.fixedPoints) {
            if (fixedIndex < particles.length) {
              particles[fixedIndex].fixed = true;
            }
          }
        }

        // Define stiffness for each constraint type
        const stretchStiffness = 0.9;
        const crossStiffness = 0.7;
        const bendStiffness = 0.2;

        // Helper function to add constraints from data
        const addConstraintsFromData = (pointData, stiffness, type) => {
          if (!pointData) return;
          for (let i = 0; i < pointData.length; i += 2) {
            const pA_idx = pointData[i];
            const pB_idx = pointData[i + 1];

            if (pA_idx < particles.length && pB_idx < particles.length) {
              const restLength = particles[pA_idx].position.distanceTo(particles[pB_idx].position);
              constraints.push({
                particleA: pA_idx,
                particleB: pB_idx,
                restLength: restLength,
                stiffness: stiffness,
                type: type,
              });
            }
          }
        };

        if (clothData) {
          // Add stretch constraints (SPRS)
          if (clothData.sprs && clothData.sprs.stretchPoints) {
            addConstraintsFromData(clothData.sprs.stretchPoints, stretchStiffness, 'stretch');
          }
          // Add cross constraints (CPRS)
          if (clothData.cprs && clothData.cprs.crossPoints) {
            addConstraintsFromData(clothData.cprs.crossPoints, crossStiffness, 'cross');
          }
          // Add bend constraints (BPRS)
          if (clothData.bprs && clothData.bprs.bendPoints) {
            addConstraintsFromData(clothData.bprs.bendPoints, bendStiffness, 'bend');
          }
        }

        // Fallback: if no constraint data is found, generate from mesh edges
        if (constraints.length === 0) {
          console.warn(`No cloth constraint data found for ${clothMesh.name}. Generating from mesh edges as a fallback.`);
          const indexAttr = geometry.getIndex();
          if (indexAttr) {
            for (let i = 0; i < indexAttr.array.length; i += 3) {
              const a = indexAttr.array[i];
              const b = indexAttr.array[i + 1];
              const c = indexAttr.array[i + 2];
              addConstraintsFromData([a, b, b, c, c, a], stretchStiffness, 'stretch'); // Treat all as stretch
            }
          }
        }

        msh.clothSimulations.push({
          mesh: clothMesh,
          particles: particles,
          constraints: constraints,
          collisionObjects: collisionObjects,
        });

        if (msh3js.debug) {
          console.log(`Cloth simulation initialized for ${clothMesh.name}:`, {
            particles: particles.length,
            constraints: constraints.length,
            fixedPoints: particles.filter(p => p.fixed).length,
            collisionObjects: collisionObjects.length,
          });
        }
      }
    }
  },

  // Reset cloth simulations
  resetClothSimulations() {
    if (!msh3js.three.msh || msh3js.three.msh.length === 0) return;

    for (const msh of msh3js.three.msh) {
      if (msh.clothSimulations) {
        for (const clothSim of msh.clothSimulations) {
          const geometry = clothSim.mesh.geometry;
          const positionAttr = geometry.getAttribute('position');

          for (let i = 0; i < clothSim.particles.length; i++) {
            const particle = clothSim.particles[i];
            positionAttr.setXYZ(
              i,
              particle.originalPosition.x,
              particle.originalPosition.y,
              particle.originalPosition.z
            );
            particle.position.copy(particle.originalPosition);
            particle.previousPosition.copy(particle.originalPosition);
            particle.velocity.set(0, 0, 0);
          }

          positionAttr.needsUpdate = true;
          geometry.computeVertexNormals();
        }
      }
    }
  },

  // Update cloth simulation (Verlet integration)
  updateClothSimulation(clothSim, deltaTime) {
    const dt = Math.min(deltaTime, 0.016);
    const iterations = 3; // Constraint relaxation iterations
    const gravityStrength = 9.8;
    const damping = 0.95;

    // Add some noise/variation to the wind to make it feel more natural
    const windStrengthVariation = (Math.sin(msh3js.renderTime / 300) + Math.sin(msh3js.renderTime / 800)) * 0.25 + 1.0; // Varies between 50% and 150%
    const currentWindSpeed = msh3js.options.clothWindSpeed * windStrengthVariation;

    const windRad = THREE.MathUtils.degToRad(msh3js.options.clothWindDirection);
    const windForce = new THREE.Vector3(
      Math.cos(windRad) * currentWindSpeed,
      0,
      Math.sin(windRad) * currentWindSpeed
    );

    const gravity = new THREE.Vector3(0, -gravityStrength, 0);

    for (const particle of clothSim.particles) {
      // If a particle is "fixed" AND attached to a bone, update its position.
      if (particle.fixed) {
        if (particle.bone) {
          // Calculate the new world position by applying the bone's current world matrix
          // to the stored offset. This makes the particle follow the bone's movement.
          particle.position.copy(particle.boneOffset).applyMatrix4(particle.bone.matrixWorld);
          // Update the previous position to prevent incorrect velocity on the next frame.
          particle.previousPosition.copy(particle.position);
        }
        continue; // Skip physics for this particle.
      }

      const force = gravity.clone().add(windForce);
      const acceleration = force.divideScalar(particle.mass);

      const temp = particle.position.clone();
      particle.position.multiplyScalar(2)
        .sub(particle.previousPosition)
        .add(acceleration.multiplyScalar(dt * dt));

      particle.position.lerp(temp, 1 - damping);
      particle.previousPosition.copy(temp);
    }

    for (let iter = 0; iter < iterations; iter++) {
      for (const constraint of clothSim.constraints) {
        const pA = clothSim.particles[constraint.particleA];
        const pB = clothSim.particles[constraint.particleB];

        if (pA.fixed && pB.fixed) continue;

        const delta = pB.position.clone().sub(pA.position);
        const currentLength = delta.length();
        const diff = (currentLength - constraint.restLength) / currentLength;
        const offset = delta.multiplyScalar(diff * constraint.stiffness * 0.5);

        if (!pA.fixed) pA.position.add(offset);
        if (!pB.fixed) pB.position.sub(offset);
      }
    }

    for (const collisionObj of clothSim.collisionObjects) {
      const boundingSphere = new THREE.Sphere();
      collisionObj.geometry.computeBoundingSphere();
      boundingSphere.copy(collisionObj.geometry.boundingSphere);
      boundingSphere.applyMatrix4(collisionObj.matrixWorld);

      for (const particle of clothSim.particles) {
        if (particle.fixed) continue;

        const distance = particle.position.distanceTo(boundingSphere.center);
        if (distance < boundingSphere.radius) {
          const normal = particle.position.clone().sub(boundingSphere.center).normalize();
          particle.position.copy(boundingSphere.center).add(normal.multiplyScalar(boundingSphere.radius));
        }
      }
    }

    const geometry = clothSim.mesh.geometry;
    const positionAttr = geometry.getAttribute('position');
    const worldToLocal = new THREE.Matrix4().copy(clothSim.mesh.matrixWorld).invert();
    if (!positionAttr) return;

    for (let i = 0; i < clothSim.particles.length; i++) {
      const localPos = clothSim.particles[i].position.clone().applyMatrix4(worldToLocal);
      positionAttr.setXYZ(i, localPos.x, localPos.y, localPos.z);
    }

    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  },

  // Plays a specific animation by name
  playAnimation(animationName) {
    if (msh3js.debug) console.log(`playAnimation::Attempting to play "${animationName}"`);
    msh3js.stopAllAnimations(false); // Stop previous animations without resetting the UI

    if (animationName === 'None') {
      msh3js.ui.animationPlaying = false;
      if (msh3js.pane) msh3js.pane.refresh();
      return;
    }

    let animationPlayed = false;
    for (const msh of msh3js.three.msh) {
      if (msh.group.animations && msh.group.animations.length > 0) {
        const clip = THREE.AnimationClip.findByName(msh.group.animations, animationName);
        // If the clip is found in this MSH group, create the action with this group as the root.
        if (clip) {
          // The second argument to clipAction specifies the root object for the animation.
          // This is crucial because the animation tracks are relative to the msh.group.
          const action = msh3js.three.mixer.clipAction(clip, msh.group);
          msh3js.three.mixer.timeScale = msh3js.ui.animationSpeed; // Ensure mixer speed is set
          action.setLoop(msh3js.ui.animationLoop ? THREE.LoopRepeat : THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.reset().play();
          animationPlayed = true;
          if (msh3js.debug) console.log(`playAnimation::Playing "${animationName}" on ${msh.fileName}`);
        }
      }
    }
    msh3js.ui.animationPlaying = animationPlayed;
    if (msh3js.pane) msh3js.pane.refresh();
  },

  // Stops all currently playing animations
  stopAllAnimations(resetUi = true) {
    if (msh3js.three.mixer) msh3js.three.mixer.stopAllAction();
    msh3js.ui.animationPlaying = false;
    if (resetUi) {
      msh3js.ui.currentAnimation = 'None';
    }
    if (msh3js.pane) msh3js.pane.refresh();
    if (msh3js.debug) console.log("stopAllAnimations::All animations stopped.");
  },

  // Makes an HTML element draggable.
  makeDraggable(element) {
    let isDragging = false; // Is a drag operation in progress?
    let hasDragged = false; // Did the mouse move enough to be considered a drag?
    let offsetX = 0;
    let offsetY = 0;
    const startPos = { x: 0, y: 0 };
    const dragThreshold = 5; // Minimum pixels to move before it's a drag

    // Set cursor to 'grab' on hover over the title bar
    element.addEventListener('mouseover', (e) => {
      const target = e.target;
      if (target.classList.contains('tp-rotv_t')) {
        target.style.cursor = 'grab';
      }
    });

    const onDragStart = (e) => {
      // Use the first touch point for touch events, or the mouse event itself
      const point = e.touches ? e.touches[0] : e;

      // Only start dragging if the click is on the pane's title bar or a folder header
      const target = e.target;
      if (target.classList.contains('tp-rotv_t')) {
        isDragging = true;
        hasDragged = false; // Reset on new mousedown
        startPos.x = point.clientX;
        startPos.y = point.clientY;
        offsetX = point.clientX - element.getBoundingClientRect().left;
        offsetY = point.clientY - element.getBoundingClientRect().top;

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);

        target.style.cursor = 'grabbing'; // Set cursor to 'grabbing' while dragging
        // Add a capture-phase click listener to intercept the click before Tweakpane does.
        element.addEventListener('click', onClickCapture, { capture: true });
      }
    };

    const onDragMove = (e) => {
      if (!isDragging) return;

      // Prevent scrolling during drag on touch devices
      if (e.touches) e.preventDefault();

      const point = e.touches ? e.touches[0] : e;

      // Check if the mouse has moved beyond the threshold
      if (!hasDragged) {
        const dx = point.clientX - startPos.x;
        const dy = point.clientY - startPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
          hasDragged = true;
        }
      }

      const parentRect = msh3js._appContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Calculate the new position relative to the viewport
      const newLeft = point.clientX - offsetX;
      const newTop = point.clientY - offsetY;

      // Clamp the position within the parent container's bounds, accounting for the parent's position.
      element.style.left = `${Math.max(parentRect.left, Math.min(newLeft, parentRect.right - elementRect.width)) - parentRect.left}px`;
      element.style.top = `${Math.max(parentRect.top, Math.min(newTop, parentRect.bottom - elementRect.height)) - parentRect.top}px`;
    };

    const onDragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragMove);
      document.addEventListener('touchend', onDragEnd);
      document.body.style.cursor = ''; // Reset cursor on drag end
    };

    element.addEventListener('mousedown', onDragStart);
    element.addEventListener('touchstart', onDragStart, { passive: false });

    const onClickCapture = (e) => {
      // If a drag occurred, stop the click event from reaching Tweakpane.
      if (hasDragged) {
        e.stopPropagation();
      }
      // This listener should only run once per mousedown, so remove it immediately.
      element.removeEventListener('click', onClickCapture, { capture: true });
    };
  },

  // Makes an HTML element resizable from its right edge.
  makeResizable(element) {
    const minWidth = 240;
    const handleWidth = 8; // Increased handle area for easier grabbing

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    // This function checks the mouse position and changes the cursor.
    const onMouseMoveCursor = (e) => {
      if (isResizing) return; // Don't change cursor while actively resizing

      const rect = element.getBoundingClientRect();
      // Check if the mouse is over the right edge.
      // We use clientX and rect.right for viewport-relative coordinates.
      if (e.clientX >= rect.right - handleWidth && e.clientX <= rect.right) {
        element.style.cursor = 'ew-resize';
      }
    };

    const onMouseDown = (e) => {
      // Only start resizing if the cursor is the resize cursor.
      if (element.style.cursor === 'ew-resize') {
        isResizing = true;
        startX = e.clientX;
        startWidth = element.offsetWidth;

        // Prevent text selection and other default behaviors during resize.
        e.preventDefault();
        e.stopPropagation();

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;

      const dx = e.clientX - startX;
      let newWidth = startWidth + dx;

      // Enforce minimum width
      newWidth = Math.max(minWidth, newWidth);

      element.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    // Listen for mouse movement over the element to change the cursor.
    element.addEventListener('mousemove', onMouseMoveCursor);
    element.addEventListener('mousedown', onMouseDown);
  },
};

export default msh3js;