"use strict";
// msh3js.js - Main for msh3js msh model viewer
// (c) 2025 by Landon Hull aka Calrissian97
// This code is licensed under GPL 3.0
// Module Imports ------------------------------------------------------
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MSHLoader } from "./MSHLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
// Note: The following will be imported dynamically instead
//import { ViewHelper } from "view-helper";
//import { Pane } from "tweakpane";
//import "tweakpane-plugin-html-color-picker";
//import Stats from "stats-gl";
//import "webgl-lint";
//import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
//import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
//import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
//import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
//import { getCurrentWindow } from "@tauri-apps/api/window";
//import { join, dirname } from "@tauri-apps/api/path";
//import { emit, listen } from "@tauri-apps/api/event";
//import { open } from "@tauri-apps/plugin-dialog";
//import { readFile, readTextFile, exists } from "@tauri-apps/plugin-fs";
//import { OBB } from "three/addons/math/OBB.js";

// Global app object/namespace for application state and data
const msh3js = {
  // Debugging flag
  debug: false,
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
    dirLight2Color: "#ffffff", // Secondary directional light color
    dirLight2Intensity: 0.0, // Disable secondary directional light by default
    dirLight2Azimuth: 270.0, // Set opposite orientation as dirLight1 by default
    dirLight2Elevation: -30.0, // Set opposite of dirLight1 by default
    ambLightColor: "#4d4d4d", // Ambient light color
    ambLightIntensity: 1.0, // Ambient light intensity
    enableViewHelper: true, // Visibility of view helper
    viewHelperColors: { x: "#AA0000", y: "#00AA00", z: "#0000AA" }, // View helper colors
    enableShadows: false, // Enable shadows
    preferredGPU: "high-performance", // GPU preference
    aa: false, // anti-aliasing flag
    sampleCount: 0, // sample count
    anisotropicFiltering: 1,
    pixelRatio: window.devicePixelRatio ?? 1.0, // pixel ratio
    bloomEnabled: false, // Enable bloom effect
    bloomStrength: 1.5, // Bloom strength
    bloomRadius: 0.1, // Bloom radius
    bloomThreshold: 0.0, // Bloom threshold
    showStats: false, // Show stats flag
    showSkeleton: false, // Show skeleton helper
    clothSim: false, // Enable cloth simulation
    clothWindSpeed: 2.0, // Wind speed for cloth simulation
    clothWindDirection: 280.0, // Wind direction in degrees (0-360)
    renderingAPI: 'webgl2', // webgl or webgl2
    tweakpaneFont: "Orbitron", // Font for Tweakpane UI
    AR: false, // Enable AR viewing
    VR: false, // Enable VR viewing
    transparentBackground: false, // Enable transparent window (Tauri only)
    showMSHData: false, // Show raw collected MSH data folders
  },
  // Start options, can override saved app options
  startOptions: null,
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
    // Three.JS cube camera for refraction envmap
    cubeCamera: null,
    // Camera state for refraction cubecam optimization
    lastCameraPosition: null,
    lastCameraQuaternion: null,
    // Pre-compiled lists for render loop optimization
    dynamic: {
      scrollingMaterials: [],
      animatedMaterials: [],
      pulsatingMaterials: [],
      refractiveMeshes: [],
      clothMeshes: [],
      collisionObjects: [],
    },
    // Post-processing for bloom
    composer: null,
    bloomPass: null,
    bloomComposer: null,
    renderPass: null,
    darkMaterial: new THREE.MeshBasicMaterial({ color: "black" }),
    materialsToRestore: {},
    // Scene bounds
    sceneBounds: null,
    // WebXR session
    xrSession: null,
    xrSessionMode: null,
    preXRBloom: null,
    preXRBackground: null,
    xrHitTestSource: null,
    xrReticle: null,
    xrModelPlaced: false,
  },
  // Proxy object(s) for tweakpane to decouple from three
  ui: {
    animations: [],
    currentAnimation: 'None',
    animationSpeed: 1.0,
    animationPlaying: false,
    animationLoop: true,
    missingTextures: new Set(),
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
  // App listeners
  _listeners: {
    fileDrop: null,
    fileInput: null,
    resize: null,
    serviceWorker: null,
    tweakpaneClick: null,
    animFileInput: null,
    bgFileInput: null,
    keyControls: null,
    draggable: new Map(), // Use a Map to track listeners for multiple draggable elements
    resizable: new Map(), // Use a Map to track listeners for multiple resizable elements
    dragMove: null, // For document-level drag listeners
    dragClickCapture: null, // For the temporary click capture during a drag
    resizeMove: null,
  },
  // (HTML div) container for app and canvas
  _appContainer: null,
  // (HTML div) container for tweakpane controls
  _tweakpaneContainer: null,
  // Loading bar elements
  _loadingBar: {
    container: null,
    spheres: [],
    spheresCount: 0,
    processedCount: 0,
  },
  // service worker
  _serviceWorker: null,
  // Dynamically Imported modules (ViewHelper, Stats, Tweakpane, webgl-lint)
  _modules: {},
  // Input asset files (.msh, .tga, .option)
  _files: {},
  // Animation-only input files (.msh)
  _animFiles: {},
  // HTML file input
  _fileInput: null,
  // Client capabilities
  _supportedFeatures: {
    webgl: { supported: false, aa: false, maxSamples: 0, reverseDepth: false, sampleCountOptions: [] }, // WebGL support flag
    webgl2: { supported: false, aa: false, maxSamples: 0, reverseDepth: true, sampleCountOptions: [] }, // WebGL2 support flag
    maxAnisotropy: 1, // Max samples for anisotropic filtering
    localStorage: false, // LocalStorage support flag
    persistentStorage: false, // PersistentStorage support flag
    serviceWorker: false, // ServiceWorker support flag
    xr: { supported: false, ar: false, vr: false }, // XR support flags
  },
  // Reverse depth buffer flag (for large geometries)
  _useReverseDepth: false,
  // State for draggable elements, keyed by the element itself
  _draggableStates: new Map(),
  // State for resizable elements, keyed by the element itself
  _resizableStates: new Map(),
  // Is in a Tauri environment
  isTauri: false,

  // Initializes app state and populates msh3js object
  async initApp(params, options = {}) {
    if (msh3js.debug) console.log("initApp::params:", params);
    // Store params for startThree from processFiles (launch files)
    msh3js.startOptions = options;

    // Test for localStorage permissions
    if (window.localStorage) {
      const testItem = "__storage_test__";
      try {
        window.localStorage.setItem(testItem, testItem);
        window.localStorage.removeItem(testItem);
        msh3js._supportedFeatures.localStorage = true;
      } catch (e) {
        console.error("initApp::localStorage error:", e);
      }
    }

    let msh3jsOptions = null;
    // Update options object from localStorage (User preferences)
    if (msh3js._supportedFeatures.localStorage) {
      try {
        msh3jsOptions = window.localStorage.getItem("msh3js_options");
        if (msh3jsOptions) {
          Object.assign(msh3js.options, JSON.parse(msh3jsOptions));
          if (msh3js.debug) console.log("initApp::msh3js_options object loaded from localStorage.");
        } else if (msh3js.debug) console.log("initApp::msh3js_options object not found in localStorage.");
      } catch (e) {
        console.error("initApp::Error loading msh3js_options from localStorage:", e);
      }
    }

    // Assign msh3js global HTML containers
    msh3js.canvas = params.appCanvas;
    msh3js._appContainer = params.appContainer;
    msh3js._tweakpaneContainer = params.tweakpaneContainer;
    msh3js._loadingBar.container = params.loadingContainer;

    // --- Process passed app options (Overrides options from localStorage if present) ---
    // Helper function to validate and assign a value
    const assignOption = (key, value, validator) => {
      if (value != null && validator(value)) {
        msh3js.options[key] = value;
      } else if (value != null && msh3js.debug) {
        console.warn(`initApp::Invalid value for option "${key}":`, value);
      }
    };

    // Helper function to validate a hex color string
    const isHexColor = (value) => typeof value === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(value);
    // Helper function to validate a number within a range
    const isNumberInRange = (min, max) => (value) => typeof value === 'number' && value >= min && value <= max;
    // Helper function to validate a boolean
    const isBoolean = (value) => typeof value === 'boolean';
    // Helper function to validate a string
    const isString = (value) => typeof value === 'string';

    if (options.AA != null && isBoolean(options.AA)) msh3js.options.aa = options.AA;
    if (options.AAsampleCount != null && isNumberInRange(0, 16)(options.AAsampleCount)) {
      msh3js.options.sampleCount = options.AAsampleCount;
      msh3js.options.aa = options.AAsampleCount > 0;
    }
    if (options.anisotropicFiltering != null && isNumberInRange(1, 16)) msh3js.options.anisotropicFiltering = options.anisotropicFiltering;
    if (options.ambLightColor != null && isHexColor(options.ambLightColor)) msh3js.options.ambLightColor = options.ambLightColor;
    if (options.ambLightIntensity != null && isNumberInRange(0, 10)(options.ambLightIntensity)) msh3js.options.ambLightIntensity = options.ambLightIntensity;
    if (options.autoRotate != null && isBoolean(options.autoRotate)) msh3js.options.autoRotate = options.autoRotate;
    if (options.autoRotateSpeed != null && isNumberInRange(0, 20)(options.autoRotateSpeed)) msh3js.options.autoRotateSpeed = options.autoRotateSpeed;
    if (options.backgroundColor != null && isHexColor(options.backgroundColor)) msh3js.options.backgroundColor = options.backgroundColor;
    if (options.backgroundImage != null && isString(options.backgroundImage)) msh3js.options.backgroundImage = options.backgroundImage;

    if (options.bloom) {
      assignOption('bloomEnabled', options.bloom.enabled, isBoolean);
      assignOption('bloomThreshold', options.bloom.threshold, isNumberInRange(0.0, 1.0));
      assignOption('bloomStrength', options.bloom.strength, isNumberInRange(0.0, 3.0));
      assignOption('bloomRadius', options.bloom.radius, isNumberInRange(0.0, 1.0));
    }

    if (options.cloth) {
      assignOption('clothSim', options.cloth.enabled, isBoolean);
      assignOption('clothWindSpeed', options.cloth.windSpeed, isNumberInRange(0, 10));
      assignOption('clothWindDirection', options.cloth.windDirection, isNumberInRange(0, 360));
    }

    assignOption('controlDamping', options.controlDamping, isBoolean);

    if (options.dirLight1) {
      assignOption('dirLightColor', options.dirLight1.color, isHexColor);
      assignOption('dirLightIntensity', options.dirLight1.intensity, isNumberInRange(0, 10));
      assignOption('dirLightAzimuth', options.dirLight1.azimuth, isNumberInRange(0, 360));
      assignOption('dirLightElevation', options.dirLight1.elevation, isNumberInRange(-90, 90));
    }

    if (options.dirLight2) {
      assignOption('dirLight2Color', options.dirLight2.color, isHexColor);
      assignOption('dirLight2Intensity', options.dirLight2.intensity, isNumberInRange(0, 10));
      assignOption('dirLight2Azimuth', options.dirLight2.azimuth, isNumberInRange(0, 360));
      assignOption('dirLight2Elevation', options.dirLight2.elevation, isNumberInRange(-90, 90));
    }

    if (options.displayHelpers != null && isBoolean(options.displayHelpers)) {
      msh3js.options.enableDirLightHelper = options.displayHelpers;
      msh3js.options.enableDirLightHelper2 = options.displayHelpers;
      msh3js.options.enableViewHelper = options.displayHelpers;
      msh3js.options.enableGrid = options.displayHelpers;
      msh3js.options.showSkeleton = options.displayHelpers;
    }

    assignOption('enableShadows', options.enableShadows, isBoolean);
    assignOption('showStats', options.displayStats, isBoolean);
    assignOption('displayTweakpane', options.displayTweakpane, isBoolean);

    if (options.GPU != null && ['default', 'low-power', 'high-performance'].includes(options.GPU)) {
      msh3js.options.preferredGPU = options.GPU;
    }

    assignOption('pixelRatio', options.pixelRatio, isNumberInRange(0.25, 3.0));

    if (options.renderingAPI != null && ['webgl', 'webgl2'].includes(options.renderingAPI)) {
      msh3js.options.renderingAPI = options.renderingAPI;
    }

    assignOption('tweakpaneFont', options.tweakpaneFont, isString);

    if (options.viewHelperColors) {
      const isHexNumber = (v) => typeof v === 'number' && v >= 0 && v <= 0xFFFFFF;
      if (options.viewHelperColors.x != null && isHexNumber(options.viewHelperColors.x)) msh3js.options.viewHelperColors.x = options.viewHelperColors.x;
      if (options.viewHelperColors.y != null && isHexNumber(options.viewHelperColors.y)) msh3js.options.viewHelperColors.y = options.viewHelperColors.y;
      if (options.viewHelperColors.z != null && isHexNumber(options.viewHelperColors.z)) msh3js.options.viewHelperColors.z = options.viewHelperColors.z;
    }

    if (options.xr) {
      assignOption('AR', options.xr.AR, isBoolean);
      assignOption('VR', options.xr.VR, isBoolean);
    }

    if (options.size != null && isString(options.size.width) && isString(options.size.height)) {
      msh3js._appContainer.style.width = options.size.width;
      msh3js._appContainer.style.height = options.size.height;
    }

    // Set canvas size to fill _appContainer
    if (msh3js.canvas) {
      msh3js.canvas.style.width = '100%';
      msh3js.canvas.style.height = '100%';
    }

    // Get canvas size and record
    msh3js.size = {
      width: msh3js.canvas.clientWidth * msh3js.options.pixelRatio,
      height: msh3js.canvas.clientHeight * msh3js.options.pixelRatio,
    }
    if (msh3js.debug) console.log("initApp::appSize:", msh3js.size.width, "x", msh3js.size.height);

    // Register service worker to serve app content offline, clear cache and preferences
    if (window.navigator.serviceWorker && !msh3js.isTauri) {
      try {
        const registration = await window.navigator.serviceWorker.register("./sw.js");
        // Store registration status
        msh3js._serviceWorker = registration.active ?? registration.waiting ?? registration.installing;
        // Set supportedFeatures value if service worker is enabled
        msh3js._supportedFeatures.serviceWorker = !!msh3js._serviceWorker;
        msh3js.manageListeners("add", "serviceWorker");
      } catch (e) { console.error("initApp::Service Worker registration failed:", e); }
    }

    // Check for webXR support
    if (window.navigator.xr) {
      msh3js._supportedFeatures.xr.supported = true
      // VR support
      msh3js._supportedFeatures.xr.vr = await window.navigator.xr.isSessionSupported("immersive-vr");
      // AR support
      msh3js._supportedFeatures.xr.ar = await window.navigator.xr.isSessionSupported("immersive-ar");
      if (msh3js.debug) console.log("initApp::WebXR supported:", msh3js._supportedFeatures.xr);
    } else {
      if (msh3js.debug) console.log("initApp::WebXR not supported.");
    }

    // Get supported graphics features
    await msh3js.getSupportedGraphicsFeatures();

    // Validate selected renderingAPI
    const preferredApi = msh3js.options.renderingAPI;
    const isPreferredApiSupported = msh3js._supportedFeatures[preferredApi]?.supported;

    if (!isPreferredApiSupported) {
      if (msh3js.debug) console.warn(`initApp::Preferred API "${preferredApi}" is not supported. Attempting to find a fallback.`);
      // Define a fallback order
      const fallbackOrder = ['webgl2', 'webgl'];
      let foundFallback = false;
      for (const api of fallbackOrder) {
        if (msh3js._supportedFeatures[api]?.supported) {
          msh3js.options.renderingAPI = api;
          if (msh3js.debug) console.log(`initApp::Falling back to supported API: "${api}"`);
          foundFallback = true;
          break;
        }
      }
      if (!foundFallback) {
        console.error("initApp::No supported graphics API found!");
        return null;
      }
    } else if (msh3js.debug) {
      console.log(`initApp::Using preferred graphics API: "${preferredApi}"`);
    }

    // Set a default AA sample count if it wasn't specified
    const userSetSampleCount = (msh3jsOptions != null) || (options.AAsampleCount != null || options.AA != null);
    if (!userSetSampleCount) {
      const apiFeatures = msh3js._supportedFeatures[msh3js.options.renderingAPI];
      if (apiFeatures.aa) {
        // Find the first available sample count greater than 0.
        const defaultSampleOption = apiFeatures.sampleCountOptions.find(opt => opt.value > 0);
        if (defaultSampleOption) {
          msh3js.options.sampleCount = defaultSampleOption.value;
          msh3js.options.aa = true;
          if (msh3js.debug) {
            console.log(`initApp::AA not specified by user. Defaulting to ${msh3js.options.sampleCount}x for ${msh3js.options.renderingAPI}.`);
          }
        }
      }
    } else {
      // Validate the user-set AA value
      const apiFeatures = msh3js._supportedFeatures[msh3js.options.renderingAPI];
      const supportedSampleCounts = apiFeatures.sampleCountOptions.map(opt => opt.value);
      const userSampleCount = msh3js.options.sampleCount;

      if (!supportedSampleCounts.includes(userSampleCount)) {
        if (msh3js.debug) {
          console.warn(`initApp::User-defined sample count of ${userSampleCount}x is not supported by ${msh3js.options.renderingAPI}.`);
        }
        // Find the highest supported value that is less than the user's requested value.
        const lowerSupportedValues = supportedSampleCounts.filter(v => v < userSampleCount);
        const fallbackSampleCount = lowerSupportedValues.length > 0 ? Math.max(...lowerSupportedValues) : 0;

        msh3js.options.sampleCount = fallbackSampleCount;
        if (msh3js.debug) {
          console.warn(`initApp::Falling back to a supported sample count of ${fallbackSampleCount}x.`);
        }
      }
    }

    // Check for persistent storage
    msh3js.getPersistentStorageSupport();

    if (msh3js.debug)
      console.log("initApp::Supported features:", msh3js._supportedFeatures);

    // Create file input and add listeners
    msh3js.createFileInput();
    msh3js.manageListeners("add", "fileDropCanvas");
    msh3js.manageListeners("add", "resize");
    if (msh3js.debug) console.log("initApp::msh3js initialized", msh3js);
    // Return app object

    return msh3js;
  },

  // Main entrypoint that calls initApp with passed params and sets render method
  async startApp(canvas = null,
    options = {
      AA: null,
      anisotropicFiltering: null,
      AAsampleCount: null,
      ambLightColor: null,
      ambLightIntensity: null,
      autoRotate: null,
      autoRotateSpeed: null,
      backgroundColor: null,
      backgroundImage: null,
      bloom: null, // { enabled, threshold, strength, radius }
      cloth: null, // { enabled, windSpeed, windDirection }
      controlDamping: null,
      dirLight1: null, // { color, intensity, azimuth, elevation }
      dirLight2: null, // { color, intensity, azimuth, elevation }
      displayHelpers: null,
      enableShadows: null,
      displayStats: null,
      displayTweakpane: null,
      GPU: null,
      pixelRatio: null,
      renderingAPI: null,
      tweakpaneFont: null,
      viewHelperColors: null, // { x, y, z }
      xr: null, // { AR, VR }
      urls: null, // Array of URLs to load, e.g., ['model.msh', 'texture1.tga']
    }
  ) {
    if (msh3js.debug) {
      // Check for passed options
      let optionsPassed = false;
      for (const key in options) if (options[key] !== null) { optionsPassed = true; break; }
      console.log("startApp::canvas:", canvas);
      console.log("startApp::options:", optionsPassed ? options : "defaults");
    }
    // Seal ms3js
    Object.seal(msh3js);

    // --- Locate/Create HTML elements ---
    // Get canvas container (a div or the body if not found)
    let appContainer = document.getElementById("app") ?? document.getElementById("msh3js") ?? document.body;

    // Either get canvas from param or from HTML or create a new one inside appContainer
    // Assign directly to msh3js.canvas
    msh3js.canvas = canvas ?? document.getElementById("msh3jsCanvas") ?? appContainer.querySelector("canvas") ??
      msh3js.createCanvas({ id: "msh3jsCanvas", width: 1, height: 1 }, true);

    // Get/create tweakpane panel container (div)
    let tweakpaneContainer = null;
    // Only do this if not explicitly disabled
    if (options.displayTweakpane !== false) {
      tweakpaneContainer = document.getElementById("tweakpaneContainer");
      if (!tweakpaneContainer) {
        tweakpaneContainer = document.createElement("div");
        tweakpaneContainer.id = "tweakpaneContainer";
        appContainer.appendChild(tweakpaneContainer);
      }
    }

    // Get/create loading bar container and elements
    let loadingContainer = document.getElementById("loading-container");
    if (!loadingContainer) {
      loadingContainer = document.createElement("div");
      loadingContainer.id = 'loading-container';
      appContainer.appendChild(loadingContainer);
    }

    // Get/create loading text
    let loadingText = document.getElementById('loading-text');
    if (!loadingText) {
      loadingText = document.createElement('span');
      loadingText.id = 'loading-text';
      loadingText.textContent = 'Loading...';
      loadingContainer.appendChild(loadingText);
    }

    // Assign params from HTML element references and passed app options
    const params = { appCanvas: msh3js.canvas, appContainer, tweakpaneContainer, loadingContainer };

    // Import webgl-lint if in debug
    if (msh3js.debug)
      if (!msh3js._modules.webglLint)
        msh3js._modules.webglLint = await import("webgl-lint");

    // Initialize the app object
    const initialized = await msh3js.initApp(params, options);
    if (!initialized) {
      console.error("startApp::Failed to initialize app:", msh3js);
      // Alert the user about the requirement
      alert("Error: This application requires WebGL(1|2) or WebGPU graphics support to run.\n\n" +
        "Please try using a modern browser like Chrome, Firefox, Edge, or Safari," +
        " or check your browser's settings to ensure WebGL/WebGPU is enabled."
      );
      return msh3js;
    }
    if (msh3js.debug) console.log("startApp::App started.");

    // If URLs are provided in the options, load them.
    if (options.urls && Array.isArray(options.urls) && options.urls.length > 0) {
      await msh3js.loadFromUrls(options.urls);
    }
    // Get launch files for webapp or Tauri
    await msh3js._getLaunchFiles();

    await msh3js.startThree(options);
  },

  // Setup any unpopulated three.js components
  async initThree() {
    // Note: This function will not overwrite existing objects
    if (!msh3js.three.scene) msh3js.createScene();

    if (!msh3js.three.camera) msh3js.createCamera();

    if (!msh3js.three.orbitControls) msh3js.createOrbitControls();

    if (!msh3js.three.renderer || !msh3js.context) {
      const { renderer, context } = await msh3js.createRenderer({ // Use the user-selected API
        renderingAPI: msh3js.options.renderingAPI,
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

    if (msh3js.options.bloomEnabled === true)
      if (!msh3js.three.composer || !msh3js.three.bloomComposer)
        await msh3js.createComposer();

    if (!msh3js.three.loadingManager) msh3js.createLoaders();

    if (!msh3js.three.viewHelper)
      if (msh3js.options.enableViewHelper === true)
        await msh3js.createViewHelper();

    if (msh3js.debug) console.log("initThree::Three.js initialized:", msh3js.three);
  },

  // Begins three.js setup and rendering
  async startThree(options = {}) {
    THREE.ColorManagement.enabled = true;
    await msh3js.initThree();

    // Apply final options to the created Three.js objects
    msh3js.three.ambLight.color.set(msh3js.options.ambLightColor);
    msh3js.three.ambLight.intensity = msh3js.options.ambLightIntensity;
    msh3js.three.dirLight.color.set(msh3js.options.dirLightColor);

    // Set shadowMap size based on renderer capabilities
    if (msh3js.options.enableShadows === true) {
      if (msh3js.three.renderer) {
        const maxSize = msh3js.three.renderer.capabilities.maxTextureSize;
        if (maxSize >= 4096) {
          msh3js.three.dirLight.shadow.mapSize.width = 4096;
          msh3js.three.dirLight.shadow.mapSize.height = 4096;
          if (msh3js.debug) console.log("startThree::Shadow map size set to 4096");
        } else if (maxSize >= 2048) {
          msh3js.three.dirLight.shadow.mapSize.width = 2048;
          msh3js.three.dirLight.shadow.mapSize.height = 2048;
          if (msh3js.debug) console.log("startThree::Shadow map size set to 2048");
        } else {
          msh3js.three.dirLight.shadow.mapSize.width = 1024;
          msh3js.three.dirLight.shadow.mapSize.height = 1024;
          if (msh3js.debug) console.log("startThree::Shadow map size set to 1024");
        }
      }
    }

    // Set max anisotropy from renderer capabilities
    if (msh3js.three.renderer) {
      msh3js._supportedFeatures.maxAnisotropy = msh3js.three.renderer.capabilities.getMaxAnisotropy();
      if (msh3js.debug) console.log("startThree::Max anisotropy:", msh3js._supportedFeatures.maxAnisotropy);
      // Validate passed value is supported now that we have max value
      if (msh3js.options.anisotropicFiltering > msh3js._supportedFeatures.maxAnisotropy ||
        msh3js.options.anisotropicFiltering === 1
      ) {
        msh3js.options.anisotropicFiltering = msh3js._supportedFeatures.maxAnisotropy;
        if (msh3js.debug) console.log("initApp::Anisotropic filtering value exceeds max supported. " +
          `Falling back to ${msh3js._supportedFeatures.maxAnisotropy}.`);
      }
    }

    msh3js.three.dirLight.intensity = msh3js.options.dirLightIntensity;
    msh3js.three.dirLight2.color.set(msh3js.options.dirLight2Color);
    msh3js.three.dirLight2.intensity = msh3js.options.dirLight2Intensity;

    // Optionally set up stats and tweakpane if needed
    if (msh3js.debug === true) msh3js.options.showStats = true;
    if (msh3js.options.showStats !== false) {
      await msh3js.initStats(msh3js.options.showStats);
    }
    if (msh3js.options.displayTweakpane !== false) {
      await msh3js.initTweakpane(options.displayTweakpane);
    }
    // Set animation loop
    if (msh3js.three.renderer) {
      msh3js.three.renderer.setAnimationLoop(msh3js.render);
    }

    msh3js.manageListeners("add", "keyControls"); // Add key controls listener

    if (msh3js.debug) console.log("startThree: Three.js started:", msh3js.three);
  },

  // Remove or add and return Stats.js
  async initStats(enabled = true) {
    if (enabled === true) {
      if (!msh3js.stats) {
        let Stats;
        // Check if Stats is already imported
        if (msh3js._modules.Stats) {
          Stats = msh3js._modules.Stats;
        } else {
          const statsModule = await import("stats-gl");
          Stats = statsModule.default;
          msh3js._modules.Stats = Stats;
          if (msh3js.debug) {
            console.log("initStats::Stats module dynamically imported.");
          }
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
          stats.dom.id = "Stats";
          msh3js.stats = stats;
          // Add stats to HTML body if not already present
          if (!msh3js._appContainer.contains(msh3js.stats.dom))
            msh3js._appContainer.appendChild(msh3js.stats.dom);
          if (msh3js.debug) console.log("initStats::Stats", msh3js.stats.dom, "appended to HTML body.");
        }
      }
    } else {
      // Remove stats from HTML body if enabled is false
      if (msh3js.stats && msh3js._appContainer.contains(msh3js.stats.dom)) {
        msh3js._appContainer.removeChild(msh3js.stats.dom);
        if (msh3js.debug) console.log("initStats::Stats deconstructed and removed from HTML body.");
      }
      msh3js.stats = null;
    }
    return msh3js.stats;
  },

  // Remove or add and return populated tweakpane pane
  async initTweakpane(enabled = true) {
    // If disposing, remove listeners from the old pane elements.
    if (msh3js._tweakpaneContainer) {
      msh3js.manageListeners("remove", "draggable", msh3js._tweakpaneContainer);
      msh3js.manageListeners("remove", "resizable", msh3js._tweakpaneContainer);
    }

    // Dispose of any existing pane to prevent duplicates
    if (msh3js.pane) {
      msh3js.pane.dispose();
      msh3js.pane = null;
    }
    if (enabled === false) return null;

    // Dynamically import Tweakpane and its plugins if they haven't been loaded yet.
    let Pane, TweakpanePluginHtmlColorPicker;
    if (!msh3js._modules.Pane) {
      const tweakpaneModule = await import("tweakpane");
      Pane = tweakpaneModule.Pane;
      msh3js._modules.Pane = Pane;
      if (msh3js.debug) console.log("initTweakpane::Tweakpane module dynamically imported.");
    } else {
      Pane = msh3js._modules.Pane;
    }

    if (!msh3js._modules.TweakpanePluginHtmlColorPicker) {
      TweakpanePluginHtmlColorPicker = await import("tweakpane-plugin-html-color-picker");
      msh3js._modules.TweakpanePluginHtmlColorPicker = TweakpanePluginHtmlColorPicker;
      if (msh3js.debug) console.log("initTweakpane::Tweakpane color picker plugin dynamically imported.");
    } else {
      TweakpanePluginHtmlColorPicker = msh3js._modules.TweakpanePluginHtmlColorPicker;
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

    // --- MSH Tab ---
    const filesFolder = mshTab.addFolder({ title: "Files", expanded: false });
    let mshInfoFolder = null; // Hoist mshInfoFolder so we can set it's visibility outside the loop

    // Loop through each loaded MSH file and create a folder for it
    if (msh3js.three.msh.length > 0) filesFolder.expanded = true;
    for (const mshData of msh3js.three.msh) {
      const mshFolder = filesFolder.addFolder({ title: mshData.fileName, expanded: true });
      if (msh3js.three.msh.length > 1) mshFolder.expanded = false;

      // MSH Info
      mshFolder.addBinding(mshData, "fileName", { label: "Filename", readonly: true }).element.title = "The name of the loaded file.";
      mshFolder.addBinding(mshData, "fileSize", { label: "Filesize", readonly: true, format: (v) => `${Math.round(v)} bytes` }).element.title = "The size of the loaded file in bytes.";
      mshFolder.addBinding(mshData, "lastModified", { label: "Last Modified", readonly: true, format: (v) => new Date(v).toLocaleString() }).element.title = "The date the file was last modified.";
      mshFolder.addBinding(mshData.sceneInfo, "name", { label: "Scene Name", readonly: true }).element.title = "The internal scene name from the MSH file.";

      // Advanced MSH Data for debugging
      mshInfoFolder = mshFolder.addFolder({ title: "MSH Data", expanded: false, hidden: !msh3js.options.showMSHData });
      const sinfFolder = mshInfoFolder.addFolder({ title: "SINF", expanded: false });
      const sinfInfo = sinfFolder.addBinding(mshData.sceneInfo, "string", { label: "", readonly: true, multiline: true, rows: 10 });
      sinfInfo.element.children[0].style.display = 'none'; // Hide label
      sinfInfo.element.children[1].style.width = '100%'; // Make value take full width
      const matlFolder = mshInfoFolder.addFolder({ title: "MATL", expanded: false });
      const matlInfo = matlFolder.addBinding(mshData.matl, "string", { label: "", readonly: true, multiline: true, rows: 10 });
      matlInfo.element.children[0].style.display = 'none';
      matlInfo.element.children[1].style.width = '100%';
      const modlFolder = mshInfoFolder.addFolder({ title: "MODL", expanded: false });
      const modlInfo = modlFolder.addBinding(mshData.modl, "string", { label: "", readonly: true, multiline: true, rows: 10 });
      modlInfo.element.children[0].style.display = 'none';
      modlInfo.element.children[1].style.width = '100%';
      const anm2Folder = mshInfoFolder.addFolder({ title: "ANM2", expanded: false });
      const anm2Info = anm2Folder.addBinding(mshData.anm2, "string", { label: "", readonly: true, multiline: true, rows: 10 });
      anm2Info.element.children[0].style.display = 'none';
      anm2Info.element.children[1].style.width = '100%';

      // Models Folder
      const modelsInMsh = [];
      mshData.group.traverse((child) => {
        if (child.isMesh && !child.name.endsWith("_ShadowCaster")) {
          modelsInMsh.push(child);
        }
      });

      if (modelsInMsh.length > 0) {
        const mshModelsFolder = mshFolder.addFolder({ title: "Models", expanded: false });
        for (const model of modelsInMsh) {
          const modelFolder = mshModelsFolder.addFolder({ title: model.name, expanded: false });
          if (!model.userData.originalPosition) model.userData.originalPosition = model.position.clone();
          if (!model.userData.originalRotation) model.userData.originalRotation = model.rotation.clone();
          if (!model.userData.originalScale) model.userData.originalScale = model.scale.clone();

          modelFolder.addBinding(model, "visible", { label: "Visible" }).element.title = "Toggle the visibility of this model.";

          if (!model.userData.isCloth) {
            const positionFolder = modelFolder.addFolder({ title: "Position", expanded: false });
            positionFolder.addBinding(model.position, "x", { min: -100, max: 100, step: 0.1, label: "X" }).element.title = "Adjust the model's position on the X-axis.";
            positionFolder.addBinding(model.position, "y", { min: -100, max: 100, step: 0.1, label: "Y" }).element.title = "Adjust the model's position on the Y-axis.";
            positionFolder.addBinding(model.position, "z", { min: -100, max: 100, step: 0.1, label: "Z" }).element.title = "Adjust the model's position on the Z-axis.";
            positionFolder.addButton({ title: "Reset" }).on("click", () => {
              if (model.userData.originalPosition) {
                model.position.copy(model.userData.originalPosition);
                pane.refresh();
              }
            }).element.title = "Reset the model's position to its original value.";

            const rotationFolder = modelFolder.addFolder({ title: "Rotation", expanded: false });
            rotationFolder.addBinding(model.rotation, "x", { min: -Math.PI, max: Math.PI, step: 0.01, label: "X" }).element.title = "Adjust the model's rotation on the X-axis (in radians).";
            rotationFolder.addBinding(model.rotation, "y", { min: -Math.PI, max: Math.PI, step: 0.01, label: "Y" }).element.title = "Adjust the model's rotation on the Y-axis (in radians).";
            rotationFolder.addBinding(model.rotation, "z", { min: -Math.PI, max: Math.PI, step: 0.01, label: "Z" }).element.title = "Adjust the model's rotation on the Z-axis (in radians).";
            rotationFolder.addButton({ title: "Reset" }).on("click", () => {
              if (model.userData.originalRotation) {
                model.rotation.copy(model.userData.originalRotation);
                pane.refresh();
              }
            }).element.title = "Reset the model's rotation to its original value.";

            const scaleFolder = modelFolder.addFolder({ title: "Scale", expanded: false });
            scaleFolder.addBinding(model.scale, "x", { min: 0.01, max: 10, step: 0.01, label: "X" }).element.title = "Adjust the model's scale on the X-axis.";
            scaleFolder.addBinding(model.scale, "y", { min: 0.01, max: 10, step: 0.01, label: "Y" }).element.title = "Adjust the model's scale on the Y-axis.";
            scaleFolder.addBinding(model.scale, "z", { min: 0.01, max: 10, step: 0.01, label: "Z" }).element.title = "Adjust the model's scale on the Z-axis.";
            scaleFolder.addButton({ title: "Reset" }).on("click", () => {
              if (model.userData.originalScale) {
                model.scale.copy(model.userData.originalScale);
                pane.refresh();
              }
            }).element.title = "Reset the model's scale to its original value.";
          }

          if (model.geometry.attributes.color?.count > 0) {
            model.userData.vertexColors = true;
            modelFolder.addBinding(model.userData, "vertexColors", { label: "Vertex Colors" }).on("change", () => {
              const materials = Array.isArray(model.material) ? model.material : [model.material];
              for (let mat of materials) mat.vertexColors = model.userData.vertexColors;
            }).element.title = "Enable or disable rendering of per-vertex colors for this model.";
          }
        }
      }

      // Materials Folder
      if (mshData.materials.length > 0) {
        const mshMaterialsFolder = mshFolder.addFolder({ title: "Materials", expanded: false });
        for (const material of mshData.materials) {
          const materialFolder = mshMaterialsFolder.addFolder({ title: material.name, expanded: false });
          materialFolder.addBinding(material.three, "wireframe", { label: "Wireframe" }).element.title = "Render this material as a wireframe.";

          if (material.matd?.atrb) {
            const atrbFolder = materialFolder.addFolder({ title: "Attributes", expanded: true });
            const renderTypeName = Object.keys(material.matd.atrb.renderFlags).find(key => material.matd.atrb.renderFlags[key]) || 'unknown';
            atrbFolder.addBinding(material.matd.atrb, 'renderType', { readonly: true, label: "Render Type", format: (v) => `${v} (${renderTypeName})` }).element.title = "The rendering mode/shader used by the game engine for this material.";

            const renderType = material.matd.atrb.renderType;
            if ([3, 7, 11, 24, 25, 29].includes(renderType)) {
              atrbFolder.addBinding(material.matd.atrb, 'data0', { readonly: true, label: "Data 0" }).element.title = "Special data value used by certain render types (e.g., for scrolling speed or animation frames).";
              atrbFolder.addBinding(material.matd.atrb, 'data1', { readonly: true, label: "Data 1" }).element.title = "Special data value used by certain render types (e.g., for scrolling speed or animation frames).";
            }
            for (const [flag, isEnabled] of Object.entries(material.matd.atrb.bitFlags)) {
              if (isEnabled) atrbFolder.addBinding({ [flag]: isEnabled }, flag, { readonly: true }).element.title = "Rendering flags from the MSH file.";
            }
          }

          const textureSlots = {
            'TX0D': material.texture ?? material.matd?.tx0d ?? 'Unassigned',
            'TX1D': material.texture ? 'Unassigned' : material.matd?.tx1d ?? 'Unassigned',
            'TX2D': material.texture ? 'Unassigned' : material.matd?.tx2d ?? 'Unassigned',
            'TX3D': material.texture ? 'Unassigned' : material.matd?.tx3d ?? 'Unassigned',
          };

          if (Object.values(textureSlots).some(name => name !== 'Unassigned')) {
            const texturesFolder = materialFolder.addFolder({ title: "Textures", expanded: true });
            for (const [label, textureName] of Object.entries(textureSlots)) {
              if (textureName !== 'Unassigned') {
                texturesFolder.addBinding({ [label]: textureName }, label, { label, readonly: true }).element.title = `Texture file assigned to the ${label} slot.`;
              }
            }
          }
        }
      }

      // Create a folder for missing textures specific to this MSH
      const mshMissingTextures = mshData.requiredTextures.filter(tex =>
        msh3js.ui.missingTextures.has(tex.toLowerCase())
      );

      if (mshMissingTextures.length > 0) {
        const missingTexturesFolder = mshFolder.addFolder({
          title: "Missing Textures",
          expanded: true,
        });
        mshMissingTextures.forEach((textureName, index) => {
          missingTexturesFolder.addBinding({ file: textureName }, 'file', { readonly: true, label: `File ${index + 1}` }).element.title = "This texture file is required by the model but was not provided.";
        });
      }
    }

    // Add the upload button to the MSH tab itself, after the folder.
    mshTab.addButton({ title: "Upload" }).on("click", () => {
      if (msh3js.isTauri) {
        (async () => {
          try {
            // open tauri dialog
            let dialogModule = msh3js._modules.tauriDialog;
            if (!dialogModule) {
              dialogModule = await import("@tauri-apps/plugin-dialog");
              msh3js._modules.tauriDialog = dialogModule;
              if (msh3js.debug) console.log("tweakpane::Tauri Dialog Module imported.");
            }
            const { open } = dialogModule;
            const selected = await open({
              multiple: true,
              directory: false,
              filters: [{ name: 'MSH3JS Files', extensions: ['msh', 'tga', 'option'] }]
            });

            if (selected) {
              if (msh3js.debug) console.log("Tauri files selected:", selected);

              let fsModule = msh3js._modules.tauriFs;
              if (!fsModule) {
                fsModule = await import('@tauri-apps/plugin-fs');
                msh3js._modules.tauriFs = fsModule;
                if (msh3js.debug) console.log("tweakpane::Tauri fs module loaded.");
              }

              const { readTextFile, readFile } = fsModule;

              const files = [];
              const mshPaths = [];
              for (const path of selected) {
                if (path.endsWith('.msh')) mshPaths.push(path);

                let content = null; // readFile or readTextFile
                if (path.endsWith('.option')) content = readTextFile(path);
                else content = await readFile(path);

                const fileName = path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1);
                const file = new File([content], fileName, { type: 'application/octet-stream' });
                files.push(file);
              }

              if (files.length > 0) {
                msh3js.addFiles(files);
                await msh3js.processFiles();
                for (const path of mshPaths) {
                  // Load option file of msh
                  const optionFile = await msh3js._getOptionFile(path);
                  if (optionFile) {
                    msh3js.addFiles([optionFile]);
                    await msh3js.processFiles(); // Possible bumpmap required texture added
                  }
                  // Load required textures of msh
                  const mshData = msh3js.three.msh.find(msh => msh.fileName.toLowerCase() === path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1).toLowerCase());
                  if (mshData) {
                    const requiredTextures = await msh3js._getRequiredTextures(path, mshData.requiredTextures);
                    if (requiredTextures.length > 0) {
                      msh3js.addFiles(requiredTextures);
                      await msh3js.processFiles();
                    }
                    // If msh with cloth models
                    if (mshData.hasCloth) {
                      const clothMeshes = [];
                      // If model is cloth
                      mshData.group.traverse((child) => {
                        if (child.isMesh && child.userData.isCloth) {
                          clothMeshes.push(child);
                        }
                      });
                      if (clothMeshes.length > 0) {
                        const allClothParams = [];
                        for (const mesh of clothMeshes) {
                          // Get cloth ODF
                          const clothODF = await msh3js._getClothODF(path, mesh.name);
                          if (clothODF) {
                            const clothParams = msh3js._parseClothODF(clothODF);
                            if (clothParams.transparent) {
                              mesh.material.transparent = true;
                              if (msh3js.debug)
                                console.log("tweakpane:Upload:Cloth mesh", mesh.name, " material flagged as transparent.");
                            }
                            if (clothParams.hardEdge) {
                              mesh.material.transparent = false;
                              mesh.material.alphaTest = 0.5;
                              if (msh3js.debug)
                                console.log("tweakpane:Upload:Cloth mesh", mesh.name, " material flagged as hard edge.");
                            }
                            allClothParams.push(clothParams);
                          }
                        }
                        for (const params of allClothParams) {
                          if (params.windSpeed) {
                            msh3js.options.clothWindSpeed = params.windSpeed * 0.1;
                            if (msh3js.debug)
                              console.log("tweakpane:Upload:Cloth wind speed set to:", msh3js.options.clothWindSpeed);
                          }
                          if (params.windDirection.length > 0) {
                            msh3js.options.clothWindDirection = params.windDirection[0];
                            if (msh3js.debug)
                              console.log("tweakpane:Upload:Cloth wind direction set to:", msh3js.options.clothWindDirection);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error opening Tauri dialog:", error);
          }
        })();
      } else msh3js.clickFileInput();

      if (msh3js.debug) console.log("tweakpane:Upload button clicked.");
    }).element.title = "Upload new MSH, TGA, or .msh.option files.";

    // --- Scene Tab ---
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
      if (msh3js.debug) console.log("tweakpane::Directional light color set to:", msh3js.options.dirLightColor);
    }).element.title = "Set the color of the primary directional light.";
    directionalLight1Folder.addBinding(msh3js.three.dirLight, "intensity", {
      label: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    }).on("change", () => {
      if (msh3js.debug) console.log("tweakpane::Directional light intensity set to:", msh3js.three.dirLight.intensity);
    }).element.title = "Set the intensity (brightness) of the primary directional light.";
    directionalLight1Folder.addBinding(msh3js.options, "dirLightAzimuth", {
      label: "Azimuth",
      min: 0,
      max: 360,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight, msh3js.options.dirLightAzimuth, msh3js.options.dirLightElevation);
      if (msh3js.debug) console.log("tweakpane::Directional light azimuth set to:", msh3js.options.dirLightAzimuth);
    }).element.title = "Set the horizontal angle (0-360 degrees) of the primary directional light.";
    directionalLight1Folder.addBinding(msh3js.options, "dirLightElevation", {
      label: "Elevation",
      min: -90,
      max: 90,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight, msh3js.options.dirLightAzimuth, msh3js.options.dirLightElevation);
      if (msh3js.debug) console.log("tweakpane::Directional light elevation set to:", msh3js.options.dirLightElevation);
    }).element.title = "Set the vertical angle (-90 to 90 degrees) of the primary directional light.";
    directionalLight1Folder
      .addBinding(msh3js.options, "enableDirLightHelper", {
        label: "Show Helper",
      })
      .on("change", () => {
        msh3js.three.dirLightHelper.visible =
          msh3js.options.enableDirLightHelper;
        if (msh3js.debug) console.log("tweakpane::Directional light helper set to:", msh3js.options.enableDirLightHelper ? "on" : "off");
      }).element.title = "Show or hide a visual helper for the primary directional light.";

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
      if (msh3js.debug) console.log("tweakpane::Directional light 2 color set to:", msh3js.options.dirLight2Color);
    }).element.title = "Set the color of the secondary directional light.";
    directionalLight2Folder.addBinding(msh3js.three.dirLight2, "intensity", {
      label: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    }).on("change", () => {
      if (msh3js.debug) console.log("tweakpane::Directional light 2 intensity set to:", msh3js.three.dirLight2.intensity);
    }).element.title = "Set the intensity (brightness) of the secondary directional light.";
    directionalLight2Folder.addBinding(msh3js.options, "dirLight2Azimuth", {
      label: "Azimuth",
      min: 0,
      max: 360,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight2, msh3js.options.dirLight2Azimuth, msh3js.options.dirLight2Elevation);
      if (msh3js.debug) console.log("tweakpane::Directional light 2 azimuth set to:", msh3js.options.dirLight2Azimuth);
    }).element.title = "Set the horizontal angle (0-360 degrees) of the secondary directional light.";
    directionalLight2Folder.addBinding(msh3js.options, "dirLight2Elevation", {
      label: "Elevation",
      min: -90,
      max: 90,
      step: 1,
    }).on("change", () => {
      msh3js.calculateLightPosition(msh3js.three.dirLight2, msh3js.options.dirLight2Azimuth, msh3js.options.dirLight2Elevation);
      if (msh3js.debug) console.log("tweakpane::Directional light 2 elevation set to:", msh3js.options.dirLight2Elevation);
    }).element.title = "Set the vertical angle (-90 to 90 degrees) of the secondary directional light.";
    directionalLight2Folder
      .addBinding(msh3js.options, "enableDirLightHelper2", {
        label: "Show Helper",
      })
      .on("change", () => {
        msh3js.three.dirLightHelper2.visible =
          msh3js.options.enableDirLightHelper2;
        if (msh3js.debug) console.log("tweakpane::Directional light helper set to:", msh3js.options.enableDirLightHelper2 ? "on" : "off");
      }).element.title = "Show or hide a visual helper for the secondary directional light.";

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
      if (msh3js.debug) console.log("tweakpane::Ambient light color set to:", msh3js.options.ambLightColor);
    }).element.title = "Set the color of the global ambient light.";
    ambientLightFolder.addBinding(msh3js.three.ambLight, "intensity", {
      label: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    }).on("change", () => {
      if (msh3js.debug) console.log("tweakpane::Ambient light intensity set to:", msh3js.three.ambLight.intensity);
    }).element.title = "Set the intensity (brightness) of the global ambient light.";

    // Background Folder for scene background color and image settings.
    const bgFolder = controlsTab.addFolder({
      title: "Background",
      expanded: true,
    });

    const transparentBackgroundControl = bgFolder
      .addBinding(msh3js.options, "transparentBackground", { label: "Transparent", })
      .on("change", () => {
        if (msh3js.options.transparentBackground) {
          if (msh3js.three.scene.background && msh3js.three.scene.background.isTexture) {
            msh3js.three.scene.background.dispose();
            msh3js.three.scene.environment = null;
            msh3js.options.backgroundImage = '';
            if (msh3js.debug) console.log("tweakpane::Disposed of background texture.");
          }
          msh3js.three.scene.background = null;
          backgroundColorControl.disabled = true;
          backgroundImageControl.disabled = true;
          if (msh3js.debug) console.log("tweakpane::Background set to transparent/null.");
        } else {
          backgroundColorControl.disabled = false;
          backgroundImageControl.disabled = false;
          msh3js.three.scene.background = new THREE.Color(msh3js.options.backgroundColor);
          if (msh3js.debug) console.log("tweakpane::Background set back to color:", msh3js.options.backgroundColor);
        }
      });
    transparentBackgroundControl.element.title = "Make the background transparent. This will remove any background image."
    if (!msh3js.isTauri)
      transparentBackgroundControl.hidden = true;

    const backgroundColorControl = bgFolder
      .addBinding(msh3js.options, "backgroundColor", {
        label: "Background Color",
        view: "html-color-picker",
      })
      .on("change", () => {
        // When color is changed, dispose of any existing background texture.
        if (msh3js.three.scene.background && msh3js.three.scene.background.isTexture) {
          msh3js.three.scene.background.dispose();
          if (msh3js.debug) console.log("tweakpane::Disposed of old background texture.");
          // Also clear the environment map and the option value.
          msh3js.three.scene.environment = null;
          msh3js.options.backgroundImage = '';
        }

        // Set the new background color.
        msh3js.three.scene.background = new THREE.Color(msh3js.options.backgroundColor);
        if (msh3js.debug) console.log("tweakpane::Background set to color:", msh3js.options.backgroundColor, "and image/environment cleared.");
      });
    backgroundColorControl.element.title = "Set the scene's background color. This will remove any background image.";

    // Button to upload a background image.
    const backgroundImageControl = bgFolder.addButton({ title: "Upload Background Image" })
      .on("click", () => {
        msh3js.createBackgroundImageInput().click()
        if (msh3js.debug) console.log("tweakpane::Background image upload button clicked.");
      });
    backgroundImageControl.element.title = "Upload an equirectangular image (.hdr, .exr) or a standard image (.png, .jpg) to use as the scene background and environment map.";

    // View Folder for camera and viewport helper controls.
    const viewFolder = controlsTab.addFolder({
      title: "View",
      expanded: true,
    });

    // Shadows
    viewFolder
      .addBinding(msh3js.options, "enableShadows", { label: "Show Shadows" })
      .on("change", () => {
        msh3js.three.renderer.shadowMap.enabled = msh3js.options.enableShadows;
        msh3js.three.dirLight.castShadow = msh3js.options.enableShadows;
        if (msh3js.debug) console.log("tweakpane::Shadows set to:", msh3js.options.enableShadows ? "on" : "off");
      }).element.title = "Enable or disable dynamic shadows cast by the primary directional light.";

    // Grid plane visibility toggle.
    viewFolder
      .addBinding(msh3js.options, "enableGrid", { label: "Show Grid" })
      .on("change", () => {
        msh3js.three.gridHelper.visible = msh3js.options.enableGrid;
        if (msh3js.debug) console.log("tweakpane::Grid helper set to:", msh3js.three.gridHelper.visible ? "on" : "off");
      }).element.title = "Show or hide the ground grid helper.";

    // --- Three Tab ---
    // Three.js parameters
    const graphicsApiFolder = threeTab.addFolder({
      title: "Renderer",
      expanded: true,
    });

    // Build the list of available rendering APIs based on feature detection.
    const apiOptions = {};
    if (msh3js._supportedFeatures.webgl.supported) apiOptions['WebGL'] = 'webgl';
    if (msh3js._supportedFeatures.webgl2.supported) apiOptions['WebGL2'] = 'webgl2';

    graphicsApiFolder.addBinding(msh3js.options, 'renderingAPI', {
      label: 'Graphics API',
      options: apiOptions,
    }).on('change', async (ev) => {
      if (msh3js.debug) console.log("tweakpane::Graphics API selection changed to:", ev.value);
      // When the user manually changes the API, find the closest supported sample count.
      const currentSampleCount = msh3js.options.sampleCount;
      const newApiFeatures = msh3js._supportedFeatures[ev.value];
      const newSupportedSampleCounts = newApiFeatures.sampleCountOptions.map(opt => opt.value);
      // Find the closest value in the new list of supported counts.
      const closestSampleCount = newSupportedSampleCounts.reduce((prev, curr) => {
        return (Math.abs(curr - currentSampleCount) < Math.abs(prev - currentSampleCount) ? curr : prev);
      });
      msh3js.options.sampleCount = closestSampleCount;
      // Update the options of the single AA control.
      aaControl.options = newApiFeatures.sampleCountOptions;
      if (msh3js.debug) console.log(`tweakpane::Sample count changed from ${currentSampleCount} to closest supported value: ${closestSampleCount}`);
      msh3js.pane.refresh(); // Refresh to show the new default
      await msh3js.recreateRenderer();
    }).element.title = "Change the graphics API. This will restart the renderer.";

    // Bloom controls
    const hasGlow = msh3js.three.msh.some(msh =>
      msh.materials.some(mat =>
        mat.matd?.atrb?.renderFlags?.glow || mat.matd?.atrb?.bitFlags?.glow
      )
    );
    const bloomFolder = threeTab.addFolder({
      title: "Bloom",
      expanded: hasGlow,
    });
    bloomFolder.addBinding(msh3js.options, "bloomEnabled", { label: "Enabled" }).on("change", async (ev) => {
      if (ev.value) {
        // If enabling bloom, create the composer if it doesn't exist.
        if (!msh3js.three.composer) {
          await msh3js.createComposer();
        }
      }
      msh3js.options.bloomEnabled = ev.value;
    }).element.title = "Enable or disable the post-processing bloom (glow) effect.";
    bloomFolder.addBinding(msh3js.options, "bloomStrength", { label: "Strength", min: 0, max: 3, step: 0.01 }).on("change", () => {
      if (msh3js.three.bloomPass) msh3js.three.bloomPass.strength = msh3js.options.bloomStrength;
    }).element.title = "Set the intensity of the bloom effect.";
    bloomFolder.addBinding(msh3js.options, "bloomRadius", { label: "Radius", min: 0, max: 1, step: 0.01 }).on("change", () => {
      if (msh3js.three.bloomPass) msh3js.three.bloomPass.radius = msh3js.options.bloomRadius;
    }).element.title = "Set the radius of the bloom effect.";
    bloomFolder.addBinding(msh3js.options, "bloomThreshold", { label: "Threshold", min: 0, max: 1, step: 0.01 }).on("change", () => {
      if (msh3js.three.bloomPass) msh3js.three.bloomPass.threshold = msh3js.options.bloomThreshold;
    }).element.title = "Set the brightness threshold for pixels to be affected by bloom. Lower values include more pixels.";

    const hasCloth = msh3js.three.msh.some(msh => msh.hasCloth);
    const clothFolder = threeTab.addFolder({
      title: "Cloth Simulation",
      expanded: hasCloth,
    });

    clothFolder.addBinding(msh3js.options, "clothSim", {
      label: "Enable Cloth Sim"
    }).on("change", async () => {
      if (msh3js.options.clothSim) await msh3js.initClothSimulations();
      else msh3js.resetClothSimulations();
      if (msh3js.debug) console.log("tweakpane::Cloth simulation set to:", msh3js.options.clothSim ? "on" : "off");
    }).element.title = "Enable or disable the cloth physics simulation for compatible models.";

    clothFolder.addBinding(msh3js.options, "clothWindSpeed", {
      label: "Wind Speed",
      min: 0,
      max: 10,
      step: 0.1
    }).on("change", () => {
      if (msh3js.debug) console.log("tweakpane::Cloth wind speed set to:", msh3js.options.clothWindSpeed);
    }).element.title = "Set the speed of the wind affecting the cloth simulation.";

    clothFolder.addBinding(msh3js.options, "clothWindDirection", {
      label: "Wind Direction",
      min: 0,
      max: 360,
      step: 1
    }).on("change", () => {
      if (msh3js.debug) console.log("tweakpane::Cloth wind direction set to:", msh3js.options.clothWindDirection);
    }).element.title = "Set the direction of the wind affecting the cloth simulation.";

    const xrFolder = threeTab.addFolder({
      title: "WebXR",
      expanded: msh3js._supportedFeatures.xr.supported &&
        (msh3js._supportedFeatures.xr.vr || msh3js._supportedFeatures.xr.ar),
    });

    const arSupport = msh3js._supportedFeatures.xr.ar;
    const vrSupport = msh3js._supportedFeatures.xr.vr;

    const arControl = xrFolder.addBinding(msh3js.options, "AR", {
      label: "AR",
      disabled: !arSupport,
    }).on("change", (ev) => {
      if (ev.value) {
        msh3js.three.preXRBloom = msh3js.options.bloomEnabled;
        msh3js.options.bloomEnabled = false;
        vrControl.disabled = true;
        msh3js.startXR('immersive-ar');
      } else {
        msh3js.stopXR();
        vrControl.disabled = false;
        msh3js.options.bloomEnabled = msh3js.three.preXRBloom;
      }
      if (msh3js.debug) console.log("tweakpane::AR set to:", msh3js.options.AR ? "on" : "off");
    });
    arControl.element.title = "Enter Augmented Reality (AR) mode. Requires a compatible device and browser.";

    const vrControl = xrFolder.addBinding(msh3js.options, "VR", {
      label: "VR",
      disabled: !vrSupport,
    }).on("change", (ev) => {
      if (ev.value) {
        msh3js.three.preXRBloom = msh3js.options.bloomEnabled;
        msh3js.options.bloomEnabled = false;
        arControl.disabled = true;
        msh3js.startXR('immersive-vr');
      } else {
        msh3js.stopXR();
        arControl.disabled = false;
        msh3js.options.bloomEnabled = msh3js.three.preXRBloom;
      }
      if (msh3js.debug) console.log("tweakpane::VR set to:", msh3js.options.VR ? "on" : "off");
    });
    vrControl.element.title = "Enter Virtual Reality (VR) mode. Requires a compatible headset and browser.";

    // --- Anim Tab ---
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
    animationsTab.addButton({ title: "Import Animations..." })
      .on("click", () => {
        msh3js.createAnimationFileInput().click()
        if (msh3js.debug) console.log("tweakpane::Animation import button clicked.");
      }).element.title = "Import animations from another MSH file to use with the current model.";

    // Add dropdown to select animation, which will be present even if no model is loaded
    const animationDropdown = animationsFolder.addBinding(msh3js.ui, 'currentAnimation', {
      label: 'Current Animation:',
      options: animOptions,
    });
    animationDropdown.on('change', (ev) => {
      if (msh3js.ui.animationPlaying === true) {
        msh3js.playAnimation(ev.value, false);
      }
      if (msh3js.debug) console.log("tweakpane::Animation changed to:", ev.value);
    });
    animationDropdown.element.title = "Select an animation to play.";
    msh3js.ui.animationDropdown = animationDropdown;

    // Add toggle for showing the skeleton
    animationsFolder.addBinding(msh3js.options, 'showSkeleton', {
      label: 'Show Skeleton'
    }).on('change', (ev) => {
      if (msh3js.three.skeletonHelper)
        msh3js.three.skeletonHelper.visible = ev.value;
      if (msh3js.debug) console.log("tweakpane::Skeleton visibility set to:", ev.value);
    }).element.title = "Show or hide the model's skeleton helper.";

    // Create a proxy object to display the animation status as a string.
    const statusProxy = {
      get status() {
        return msh3js.ui.animationPlaying ? "Playing" : "Stopped";
      }
    };
    // Show animation playback status
    animationsPlaybackFolder.addBinding(statusProxy, "status", {
      label: "Status",
      readonly: true,
    }).element.title = "Current status of the animation playback.";

    // Add buttons for starting/stopping
    animationsPlaybackFolder.addButton({ title: "Play" }).on("click", () => {
      if (msh3js.ui.currentAnimation !== 'None') {
        msh3js.playAnimation(msh3js.ui.currentAnimation);
        if (msh3js.debug) console.log("tweakpane::Animation playback started for:", msh3js.ui.currentAnimation);
      }
    }).element.title = "Play the selected animation.";

    animationsPlaybackFolder.addButton({ title: "Stop" }).on("click", () => {
      msh3js.stopAllAnimations(false);
      if (msh3js.debug) console.log("tweakpane::Animation playback stopped.");
    }).element.title = "Stop the currently playing animation.";

    // Add slider to adjust playback speed
    animationsPlaybackFolder.addBinding(msh3js.ui, "animationSpeed", {
      label: "Playback Speed",
      min: 0.1,
      max: 4.0,
      step: 0.1,
    }).on("change", (ev) => {
      // Update animation mixer speed for all loaded MSH models
      if (msh3js.three.mixer) msh3js.three.mixer.timeScale = ev.value;
      if (msh3js.debug) console.log(`tweakpane::Animation speed set to: ${ev.value}`);
    }).element.title = "Adjust the playback speed of the animation.";

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
          if (!ev.value) action.reset().play();
        });
        if (msh3js.debug) console.log("tweakpane::Animation looping set to:", ev.value);
      }
    }).element.title = "Toggle whether the animation should loop.";

    // --- App Tab ---
    // Rendering options
    const renderingFolder = appSettingsTab.addFolder({ title: "Rendering" });

    // Create AA control
    const aaControl = renderingFolder.addBinding(msh3js.options, "sampleCount", {
      label: "Anti-Aliasing",
      // Set initial options based on the currently selected API
      options: msh3js._supportedFeatures[msh3js.options.renderingAPI].sampleCountOptions,
    }).on("change", async () => {
      if (msh3js.debug) console.log("tweakpane::Sample count set to:", msh3js.options.sampleCount);
      await msh3js.recreateRenderer();
      if (msh3js.three.msh.length > 0) {
        for (const material of msh3js.three.msh.at(-1).materials) {
          if (material.transparent) {
            // Enable alphaToCoverage for MSAA transparency
            material.three.alphaToCoverage = true;
            material.three.needsUpdate = true;
          }
        }
      }
    });
    aaControl.element.title = "Set the level of Multi-Sample Anti-Aliasing (MSAA). Higher values are smoother but more demanding. Requires renderer restart.";

    // Generate options for the pixel ratio dropdown.
    const pixelRatioOptions = [];
    for (let i = 0.25; i <= 3.0; i += 0.25) {
      pixelRatioOptions.push({ text: `${i.toFixed(2)}x`, value: i });
    }

    // Pixel Ratio Slider for performance tuning.
    renderingFolder
      .addBinding(msh3js.options, "pixelRatio", {
        label: "Pixel Ratio",
        options: pixelRatioOptions,
      })
      .on("change", async () => {
        if (msh3js.debug) console.log("tweakpane::Pixel ratio set to:", msh3js.options.pixelRatio);
        msh3js.three.renderer.setPixelRatio(msh3js.options.pixelRatio);
        msh3js.resize();
        if (msh3js.options.enableViewHelper && msh3js.three.viewHelper)
          msh3js.recreateRenderer();
      }).element.title = "Set the rendering resolution multiplier. Lower values can improve performance at the cost of sharpness.";

    // Anisotropic filtering dropdown.
    const anisotropyOptions = [1, 2, 4, 8, 16]
      .filter(v => v <= msh3js._supportedFeatures.maxAnisotropy)
      .map(v => ({ text: `${v}x`, value: v }));

    renderingFolder
      .addBinding(msh3js.options, "anisotropicFiltering", {
        label: "Anisotropic Filtering",
        options: anisotropyOptions,
      })
      .on("change", async () => {
        if (msh3js.debug) console.log("tweakpane::Anisotropy set to:", msh3js.options.anisotropicFiltering);
        // Apply filtering to maps and normalMaps
        for (const mshData of msh3js.three.msh) {
          for (const material of mshData.materials) {
            if (material.three.map) {
              material.three.map.anisotropy = msh3js.options.anisotropicFiltering;
              material.three.map.needsUpdate = true;
            }
            if (material.three.normalMap) {
              material.three.normalMap.anisotropy = msh3js.options.anisotropicFiltering;
              material.three.normalMap.needsUpdate = true;
            }
          }
        }
      }).element.title = "Set the level of anisotropic filtering to improve texture quality on surfaces viewed at an angle.";

    // GPU Preference Control (high-performance vs low-power).
    renderingFolder
      .addBinding(msh3js.options, "preferredGPU", {
        label: "GPU Preference",
        options: {
          default: "default",
          low: "low-power",
          high: "high-performance",
        },
      })
      .on("change", async () => {
        if (msh3js.debug) console.log("tweakpane::GPU Preference set to:", msh3js.options.preferredGPU);
        await msh3js.recreateRenderer();
      }).element.title = "Request a specific GPU power profile from the browser. Requires renderer restart.";

    // Stats toggle to show/hide the performance monitor.
    renderingFolder
      .addBinding(msh3js.options, "showStats", {
        label: "Show Stats",
      })
      .on("change", async () => {
        await msh3js.initStats(msh3js.options.showStats); // Toggle stats
        if (msh3js.debug) console.log("tweakpane::Show stats set to:", msh3js.options.showStats);
      }).element.title = "Show or hide the performance and GPU statistics panel.";

    // Controls Folder
    const controlsFolder = appSettingsTab.addFolder({
      title: "Controls",
      expanded: true,
    });

    // Auto-Rotate toggle for the camera.
    controlsFolder // Controls for autorotate
      .addBinding(msh3js.options, "autoRotate", { label: "Auto-Rotate" })
      .on("change", () => {
        if (msh3js.three.orbitControls) {
          msh3js.three.orbitControls.autoRotate = msh3js.options.autoRotate;
        }
        if (msh3js.debug) console.log("tweakpane::AutoRotate set to:", msh3js.options.autoRotate ? "on" : "off");
        // Show/hide speed control
        if (autoRotateSpeedControl) autoRotateSpeedControl.hidden = !msh3js.options.autoRotate;
      }).element.title = "Automatically rotate the camera around the model.";

    // Auto-Rotate speed slider.
    const autoRotateSpeedControl = controlsFolder
      .addBinding(msh3js.options, "autoRotateSpeed", {
        label: "Auto-Rotate Speed",
        min: 0.01,
        max: 20,
      })
      .on("change", () => {
        if (msh3js.three.orbitControls) {
          msh3js.three.orbitControls.autoRotateSpeed = msh3js.options.autoRotateSpeed;
        }
        if (msh3js.debug) console.log("tweakpane::AutoRotateSpeed set to:", msh3js.options.autoRotateSpeed);
      });
    autoRotateSpeedControl.element.title = "Set the speed of the automatic camera rotation.";
    // Hide initially if autoRotate is off
    if (autoRotateSpeedControl) autoRotateSpeedControl.hidden = !msh3js.options.autoRotate;

    controlsFolder // Camera controls damping (inertia) toggle.
      .addBinding(msh3js.options, "controlDamping", {
        label: "Controls Damping",
      })
      .on("change", () => {
        // Update damping directly on controls
        if (msh3js.three.orbitControls) {
          msh3js.three.orbitControls.enableDamping = msh3js.options.controlDamping;
          msh3js.three.orbitControls.update(); // Apply change immediately if needed
        }
        if (msh3js.debug) console.log("tweakpane::Constrols damping set to:", msh3js.options.controlDamping ? "on" : "off");
      }).element.title = "Enable camera inertia for smoother movement after dragging.";

    // Axis Helper folder
    const axisHelperFolder = controlsFolder.addFolder({
      title: "Axis Helper",
      expanded: true,
    });

    // View Helper (axis gizmo) visibility toggle.
    axisHelperFolder
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
        if (msh3js.debug) console.log("tweakpane::View helper set to:", msh3js.options.enableViewHelper ? "on" : "off");
      }).element.title = "Show or hide the axis orientation gizmo in the corner of the viewport.";

    // Add color controls for X, Y, Z axes
    axisHelperFolder.addBinding(msh3js.options.viewHelperColors, "x", {
      label: "X-Axis Color",
      view: "html-color-picker",
    }).on("change", async () => {
      if (msh3js.debug) console.log("tweakpane::X-Axis color changed to:", msh3js.options.viewHelperColors.x);
      await msh3js.recreateViewHelper();
    }).element.title = "Set the color for the X-axis on the view helper.";

    axisHelperFolder.addBinding(msh3js.options.viewHelperColors, "y", {
      label: "Y-Axis Color",
      view: "html-color-picker",
    }).on("change", async () => {
      if (msh3js.debug) console.log("tweakpane::Y-Axis color changed to:", msh3js.options.viewHelperColors.y);
      await msh3js.recreateViewHelper();
    }).element.title = "Set the color for the Y-axis on the view helper.";

    axisHelperFolder.addBinding(msh3js.options.viewHelperColors, "z", {
      label: "Z-Axis Color",
      view: "html-color-picker",
    }).on("change", async () => {
      if (msh3js.debug) console.log("tweakpane::Z-Axis color changed to:", msh3js.options.viewHelperColors.z);
      await msh3js.recreateViewHelper();
    }).element.title = "Set the color for the Z-axis on the view helper.";

    // Preferences Folder for saving and clearing settings.
    const preferencesFolder = appSettingsTab.addFolder({
      title: "Preferences",
      expanded: true,
    });

    preferencesFolder.addBinding(msh3js.options, 'showMSHData', {
      label: 'Show MSH Data'
    }).on('change', async () => {
      mshInfoFolder.hidden = !msh3js.options.showMSHData;
      if (msh3js.debug) console.log("tweakpane::Show MSH Data folder visibility changed to:", msh3js.options.showMSHData);
    }).element.title = "Toggle visibility of MSH Data folder for debugging parsed MSH data.";

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
      if (msh3js.debug) console.log("tweakpane::Font set to:", ev.value);
    }).element.title = "Change the font used for the Tweakpane user interface.";

    // Button to save current app options to localStorage.
    const saveBtn = preferencesFolder.addButton({
      title: "Save",
      label: "Options",
    }).on("click", () => {
      if (msh3js._supportedFeatures.localStorage === true) {
        try {
          window.localStorage.setItem("msh3js_options", JSON.stringify(msh3js.options));
          if (msh3js.debug) console.log("tweakpane::User preferences saved.");
        } catch (error) {
          console.error("tweakpane::Error saving user preferences:", error);
        }
      }
    });
    saveBtn.element.title = "Save the current app and scene settings to your browser's local storage for future sessions.";

    // Button to clear saved preferences from localStorage.
    const cacheBtn = preferencesFolder.addButton({
      title: "Clear",
      label: "",
    }).on("click", () => {
      try {
        if (msh3js._serviceWorker) {
          msh3js._serviceWorker.postMessage({ action: "clearCache" });
        }
        if (msh3js._supportedFeatures.localStorage) {
          window.localStorage.removeItem("msh3js_options");
          if (msh3js.debug) console.log("tweakpane::User preferences cleared.");
        }
      } catch (error) {
        console.error("tweakpane::Error clearing user preferences:", error);
      }
    });
    cacheBtn.element.title = "Clear all saved settings and cached app files, then reload the page.";

    // Assign the newly created pane to the global object.
    msh3js.pane = pane;
    if (msh3js.debug)
      console.log("initTweakpane::Tweakpane controls created:", pane);

    if (msh3js._tweakpaneContainer) {
      // Re-add draggable and resizable listeners to the container now that the pane is rebuilt.
      msh3js.manageListeners("add", "draggable", msh3js._tweakpaneContainer);
      msh3js.manageListeners("add", "resizable", msh3js._tweakpaneContainer);

      // Set a max-height and enable scrolling on the Tweakpane root element.
      // This ensures the entire panel is constrained and its content will scroll correctly.
      const tweakpaneRoot = msh3js._tweakpaneContainer.querySelector('.tp-rotv');
      if (tweakpaneRoot) {
        tweakpaneRoot.style.maxHeight = 'calc(100vh - 40px)'; // Adjust 40px to account for top/bottom margin
        tweakpaneRoot.style.overflowY = 'auto';
      }

      // Apply font settings
      msh3js._tweakpaneContainer.style.setProperty('--tweakpane-font', msh3js.options.tweakpaneFont);
    }

    // Refresh the pane to ensure all bindings and visibility states are up-to-date.
    msh3js.pane.refresh();

    return pane;
  },

  // Main render function
  async render(time) {
    const elapsedTime = (time - (msh3js.renderTime || time)) / 1000.0;

    // Handle AR hit-testing
    if (msh3js.three.xrSessionMode === 'immersive-ar') msh3js.handleARHitTest();

    // If there's a mixer, update it. The speed is handled by mixer.timeScale.
    if (msh3js.three.mixer) msh3js.three.mixer.update(elapsedTime);

    // --- Update Dynamic Materials ---
    // Handle scrolling textures
    for (const material of msh3js.three.dynamic.scrollingMaterials) {
      if (material.three.map?.userData.isScrolling) {
        const scrollData = material.three.map.userData;
        scrollData._scrollTimeU = (scrollData._scrollTimeU + scrollData.scrollSpeedU * elapsedTime);
        scrollData._scrollTimeV = (scrollData._scrollTimeV + scrollData.scrollSpeedV * elapsedTime);
        material.three.map.offset.set(-scrollData._scrollTimeU, scrollData._scrollTimeV);
        if (material.three.specularMap?.userData.isScrolling) {
          material.three.specularMap.offset.set(-scrollData._scrollTimeU, scrollData._scrollTimeV);
        }
      }
    }

    // Handle animated textures
    for (const material of msh3js.three.dynamic.animatedMaterials) {
      const animData = material.three.map.userData;
      const { gridSize, totalFrames, fps } = animData;
      animData._animationTime += elapsedTime;
      const frameDuration = 1 / fps;
      const currentFrame = Math.floor(animData._animationTime / frameDuration) % totalFrames;

      const row = Math.floor(currentFrame / gridSize);
      const col = currentFrame % gridSize;

      material.three.map.offset.x = (col / gridSize);
      material.three.map.offset.y = -(row / gridSize);

      if (material.three.specularMap?.userData.isAnimated) {
        material.three.specularMap.offset.copy(material.three.map.offset);
      }
    }

    // Handle pulsating materials
    for (const material of msh3js.three.dynamic.pulsatingMaterials) {
      if (!material.three.userData.alwaysOn && material.three.userData.pulseSpeed) {
        const { minBrightness, pulseSpeed } = material.three.userData;
        const pulse = (1 + Math.sin(time / 1000 * (pulseSpeed / 2))) / 2;
        const brightness = minBrightness + pulse * (1.0 - minBrightness);
        material.three.color.setScalar(brightness);
      }
    }

    // --- Update Cloth Simulations ---
    if (msh3js.options.clothSim) {
      for (const clothSim of msh3js.three.dynamic.clothMeshes) {
        msh3js.updateClothSimulation(clothSim, elapsedTime);
      }
    }

    // Update controls
    msh3js.three.orbitControls.update();

    // Update the cube camera for refraction if refractive meshes exist
    if (msh3js.three.dynamic.refractiveMeshes.length > 0 && msh3js.three.cubeCamera) {
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
        for (const mesh of msh3js.three.dynamic.refractiveMeshes) box.expandByObject(mesh);
        box.getCenter(center);
        msh3js.three.cubeCamera.position.copy(center);

        // Hide refractive objects before rendering the cubemap
        for (const mesh of msh3js.three.dynamic.refractiveMeshes) mesh.visible = false;

        // Update the cubemap
        msh3js.three.cubeCamera.update(msh3js.three.renderer, msh3js.three.scene);

        // IMPORTANT: After updating the cubecam, set the render target back to the default framebuffer (the screen).
        msh3js.three.renderer.setRenderTarget(null);

        // Store the new camera state for the next frame's comparison
        msh3js.three.lastCameraPosition.copy(msh3js.three.camera.position);
        msh3js.three.lastCameraQuaternion.copy(msh3js.three.camera.quaternion);

        // Show refractive objects again
        for (const mesh of msh3js.three.dynamic.refractiveMeshes) mesh.visible = true;
      }
    }

    // If bloom is enabled AND the composers have been created, use the bloom pipeline.
    if (msh3js.options.bloomEnabled && msh3js.three.bloomComposer && msh3js.three.composer) {
      // Temporarily replace non-glowing materials with a black material
      msh3js.prepareBloomPass();
      msh3js.three.bloomComposer.render(elapsedTime);
      // Restore the original materials
      msh3js.restoreOriginalMaterials();
      // Render the final scene with the bloom effect composited on top
      msh3js.three.composer.render(elapsedTime);
    } else {
      // If bloom is disabled, just render the scene normally.
      msh3js.three.renderer.render(msh3js.three.scene, msh3js.three.camera);
    }

    // Update the view helper
    // This needs to be done after all other rendering to draw on top.
    if (msh3js.options.enableViewHelper === true && msh3js.three.viewHelper) {
      msh3js.three.renderer.clearDepth();
      msh3js.three.viewHelper.render();
    }

    // Update stats
    if (msh3js.options.showStats === true && msh3js.stats != null)
      msh3js.stats.update();

    // Save rendertime
    msh3js.renderTime = time;
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

      // Resize composer
      if (msh3js.three.composer != null)
        msh3js.three.composer.setSize(
          Math.floor(msh3js.size.width),
          Math.floor(msh3js.size.height));

      // Resize viewHelper
      if (msh3js.options.enableViewHelper === true)
        msh3js.three.viewHelper.update();

      return true;
    }
    return false;
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
  async processFiles() {
    // Start Three
    if (msh3js.three.scene == null) await msh3js.startThree(msh3js.startOptions);

    // Only process files that have not been processed yet
    const filesToProcess = Object.values(msh3js._files).filter(f => !f.processed);
    if (filesToProcess.length === 0) return false;

    msh3js.showLoadingBar(filesToProcess.length);

    const newMshData = await msh3js.processMshFiles(filesToProcess);
    const optionsProcessed = await msh3js.processOptionFiles(filesToProcess);
    const texturesProcessed = await msh3js.processTgaFiles(filesToProcess);

    // Add shadow casters for imported shadowvolumes, discover cloth collisions
    for (const msh of newMshData) {
      if (msh.hasShadowVolume || msh.hasCloth) {
        if (msh3js.startOptions?.enableShadows !== false)
          msh3js.options.enableShadows = true;
        const shadowCasterClones = []; // Store clones to be added after traversal
        // Add new models (meshes), cloth meshes, and collision objects, avoiding duplicates
        msh.group.traverse((childObj) => {
          if (childObj.isMesh) {
            // If the mesh is a shadow volume, clone it and add it to its parent.
            if ((childObj.userData.isShadowVolume || childObj.userData.shouldBeShadowCaster)) {
              const shadowClone = childObj.clone();
              shadowClone.name = `${childObj.name}_ShadowCaster`;
              shadowClone.castShadow = true;
              shadowClone.visible = true; // Original sv is hidden by default
              // The clone's material only writes to the depth buffer for shadow casting.
              shadowClone.material = new THREE.MeshDepthMaterial({
                transparent: true,
                opacity: 0,
                depthWrite: false,
                depthTest: true,
              });
              shadowCasterClones.push({ clone: shadowClone, parent: childObj.parent });
              if (msh3js.debug) console.log(`processFiles::Cloned shadow volume: ${childObj.name} for shadow casting.`);
            } else if (childObj.name.toLowerCase().startsWith("c_") && !msh3js.three.dynamic.collisionObjects.find(c => c.uuid === childObj.uuid)) {
              // Add newly discovered cloth collisions
              msh3js.three.dynamic.collisionObjects.push(childObj);
            }
          }
        });

        // Add the shadow caster clones to the scene after the traversal is complete
        // This prevents them from being visited by the traverse() call and added to the UI.
        for (const { clone, parent } of shadowCasterClones) {
          parent.add(clone);
        }
      }
    }

    // Populate dynamic lists for render loop optimization
    for (const msh of newMshData) { // Iterate over new models
      // Add any newly discovered missing textures to our running total.
      for (const requiredTexture of msh.requiredTextures) {
        const textureName = requiredTexture.toLowerCase();
        if (!msh3js._files.hasOwnProperty(textureName)) {
          msh3js.ui.missingTextures.add(textureName);
        }
      }
      for (const material of msh.materials) {
        if (material.matd?.atrb?.renderFlags?.refracted) {
          msh.group.traverse((child) => {
            if (child.isMesh && (Array.isArray(child.material) ? child.material.includes(material.three) : child.material === material.three)) {
              if (!msh3js.three.dynamic.refractiveMeshes.includes(child)) { // This check is still needed
                msh3js.three.dynamic.refractiveMeshes.push(child);
              }
            }
          });
        }
        if (material.scrolling) {
          msh3js.three.dynamic.scrollingMaterials.push(material);
        }
        if (material.three.map?.userData.isAnimated) {
          msh3js.three.dynamic.animatedMaterials.push(material);
        }
        if (material.pulsate) {
          msh3js.three.dynamic.pulsatingMaterials.push(material);
        }
      }
    }
    if (msh3js.debug) console.log("processFiles::Dynamic lists populated:", msh3js.three.dynamic);

    const fileProcessed = newMshData.length > 0;

    // If any of the newly loaded models have cloth, enable the simulation by default
    const anyNewCloth = newMshData.some(msh => msh.hasCloth);
    if (anyNewCloth && !msh3js.startOptions?.cloth?.enabled) {
      msh3js.options.clothSim = true;
      await msh3js.initClothSimulations(); // Start the simulation immediately
      if (msh3js.debug) console.log("processFiles::Cloth detected in new files, initializing simulation.");
    }

    // If any of the newly loaded models have glow, enable bloom by default
    const anyNewGlow = newMshData.some(msh =>
      msh.materials.some(mat =>
        mat.matd?.atrb?.renderFlags?.glow || mat.matd?.atrb?.bitFlags?.glow ||
        mat.matd?.atrb?.renderFlags.glowScroll)
    );
    if (anyNewGlow && !msh3js.startOptions?.bloom?.enabled) {
      msh3js.options.bloomEnabled = true;
      if (msh3js.three.bloomPass) msh3js.three.bloomPass.enabled = true;
      if (msh3js.debug) console.log("processFiles::Glow detected in new files, enabling bloom.");
    }

    // Rebuild Tweakpane pane if already present for msh tab
    if (msh3js.pane != null) await msh3js.initTweakpane();
    if (msh3js.debug) console.log("processFiles::Files processed:", msh3js._files);

    // Cleanup URLs after loading is complete
    msh3js.hideLoadingBar();

    // If a file was processed, update scene-dependent elements like light helpers
    if (fileProcessed) {
      // Calculate the total bounding box of all loaded MSH objects
      const totalBoundingBox = msh3js.getSceneBounds();

      if (msh3js.three.msh.length === 1)
        msh3js.frameCamera(msh3js.three.msh[0].group); // Frame the camera on the msh
      else
        msh3js.frameCamera(); // Frame the camera on the entire scene

      // Recalculate light positions based on the new total scene bounds
      msh3js.calculateLightPosition(msh3js.three.dirLight, msh3js.options.dirLightAzimuth, msh3js.options.dirLightElevation);
      msh3js.calculateLightPosition(msh3js.three.dirLight2, msh3js.options.dirLight2Azimuth, msh3js.options.dirLight2Elevation);

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

    // Return true if at least one file was processed
    return fileProcessed;
  },

  /**
   * Processes all .msh files from a list of file objects.
   * @param {Array<Object>} filesToProcess - An array of file objects to process.
   * @returns {Promise<Array<Object>>} A promise that resolves with an array of the newly loaded MSH data objects.
   */
  async processMshFiles(filesToProcess) {
    const mshFilesToProcess = [];
    for (const fileObj of filesToProcess) {
      if (!fileObj.file.name.toLowerCase().endsWith(".msh")) continue;

      const mshScene = await msh3js.three.mshLoader.loadAsync(fileObj.url);
      if (msh3js.debug) console.log("processMshFiles::Loaded msh:", mshScene);

      const newMshData = {
        fileName: fileObj.file.name,
        fileSize: fileObj.file.size,
        lastModified: fileObj.file.lastModified,
        textures: [],
        requiredTextures: mshScene.userData.textures,
        matl: mshScene.userData.matl,
        materials: mshScene.userData.materials,
        modl: mshScene.userData.modl,
        models: mshScene.userData.models,
        sceneInfo: mshScene.userData.sceneInfo,
        group: mshScene,
        hasCloth: mshScene.userData.hasCloth,
        hasSkeleton: mshScene.userData.hasSkeleton,
        hasVertexColors: mshScene.userData.hasVertexColors,
        hasShadowVolume: mshScene.userData.hasShadowVolume,
        anm2: mshScene.userData.anm2,
        animations: mshScene.userData.animations,
        keyframes: mshScene.userData.keyframes,
      };

      msh3js.three.msh.push(newMshData);
      mshFilesToProcess.push(newMshData);
      msh3js.three.scene.add(mshScene);

      fileObj.processed = true;
      msh3js.updateLoadingBar();
    }

    // After all MSH files are loaded, handle hardpoint attachments and skeleton helpers.
    if (mshFilesToProcess.length > 0) {
      msh3js.handleHardpointAttachments(mshFilesToProcess);
      msh3js.createSkeletonHelper();
    }

    // After loading new models, re-run option file processing in case they can now be applied.
    const unprocessedOptionFiles = Object.values(msh3js._files).filter(f => f.file.name.toLowerCase().endsWith(".msh.option") && !f.applied);
    if (unprocessedOptionFiles.length > 0) {
      await msh3js.processOptionFiles(unprocessedOptionFiles);
    }

    // After loading new models, check if any pre-loaded textures can now be applied.
    for (const newMsh of mshFilesToProcess) {
      for (const texture of Object.values(msh3js._files)) {
        if (texture.threeTexture && newMsh.requiredTextures.map(t => t.toLowerCase()).includes(texture.file.name.toLowerCase())) {
          for (const material of newMsh.materials) {
            msh3js.applyTextureToMaterial(texture.threeTexture, material, newMsh);
          }
        }
      }
    }

    return mshFilesToProcess;
  },

  /**
   * Processes all .msh.option files for a given list of MSH data objects.
   * @param {Array<Object>} mshDataArray - An array of MSH data objects to check for associated option files.
   * @returns {Promise<boolean>} A promise that resolves to true if any option file was processed.
   */
  async processOptionFiles(filesToProcess) {
    const optionFiles = filesToProcess.filter(f => f.file.name.toLowerCase().endsWith(".msh.option"));
    if (optionFiles.length === 0) return false;

    let anyFileProcessed = false;

    for (const optionFileObj of optionFiles) {
      // If the option file has already been successfully applied, skip it.
      if (optionFileObj.applied) continue;

      const optionFileName = optionFileObj.file.name.toLowerCase();
      const targetMshName = optionFileName.replace(/\.option$/, '');

      // Read and store the text content if we haven't already.
      if (!optionFileObj.optionText)
        optionFileObj.optionText = await optionFileObj.file.text();

      // Find the corresponding loaded MSH data
      const mshData = msh3js.three.msh.find(m => m.fileName.toLowerCase() === targetMshName);

      if (mshData) {
        if (msh3js.debug) console.log(`processOptionFiles::Found option file for already loaded MSH: ${mshData.fileName}`);
        const lines = optionFileObj.optionText.split(/\r?\n/);

        for (const line of lines) {
          const parts = line.trim().split(/\s+/).filter(p => p);
          for (let i = 0; i < parts.length; i++) {
            const command = parts[i].toLowerCase();

            if (command === "-bump") {
              let j = i + 1;
              while (j < parts.length && !parts[j].startsWith('-')) {
                const textureName = parts[j].toLowerCase();
                const bumpTextureName = textureName.replace(/(\.tga)?$/, "_bump.tga");
                if (msh3js.debug) console.log(`processOptionFiles::-bump rule found. Applying ${bumpTextureName} to materials using ${textureName}.tga`);

                mshData.requiredTextures.push(bumpTextureName);
                if (msh3js.debug) console.log("processOptionFiles:: Added bumpmap to required textures:", bumpTextureName);

                for (const material of mshData.materials) {
                  if (material.matd?.tx0d?.toLowerCase() === `${textureName}.tga` &&
                    (!material.matd.atrb.renderFlags.lightMap || !material.matd.atrb.renderFlags.detail)) {
                    material.matd.tx1d = bumpTextureName;

                    // If the bump texture is already loaded, apply it immediately.
                    const existingTexture = mshData.textures.find(t => t.name.toLowerCase() === bumpTextureName);
                    if (existingTexture) {
                      if (msh3js.debug) console.log(`processOptionFiles::Re-applying existing texture ${bumpTextureName} as bump map.`);
                      msh3js.applyTextureToMaterial(existingTexture, material, mshData);
                    }
                  }
                }
                j++;
              }
              i = j - 1;
            } else if (command === "-hiresshadow") {
              const lodValue = (i + 1 < parts.length && !isNaN(parseInt(parts[i + 1]))) ? parseInt(parts[i + 1]) : 0;
              if (msh3js.debug) console.log(`processOptionFiles::-hiresshadow rule found with LOD value: ${lodValue}`);

              mshData.group.traverse((child) => {
                if (child.isMesh && !child.userData.isCloth && !child.name.toLowerCase().startsWith("c_") &&
                  !child.name.toLowerCase().startsWith("p_") && !child.name.toLowerCase().includes("collision") &&
                  !child.name.toLowerCase().endsWith("_lod2") && !child.name.toLowerCase().endsWith("_lod3") &&
                  !child.name.toLowerCase().includes("lowres") && !child.name.toLowerCase().includes("lowrez") &&
                  !child.name.toLowerCase().includes("shadowvolume") && !child.name.toLowerCase().startsWith("sv_")) {
                  let shadowMesh = null;
                  const baseName = child.name.replace(/_lod[23]|_lowres|_lowrez/i, '');
                  const lod2 = mshData.group.getObjectByName(`${baseName}_lod2`);
                  const lod3 = mshData.group.getObjectByName(`${baseName}_lod3`);
                  const low = mshData.group.getObjectByName(`${baseName}_lowres`) || mshData.group.getObjectByName(`${baseName}_lowrez`);

                  if (lodValue === 0) {
                    shadowMesh = child;
                  } else if (lodValue === 1) {
                    shadowMesh = lod2 ?? lod3 ?? low;
                  } else if (lodValue === 2) {
                    shadowMesh = lod3 ?? low;
                  } else if (lodValue === 3) {
                    shadowMesh = low;
                  }

                  if (shadowMesh) {
                    shadowMesh.userData.shouldBeShadowCaster = true;
                    if (msh3js.debug) console.log(`processOptionFiles::Flagging "${shadowMesh.name}" to be a shadow caster for "${child.name}".`);
                  } else {
                    child.userData.shouldBeShadowCaster = true;
                    if (msh3js.debug) console.log(`processOptionFiles::Flagging "${child.name}" to be a shadow caster".`);
                  }
                }
              });
              if (msh3js.startOptions?.enableShadows !== false)
                msh3js.options.enableShadows = true;
              // If a value was provided, skip the next part of the line
              if (lodValue > 0 || (i + 1 < parts.length && !isNaN(parseInt(parts[i + 1])))) {
                i++;
              }
            } else if (command === "-hardskinonly") {
              if (msh3js.debug) console.log(`processOptionFiles::-hardskinonly rule found for ${mshData.fileName}.`);

              mshData.group.traverse((child) => {
                if (child.isSkinnedMesh) {
                  if (msh3js.debug) console.log(`processOptionFiles::Applying hard skinning to "${child.name}".`);
                  const geometry = child.geometry;
                  const skinWeight = geometry.getAttribute('skinWeight');
                  const vertexCount = skinWeight.count;

                  for (let i = 0; i < vertexCount; i++) {
                    const weights = [
                      skinWeight.getX(i),
                      skinWeight.getY(i),
                      skinWeight.getZ(i),
                      skinWeight.getW(i)
                    ];

                    let maxWeight = 0;
                    let maxIndex = -1;

                    for (let j = 0; j < 4; j++) {
                      if (weights[j] > maxWeight) {
                        maxWeight = weights[j];
                        maxIndex = j;
                      }
                    }

                    if (maxIndex !== -1) {
                      skinWeight.setX(i, maxIndex === 0 ? 1.0 : 0.0);
                      skinWeight.setY(i, maxIndex === 1 ? 1.0 : 0.0);
                      skinWeight.setZ(i, maxIndex === 2 ? 1.0 : 0.0);
                      skinWeight.setW(i, maxIndex === 3 ? 1.0 : 0.0);
                    }
                  }
                  skinWeight.needsUpdate = true;
                }
              });
            } else if (command === "-scale") {
              const scaleValueStr = parts[i + 1];
              if (scaleValueStr) {
                const scaleValue = parseFloat(scaleValueStr);
                if (!isNaN(scaleValue) && scaleValue !== 0.0 && scaleValue !== 1.0) {
                  if (msh3js.debug) console.log(`processOptionFiles::-scale rule found with value: ${scaleValue}. Applying to ${mshData.fileName}.`);
                  mshData.group.scale.set(scaleValue, scaleValue, scaleValue);
                  // Skip the next part since it's the scale value
                  i++;
                } else if (msh3js.debug) {
                  console.log(`processOptionFiles::-scale value of ${scaleValue} is ignored.`);
                }
              } else if (msh3js.debug) {
                console.warn(`processOptionFiles::-scale command found but no scale value provided.`);
              }
            }
          }
        }
        // Mark as processed and applied.
        optionFileObj.processed = true;
        optionFileObj.applied = true;
        msh3js.updateLoadingBar();
        anyFileProcessed = true;
      } else if (!optionFileObj.processed) {
        // If the MSH isn't found, but we haven't marked this as processed yet (i.e., first time seeing it),
        // mark it as processed to count it for the loading bar, but leave `applied` as false.
        if (msh3js.debug) console.log(`processOptionFiles::Option file ${optionFileObj.file.name} loaded, but matching MSH not found yet. Storing for later.`);
        optionFileObj.processed = true;
        msh3js.updateLoadingBar();
        anyFileProcessed = true;
      }
    }
    return anyFileProcessed;
  },

  /**
   * Processes all .tga files from a list of file objects, applying them to materials.
   * @param {Array<Object>} filesToProcess - An array of file objects to process.
   * @returns {Promise<boolean>} A promise that resolves to true if any texture file was processed.
   */
  async processTgaFiles(filesToProcess) {
    let anyFileProcessed = false;
    for (const fileObj of filesToProcess) {
      if (!fileObj.file.name.toLowerCase().endsWith(".tga")) continue;
      if (fileObj.processed) continue;

      // If no models are loaded yet, we'll load the texture and store it for later.
      // If models are loaded, we check if this texture is required by any of them.
      let isRequiredByAnyModel = msh3js.three.msh.some(msh =>
        msh.requiredTextures.map(t => t.toLowerCase()).includes(fileObj.file.name.toLowerCase())
      );

      // Load the texture if no models are present yet, or if it's required by an existing model.
      if (msh3js.three.msh.length === 0 || isRequiredByAnyModel) {
        if (msh3js.debug) console.log("processTgaFiles::Loading texture:", fileObj.file.name);
        try {
          const threeTexture = await msh3js.three.tgaLoader.loadAsync(fileObj.url);
          threeTexture.name = fileObj.file.name;
          threeTexture.colorSpace = THREE.SRGBColorSpace;
          threeTexture.wrapS = THREE.RepeatWrapping;
          threeTexture.wrapT = THREE.RepeatWrapping;
          threeTexture.flipY = true;

          // Store the loaded THREE.Texture on the file object for later use.
          fileObj.threeTexture = threeTexture;

          // If models that need this texture are already present, apply it now.
          for (const msh of msh3js.three.msh) {
            const requiredLower = msh.requiredTextures.map(t => t.toLowerCase());
            const fileNameLower = fileObj.file.name.toLowerCase();

            if (requiredLower.includes(fileNameLower)) {
              msh.textures.push(threeTexture);
              for (const material of msh.materials) {
                // If this texture was previously missing, remove it from the UI list.
                if (msh3js.ui.missingTextures.has(fileNameLower)) {
                  msh3js.ui.missingTextures.delete(fileNameLower);
                  if (msh3js.debug) console.log(`processTgaFiles::Removed ${fileNameLower} from missing textures list.`);
                }
                msh3js.applyTextureToMaterial(threeTexture, material, msh);
              }
            }
          }

          fileObj.processed = true;
          anyFileProcessed = true;
          // Now that it's processed, we can revoke the URL.
          URL.revokeObjectURL(fileObj.url);
          fileObj.url = null;

          msh3js.updateLoadingBar();
        } catch (error) {
          console.error("processTgaFiles::Error loading texture:", fileObj.file.name, error);
          msh3js.updateLoadingBar(); // Still update bar on error
        }
      } else {
        // If models are loaded but this texture isn't required by any of them, we can skip it.
        if (msh3js.debug) console.log(`processTgaFiles::Skipping unrequired texture: ${fileObj.file.name}`);
        // We don't delete it, as it might be needed by a future model.
        // We also don't mark it as processed, so it can be re-evaluated later.
      }
    }
    return anyFileProcessed;
  },

  /**
   * Applies a loaded texture to a single material based on its properties and texture slots.
   * @param {THREE.Texture} threeTexture - The texture to apply.
   * @param {Object} material - The material data object from the MSH loader.
   * @param {Object} msh - The MSH data object the material belongs to.
   */
  applyTextureToMaterial(threeTexture, material, msh) {
    const fileNameLower = threeTexture.name.toLowerCase();

    // Handle generated cloth material
    if (material.texture?.toLowerCase() === fileNameLower) {
      material.three.map = threeTexture;
      material.three.wireframe = false;
      material.three.anisotropy = msh3js.options.anisotropicFiltering;
      if (msh3js.debug) console.log("applyTextureToMaterial::Cloth texture found for material:", material.name);
      material.three.needsUpdate = true;
    }

    if (!material.matd) return;

    // Handle tx0d (diffuse map)
    if (material.matd.tx0d?.toLowerCase() === fileNameLower) {
      msh3js.processMaterial(threeTexture, material, 'diffuse', msh);
    }

    // Handle tx1d (bump/normal/detail maps)
    if (material.matd.tx1d?.toLowerCase() === fileNameLower) {
      if (material.matd.atrb && (material.matd.atrb.renderFlags.lightMap || material.matd.atrb.renderFlags.detail)) {
        msh3js.processMaterial(threeTexture, material, 'lightmap', msh);
      } else if (material.matd.atrb) {
        msh3js.processMaterial(threeTexture, material, 'normal', msh);
      }
    }

    // Handle tx2d (detail map, treated as a lightmap)
    if (material.matd.tx2d?.toLowerCase() === fileNameLower) {
      if (material.matd.atrb && (!material.matd.atrb.renderFlags.detail && !material.matd.atrb.renderFlags.lightMap)) {
        msh3js.processMaterial(threeTexture, material, 'lightmap', msh);
      } else {
        msh3js.processMaterial(threeTexture, material, 'normal', msh);
      }
    }

    // Handle tx3d (always cubemap/envmap)
    if (material.matd.tx3d?.toLowerCase() === fileNameLower) {
      msh3js.processMaterial(threeTexture, material, 'cubemap', msh);
    }
  },

  /**
   * Mutates material properties based on a loaded texture and its intended use.
   * @param {THREE.Texture} threeTexture - The texture being applied.
   * @param {Object} material - The material data object.
   * @param {string} type - The type of map being applied ('diffuse', 'normal', 'lightmap', 'cubemap').
   * @param {Object} msh - The parent MSH data object.
   */
  processMaterial(threeTexture, material, type, msh) {
    material.three.needsUpdate = true;

    switch (type) {
      case 'diffuse':
        material.three.map = threeTexture;
        material.three.wireframe = false;
        material.three.anisotropy = msh3js.options.anisotropicFiltering;
        material.three.needsUpdate = true;


        if (material.specular) {
          const { data, width, height } = threeTexture.image;
          const channels = data.length / (width * height);
          const alphaData = new Uint8Array(width * height * 4);
          for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
            const alpha = (channels === 4) ? data[i + 3] : 255;
            alphaData[j] = alpha; alphaData[j + 1] = alpha; alphaData[j + 2] = alpha; alphaData[j + 3] = alpha;
          }
          const alphaTexture = new THREE.DataTexture(alphaData, width, height, THREE.RGBAFormat);
          alphaTexture.flipY = true;
          alphaTexture.colorSpace = THREE.LinearSRGBColorSpace;
          alphaTexture.wrapS = THREE.RepeatWrapping;
          alphaTexture.wrapT = THREE.RepeatWrapping;
          alphaTexture.anisotropy = msh3js.options.anisotropicFiltering;
          alphaTexture.needsUpdate = true;
          material.three.specularMap = alphaTexture;
          alphaTexture.name = threeTexture.name + "_alpha";
          msh.textures.push(alphaTexture);
          if (msh3js.debug) console.log('processMaterial::RGBA DataTexture constructed for specularMap from alpha channel.');
        }

        if (material.glow) {
          material.three.emissive = new THREE.Color(0xffffff);
          material.three.emissiveMap = threeTexture;
        }

        if (material.matd.atrb.renderFlags.refracted || material.matd.atrb.renderFlags.ice) {
          if (!msh3js.three.cubeCamera) {
            const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, { format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
            msh3js.three.cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);
            msh3js.three.cubeCamera.name = "CubeCamera";
            if (msh3js.debug) console.log("processMaterial::CubeCamera created for refraction.");
          }
          material.three.envMap = msh3js.three.cubeCamera.renderTarget.texture;
          material.three.envMap.mapping = THREE.CubeRefractionMapping;
          material.three.refractionRatio = 0.9;
          material.three.combine = THREE.MixOperation;
          msh3js.three.dynamic.refractiveMeshes.push(...msh.group.children.filter(child => child.isMesh && (Array.isArray(child.material) ? child.material.includes(material.three) : child.material === material.three)));
          if (msh3js.debug) console.log('processMaterial::Refraction enabled for material:', material.name);
        }

        if (material.scrolling) {
          const scrollingTexture = threeTexture.clone();
          scrollingTexture.wrapS = THREE.RepeatWrapping;
          scrollingTexture.wrapT = THREE.RepeatWrapping;
          scrollingTexture.userData.isScrolling = true;
          scrollingTexture.userData.scrollSpeedU = (material.matd.atrb.data0 || 0) / 255.0;
          scrollingTexture.userData.scrollSpeedV = (material.matd.atrb.data1 || 0) / 255.0;
          scrollingTexture.userData._scrollTimeU = 0;
          scrollingTexture.userData._scrollTimeV = 0;
          material.three.map = scrollingTexture;
          scrollingTexture.name = threeTexture.name + "_scrolling";
          msh.textures.push(scrollingTexture);
          if (msh3js.debug) console.log('processMaterial::Scrolling texture created for material:', material.name);

          if (material.three.specularMap) {
            const scrollingSpecularMap = material.three.specularMap.clone();
            scrollingSpecularMap.userData.isScrolling = true;
            material.three.specularMap = scrollingSpecularMap;
            scrollingSpecularMap.name = material.three.specularMap.name + "_scrolling";
            msh.textures.push(scrollingSpecularMap);
          }

          if (material.matd.atrb.renderFlags.glowScroll) {
            material.three.emissive = new THREE.Color(0xffffff);
            material.three.emissiveMap = scrollingTexture;
          }
        }

        if (material.matd.atrb.renderFlags.animated) {
          const totalFrames = material.matd.atrb.data0 || 4;
          const fps = material.matd.atrb.data1 || 10;
          const gridSize = Math.sqrt(totalFrames);
          if (Math.floor(gridSize) !== gridSize) console.warn(`Animated texture for material "${material.name}" has ${totalFrames} frames, which is not a perfect square.`);

          const animatedTexture = threeTexture.clone();
          animatedTexture.wrapS = THREE.RepeatWrapping;
          animatedTexture.wrapT = THREE.RepeatWrapping;
          animatedTexture.userData.isAnimated = true;
          animatedTexture.userData.gridSize = gridSize;
          animatedTexture.userData.totalFrames = totalFrames;
          animatedTexture.userData.fps = fps;
          animatedTexture.userData._animationTime = 0;
          material.three.map = animatedTexture;
          animatedTexture.name = threeTexture.name + "_animated";
          msh.textures.push(animatedTexture);

          if (material.three.specularMap) {
            const animatedSpecularMap = material.three.specularMap.clone();
            animatedSpecularMap.userData.isAnimated = true;
            material.three.specularMap = animatedSpecularMap;
            msh.textures.push(animatedSpecularMap);
          }
          if (msh3js.debug) console.log('processMaterial::Animated texture created for material:', material.name);
        }

        if (material.pulsate) {
          const pulseSpeed = material.matd.atrb.data1 || 0;
          if (pulseSpeed === 0) {
            material.three.userData.alwaysOn = true;
            if (msh3js.debug) console.log('processMaterial::Pulsating material Always On:', material.name);
          } else {
            material.three.userData.minBrightness = (material.matd.atrb.data0 || 0) / 255.0;
            material.three.userData.pulseSpeed = pulseSpeed;
            if (msh3js.debug) console.log('processMaterial::Pulsating material configured:', material.name);
          }
        }
        break;

      case 'normal':
        if (msh3js.debug) console.log('processMaterial::Bumpmap/Normalmap texture found for material:', material.name);
        if (material.matd.atrb.renderFlags.refracted || material.matd.atrb.renderFlags.ice) {
          threeTexture.colorSpace = THREE.LinearSRGBColorSpace;
          material.three.bumpMap = threeTexture;
          material.three.bumpScale = 0.05;
        } else {
          threeTexture.colorSpace = THREE.LinearSRGBColorSpace;
          if (material.matd.atrb.renderFlags.bumpmapTiled || material.matd.atrb.renderFlags.bumpmapTiledAndDetailmapAndEnvmap) {
            const scaleU = material.matd.atrb.data0 > 0 ? material.matd.atrb.data0 : 1;
            const scaleV = material.matd.atrb.data1 > 0 ? material.matd.atrb.data1 : 1;
            threeTexture.repeat.set(scaleU, scaleV);
          }
          if (msh3js.isTextureGrayscale(threeTexture)) {
            if (msh3js.debug) console.log('processMaterial::Texture detected as bump map (grayscale).');
            material.three.bumpMap = threeTexture;
            material.three.bumpScale = 0.1;
          } else {
            if (msh3js.debug) console.log('processMaterial::Texture detected as normal map (color).');
            threeTexture.anisotropy = msh3js.options.anisotropicFiltering;
            material.three.normalMap = threeTexture;
            material.three.normalMap.needsUpdate = true;
          }
        }
        msh.textures.push(threeTexture);
        break;

      case 'lightmap':
        if (msh3js.debug) console.log('processMaterial::Detail/Lightmap texture found for material:', material.name);
        const detailTexture = threeTexture.clone();
        detailTexture.colorSpace = THREE.LinearSRGBColorSpace;
        if (!material.matd.atrb.renderFlags.bumpmapTiledAndDetailmapAndEnvmap && !material.matd.atrb.renderFlags.bumpmapTiled) {
          const scaleU = material.matd.atrb.data0 > 0 ? material.matd.atrb.data0 : 1;
          const scaleV = material.matd.atrb.data1 > 0 ? material.matd.atrb.data1 : 1;
          detailTexture.repeat.set(scaleU, scaleV);
        }
        detailTexture.anisotropy = msh3js.options.anisotropicFiltering;
        detailTexture.needsUpdate = true;
        material.three.lightMap = detailTexture;
        material.three.lightMapIntensity = 2.0;
        msh.textures.push(detailTexture);
        break;

      case 'cubemap':
        if (msh3js.debug) console.log('processMaterial::Cubemap texture found for material:', material.name);
        const cubeTexture = msh3js.convertCrossToCube(threeTexture);
        material.three.envMap = cubeTexture;
        msh.textures.push(threeTexture); // Keep original for reference
        cubeTexture.name = threeTexture.name + "_cubeTexture";
        msh.textures.push(cubeTexture);
        break;
    }
  },

  handleHardpointAttachments(mshFilesToProcess) {
    for (const newMshData of mshFilesToProcess) {
      const newMshScene = newMshData.group;
      const hpActive = newMshScene.getObjectByName('hp_active');

      if (hpActive) {
        if (msh3js.debug) console.log(`handleHardpointAttachments::Found "hp_active" in ${newMshData.fileName}`);
        let hpWeapons = null;
        let parentMshGroup = null;

        for (const existingMsh of msh3js.three.msh) {
          if (existingMsh.group === newMshScene) continue;
          const foundHpWeapons = existingMsh.group.getObjectByName('hp_weapons');
          if (foundHpWeapons) {
            hpWeapons = foundHpWeapons;
            parentMshGroup = existingMsh.group;
            break;
          }
        }

        if (hpWeapons) {
          if (msh3js.debug) console.log(`handleHardpointAttachments::Found "hp_weapons" in ${parentMshGroup.name}. Attaching ${newMshData.fileName}.`);
          msh3js.three.scene.updateMatrixWorld(true);
          if (hpActive.parent) hpActive.parent.remove(hpActive);

          const hpWeaponsMatrix = hpWeapons.matrixWorld.clone();
          const hpActiveMatrix = hpActive.matrixWorld.clone();
          const alignMatrix = new THREE.Matrix4().multiplyMatrices(hpWeaponsMatrix, hpActiveMatrix.invert());

          newMshScene.matrix.premultiply(alignMatrix);
          newMshScene.matrix.decompose(newMshScene.position, newMshScene.quaternion, newMshScene.scale);
          hpWeapons.attach(newMshScene);
        }
      }
    }
  },

  createSkeletonHelper() {
    if (msh3js.three.skeletonHelper) return; // A helper already exists.

    for (const msh of msh3js.three.msh) {
      if (msh.hasSkeleton) {
        msh.group.traverse((child) => {
          if (child.isSkinnedMesh && !msh3js.three.skeletonHelper) {
            msh3js.three.scene.updateMatrixWorld(true);
            const helper = new THREE.SkeletonHelper(child);
            helper.name = "skeletonHelper";
            helper.visible = msh3js.options.showSkeleton;
            msh3js.three.scene.add(helper);
            msh3js.three.skeletonHelper = helper;
          }
        });
        if (msh3js.three.skeletonHelper) break; // Stop after creating one.
      }
    }
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

    if (params.renderingAPI == null) params.renderingAPI = msh3js.options.renderingAPI;
    if (params.size == null) params.size = msh3js.size ?? { width: 1, height: 1 };
    if (params.pixelRatio == null) params.pixelRatio = msh3js.options.pixelRatio ?? 1.0;
    if (params.GPU == null) params.GPU = msh3js.options.preferredGPU ?? "default";
    if (params.AA == null) params.AA = msh3js.options.aa ?? false;
    if (params.sampleCount == null) params.sampleCount = msh3js.options.sampleCount ?? 0;
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
      console.log("createRenderer::Requested API:", params.renderingAPI, "\nRenderer Params:", params);

    try {
      // WebGL/WebGL2 Renderer
      if (params.renderingAPI === 'webgl2' && !msh3js._supportedFeatures.webgl2.supported) {
        console.warn("createRenderer::WebGL2 not supported, falling back to WebGL.");
        params.renderingAPI = 'webgl';
      }
      rendererParams.antialias = params.AA;
      rendererParams.sampleCount = params.sampleCount;
      rendererParams.reverseDepthBuffer = params.reverseDepth;
      rendererParams.useLegacyLights = true;

      newRenderer = new THREE.WebGLRenderer(rendererParams);
      newContext = newRenderer.getContext();
      newRenderer.debug = {
        checkShaderErrors: msh3js.debug,
        onShaderError: null
      };

    } catch (e) {
      console.error(`createRenderer::Error initializing ${params.renderingAPI} renderer:`, e);
      // Fallback logic could be added here if initialization fails
      alert(`Failed to create the ${params.renderingAPI} renderer. Please check console for errors.`);
      return {};
    }
    newRenderer.shadowMap.enabled = msh3js.options.enableShadows;
    newRenderer.setSize(params.size.width, params.size.height, false);
    newRenderer.setPixelRatio(params.pixelRatio);
    newRenderer.setClearColor(0x000000, 0);
    newRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    msh3js.three.renderer = newRenderer;
    msh3js.context = newContext;
    msh3js.canvas = newCanvas;

    if (msh3js.debug) {
      console.log(`createRenderer::New ${params.renderingAPI.toUpperCase()} renderer created:`, newRenderer);
    }
    return { renderer: newRenderer, context: newContext, canvas: newCanvas };
  },

  // Recreates the renderer, canvas, and related components
  async recreateRenderer() {
    // Nullify the animation loop
    if (msh3js.three.renderer) msh3js.three.renderer.setAnimationLoop(null);
    if (msh3js.debug) console.log("recreateRenderer::Animation loop nullified.");
    // Remove and nullify stats
    await msh3js.initStats(false);
    if (msh3js.debug) console.log("recreateRenderer::Stats removed.");
    // Dispose of viewHelper
    if (msh3js.three.viewHelper) {
      msh3js.three.viewHelper.dispose();
      msh3js.three.viewHelper = null;
      if (msh3js.debug) console.log("recreateRenderer::ViewHelper disposed.");
    }
    // Nullify orbitControls
    if (msh3js.three.orbitControls) {
      msh3js.three.orbitControls.dispose();
      msh3js.three.orbitControls = null;
      if (msh3js.debug) console.log("recreateRenderer::OrbitControls disposed.");
    }
    // Dispose of composers
    if (msh3js.three.composer) {
      msh3js.three.composer.dispose();
      msh3js.three.composer = null;
    }
    if (msh3js.three.bloomComposer) {
      msh3js.three.bloomComposer.dispose();
      msh3js.three.bloomComposer = null;
    }
    msh3js.three.renderPass = null;
    msh3js.three.bloomPass = null;
    if (msh3js.debug) console.log("recreateRenderer::Composers disposed.");
    // Dispose of renderer
    if (msh3js.three.renderer) {
      msh3js.three.renderer.dispose();
      msh3js.three.renderer = null;
      if (msh3js.debug) console.log("recreateRenderer::Renderer disposed.");
    }
    // Release context
    if (msh3js.context) {
      msh3js.context.finish();
      msh3js.context = null;
    }
    if (msh3js.debug) console.log("recreateRenderer::Context released.");

    // Remove and nullify canvas
    if (msh3js.canvas) {
      msh3js.manageListeners("remove", "fileDropCanvas");
      msh3js._appContainer.removeChild(msh3js.canvas);
      msh3js.canvas = null;
      if (msh3js.debug) console.log("recreateRenderer::Canvas removed from DOM.");
    }

    // Create and inject new canvas into the DOM
    msh3js.canvas = msh3js.createCanvas({
      id: "msh3jsCanvas",
      width: msh3js.size.width,
      height: msh3js.size.height,
    }, true);
    msh3js.canvas.style.width = "100%";
    msh3js.canvas.style.height = "100%";
    msh3js.resize();
    msh3js.manageListeners("add", "fileDropCanvas");
    if (msh3js.debug) console.log("recreateRenderer::New canvas created and injected.");

    await msh3js.initThree();
    if (msh3js.debug) console.log("recreateRenderer::Three re-initialized.");
    msh3js.three.renderer.setAnimationLoop(msh3js.render);
    if (msh3js.debug) console.log("recreateRenderer::Animation loop set.");
    await msh3js.initStats(msh3js.options.showStats);
    if (msh3js.debug) console.log("recreateRenderer::Stats re-initialized.");

    if (msh3js.debug)
      console.log("recreateRenderer::Renderer recreated.");
  },

  // Create and assign Three.js EffectComposer
  async createComposer() {
    if (!msh3js.three.renderer || !msh3js.three.scene || !msh3js.three.camera) {
      console.error("createComposer::Renderer, Scene, or Camera not initialized.");
      return null;
    }

    // Dynamically import post-processing modules
    const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
    const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
    const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
    const { ShaderPass } = await import("three/addons/postprocessing/ShaderPass.js");

    msh3js._modules.EffectComposer = EffectComposer;
    msh3js._modules.RenderPass = RenderPass;
    msh3js._modules.UnrealBloomPass = UnrealBloomPass;
    msh3js._modules.ShaderPass = ShaderPass;

    // Dispose of existing composers and passes to prevent resource leaks
    if (msh3js.three.composer) {
      msh3js.three.composer.dispose();
      msh3js.three.composer = null;
    }
    if (msh3js.three.bloomComposer) {
      msh3js.three.bloomComposer.dispose();
      msh3js.three.bloomComposer = null;
    }
    // Passes are disposed of by their parent composer, but we nullify the references.
    msh3js.three.renderPass = null;
    msh3js.three.bloomPass = null;
    if (msh3js.debug) console.log("createComposer::Disposed of old composers.");


    // Shaders for selective bloom post-processing
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `;

    const fragmentShader = `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        // Additive blending: Add the bloom color to the base color.
        // The alpha of the bloom texture is ignored, preserving the base alpha.
        gl_FragColor = texture2D( baseTexture, vUv ) + vec4( 1.0, 1.0, 1.0, 0.0 ) * texture2D( bloomTexture, vUv );
      }
    `;

    // 1. Create a RenderPass for the main scene.
    const renderPass = new msh3js._modules.RenderPass(msh3js.three.scene, msh3js.three.camera);

    // 2. Create the bloom pass.
    const bloomPass = new msh3js._modules.UnrealBloomPass(
      new THREE.Vector2(msh3js.size.width, msh3js.size.height),
      msh3js.options.bloomStrength,
      msh3js.options.bloomRadius,
      msh3js.options.bloomThreshold
    );
    msh3js.three.bloomPass = bloomPass;

    // Create a shared render target that supports alpha transparency.
    const renderTarget = new THREE.WebGLRenderTarget(msh3js.size.width, msh3js.size.height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    });

    // 3. Create a composer for the bloom pass. This renders the glowing parts to a separate buffer.
    const bloomComposer = new msh3js._modules.EffectComposer(msh3js.three.renderer, renderTarget);
    bloomComposer.renderToScreen = false; // Don't render to screen
    bloomComposer.addPass(renderPass);
    bloomComposer.addPass(bloomPass);
    msh3js.three.bloomComposer = bloomComposer;

    // 4. Create the final composer that combines the scene and the bloom effect.
    const composer = new msh3js._modules.EffectComposer(msh3js.three.renderer, renderTarget);
    composer.addPass(renderPass);
    // This ShaderPass takes the bloom texture and adds it to the scene texture.
    const finalPass = new msh3js._modules.ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.readBuffer.texture }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        defines: {}
      }), "baseTexture"
    );
    finalPass.needsSwap = true;
    composer.addPass(finalPass);
    msh3js.three.composer = composer;
    msh3js.three.renderPass = renderPass;

    // Set initial enabled state
    msh3js.three.bloomPass.enabled = msh3js.options.bloomEnabled;
  },

  // Prepares the scene for the bloom pass by replacing non-glowing materials
  prepareBloomPass() {
    msh3js.three.scene.traverse((obj) => {
      if (obj.isMesh) {
        msh3js.three.materialsToRestore[obj.uuid] = obj.material; // Save original material(s)
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        let hasGlow = false;

        const newMaterials = materials.map(originalMat => {
          // Find the corresponding MSH material data
          let mshMat = null;
          for (const msh of msh3js.three.msh) {
            mshMat = msh.materials.find(m => m.three === originalMat);
            if (mshMat) break;
          }

          // Check for the glow flags
          if (mshMat && (mshMat.matd?.atrb?.renderFlags?.glow || mshMat.matd?.atrb?.bitFlags?.glow ||
            mshMat.matd?.atrb?.renderFlags.glowScroll)) {
            hasGlow = true;
            return originalMat; // Keep the glowing material
          } else {
            return msh3js.three.darkMaterial; // Replace with black
          }
        });

        if (hasGlow) {
          obj.material = Array.isArray(obj.material) ? newMaterials : newMaterials[0];
        } else {
          obj.material = msh3js.three.darkMaterial;
        }
      } else if (obj.isLine || obj.isSprite) {
        // Also darken helpers like GridHelper, SkeletonHelper, ViewHelper sprites, etc.
        msh3js.three.materialsToRestore[obj.uuid] = obj.material;
        obj.material = msh3js.three.darkMaterial;
      }
    });
  },

  // Restores the original materials after the bloom pass
  restoreOriginalMaterials() {
    for (const uuid in msh3js.three.materialsToRestore) {
      const obj = msh3js.three.scene.getObjectByProperty('uuid', uuid);
      if (obj) {
        obj.material = msh3js.three.materialsToRestore[uuid];
      }
    }
    msh3js.three.materialsToRestore = {};
  },

  // Recreates the ViewHelper with current settings.
  async recreateViewHelper() {
    // Dispose of the existing ViewHelper if it exists
    if (msh3js.three.viewHelper) {
      msh3js.three.viewHelper.dispose();
      msh3js.three.viewHelper = null;
      if (msh3js.debug) console.log("recreateViewHelper::Old ViewHelper disposed.");
    }

    // Only recreate if it's currently enabled in options
    if (msh3js.options.enableViewHelper) {
      // Ensure camera, renderer, and controls are initialized before creating ViewHelper
      if (!msh3js.three.camera) msh3js.createCamera();
      if (!msh3js.three.renderer) {
        const { renderer, context } = await msh3js.createRenderer({
          renderingAPI: msh3js.options.renderingAPI,
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
      if (!msh3js.three.orbitControls) msh3js.createOrbitControls();

      await msh3js.createViewHelper();
      msh3js.three.viewHelper.setEnabled(true);
      if (msh3js.debug) console.log("recreateViewHelper::New ViewHelper created and enabled.");
    } else {
      if (msh3js.debug) console.log("recreateViewHelper::ViewHelper not recreated as it is disabled.");
    }
  },

  // Create HTML canvas element for DOM and return it
  createCanvas(params, inject = false) {
    if (!params.id) params.id = "canvas";
    if (!params.width) params.width = 1;
    if (!params.height) params.height = 1;

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
      const container = msh3js._appContainer ?? document.body;
      container.appendChild(newCanvas);
      if (msh3js.debug)
        console.log("createCanvas::Canvas injected into _appContainer.");
    }
    return newCanvas;
  },

  // Create and assign Three.js scene
  createScene() {
    msh3js.three.scene = new THREE.Scene();
    msh3js.three.scene.name = "MSH3JS_Scene";

    if (msh3js.options.transparentBackground)
      msh3js.three.scene.background = null;
    else
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
    msh3js.three.dirLight2 = new THREE.DirectionalLight(msh3js.options.dirLight2Color, msh3js.options.dirLight2Intensity);
    msh3js.three.dirLight2.name = "directionalLight2";
    msh3js.three.dirLight2.target.name = "directionalLight2Target";
    msh3js.three.dirLight2.castShadow = false;
    msh3js.calculateLightPosition(msh3js.three.dirLight2, msh3js.options.dirLight2Azimuth, msh3js.options.dirLight2Elevation);
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

    // Set initial shadow camera properties
    msh3js.frameCamera();

    if (msh3js.debug) console.log("createScene::Scene created: ", msh3js.three.scene);
    return msh3js.three.scene;
  },

  // Create and assign Three.js camera
  createCamera() {
    const aspect = (msh3js.size.width > 0 && msh3js.size.height > 0) ? (msh3js.size.width / msh3js.size.height) : 1;
    msh3js.three.camera = new THREE.PerspectiveCamera(
      75, // fov
      aspect, // aspect ratio
      0.1, // near plane
      100 // far plane
    ); // Create a new Three.JS camera
    msh3js.three.camera.position.set(0, 1, 5); // Set camera position
    // Initialize properties for cubecam optimization
    msh3js.three.lastCameraPosition = new THREE.Vector3();
    msh3js.three.lastCameraQuaternion = new THREE.Quaternion();
    msh3js.three.camera.name = "sceneCamera";
    if (msh3js.debug) console.log("createCamera::Camera created: ", msh3js.three.camera);
    return msh3js.three.camera;
  },

  // Calculates and returns the total bounding box for all visible MSH objects in the scene.
  getSceneBounds() {
    const totalBoundingBox = new THREE.Box3();
    if (msh3js.three.msh.length > 0) {
      for (const msh of msh3js.three.msh) {
        // Create a temporary box for the current MSH group.
        const mshBBox = new THREE.Box3();
        // The `true` parameter makes setFromObject traverse all children.
        // It respects the `visible` property of objects.
        mshBBox.setFromObject(msh.group, true);
        // If the bounding box is not empty, merge it into the total.
        if (!mshBBox.isEmpty()) {
          totalBoundingBox.union(mshBBox);
        }
      }
    }
    msh3js.three.sceneBounds = totalBoundingBox;
    if (msh3js.debug) console.log("getSceneBounds::Scene bounds calculated: ", totalBoundingBox);
    return totalBoundingBox;
  },

  // Frame camera to fit an object's bounding box
  frameCamera(obj = null, margin = 1.0) {
    if (!msh3js.three.camera) msh3js.createCamera(); // Ensure camera exists

    const target = new THREE.Box3();

    // If an object is passed, frame it (respecting visibility). Otherwise, frame the entire scene.
    if (obj) {
      obj.traverse((child) => {
        if ((child.isMesh || child.isSkinnedMesh) && child.visible && child.geometry) {
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const childBBox = child.geometry.boundingBox.clone();
          childBBox.applyMatrix4(child.matrixWorld);
          target.union(childBBox);
        }
      });
    } else if (msh3js.three.msh.length > 0) target.copy(msh3js.three.sceneBounds ?? msh3js.getSceneBounds());

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

      // Update shadow camera to fit the new scene bounds
      if (msh3js.three.dirLight.castShadow) {
        const shadowRadius = radius > 0 ? radius : 10; // Use a fallback for empty scenes
        const shadowCam = msh3js.three.dirLight.shadow.camera;

        shadowCam.near = 0.1;
        shadowCam.far = shadowRadius * 4;
        shadowCam.left = -shadowRadius * 1.5;
        shadowCam.right = shadowRadius * 1.5;
        shadowCam.top = shadowRadius * 1.5;
        shadowCam.bottom = -shadowRadius * 1.5;

        shadowCam.updateProjectionMatrix();
        if (msh3js.debug) console.log("frameCamera::Shadow camera updated for new scene bounds.");
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

      // Calculate the radius of a sphere that encloses the entire bounding box.
      const boxRadius = target.getSize(new THREE.Vector3()).length() / 2;

      // Set the orbit controls' zoom limits first.
      // minDistance is the closest the camera can get to the object's center.
      // We set it to be just outside the bounding box radius.
      msh3js.three.orbitControls.minDistance = boxRadius * 0.1;
      msh3js.three.orbitControls.maxDistance = distance * 10; // Allow zooming out 10x from the framed position.

      // Now, set the camera's clipping planes based on the full zoom range.
      // The near plane must be closer than the closest zoom point.
      msh3js.three.camera.near = Math.max(0.01, msh3js.three.orbitControls.minDistance - boxRadius);
      // The far plane must be further than the furthest zoom point.
      msh3js.three.camera.far = msh3js.three.orbitControls.maxDistance + boxRadius + 10;

      msh3js.three.orbitControls.update();
    }
    msh3js.three.camera.updateProjectionMatrix(); // Apply new near/far planes

    // Save state for reset
    if (msh3js.three.orbitControls)
      msh3js.three.orbitControls.saveState();

    // Check if the scene depth is large enough to warrant a reverse depth buffer.
    const depthRatio = msh3js.three.camera.far / msh3js.three.camera.near;
    if (depthRatio > 8000) { // Reverse depth threshold
      let canUseReverseDepth = false;
      if (msh3js._supportedFeatures.webgl2.supported || msh3js._supportedFeatures.webgl.reverseDepth) {
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
    msh3js.three.orbitControls.target.set(0, 0, 0);
    msh3js.three.orbitControls.minDistance = camera.near * 1.05;
    msh3js.three.orbitControls.maxDistance = camera.far * 0.95;
    msh3js.three.orbitControls.listenToKeyEvents(window);
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
      const { renderer, context } = await msh3js.createRenderer({ // Use the user-selected API
        renderingAPI: msh3js.options.renderingAPI,
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
      const viewHelperModule = await import("./ViewHelper.js");
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
      if (msh3js.debug) console.log("LoadingManager::Started loading:", url, " for ", total, "items.");
    };
    msh3js.three.loadingManager.onProgress = function (url, loaded, total) {
      if (msh3js.debug) console.log("LoadingManager::In progress:", url, " : " + loaded + " / " + total);
    };
    msh3js.three.loadingManager.onLoad = function () {
      if (msh3js.debug) console.log("LoadingManager::Finished!");
    };
    msh3js.three.loadingManager.onError = function (url) {
      if (msh3js.debug) console.error("LoadingManager::Error!", url);
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
      fileInput.accept = ".msh,.tga,.msh.option,application/octet-stream,image/tga,text/plain";
      msh3js._appContainer.appendChild(fileInput);
      msh3js._fileInput = fileInput;
      if (msh3js.debug) console.log("createFileInput::File input created: ", fileInput);
      msh3js.manageListeners("add", "fileInput");
    } catch (e) { console.error("createFileInput::Error creating file input:", e); return null; }
    return fileInput;
  },

  // Call necessary functions on input files
  async handleFileInput(e) {
    const files = e.target.files;
    if (msh3js.debug) console.log("handleFileInput::Files selected:", files);
    msh3js.addFiles(files);
    await msh3js.processFiles(msh3js._files)
  },

  // Click file input
  clickFileInput(e) {
    const fileInput = msh3js._fileInput ?? document.getElementById("fileInput") ?? msh3js.createFileInput();
    if (fileInput)
      fileInput.click();
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
      animFileInput.accept = ".msh,application/octet-stream"; // Only accept msh files
      msh3js._appContainer.appendChild(animFileInput);
      msh3js.manageListeners("add", "animFileInput", animFileInput);
    } catch (e) { console.error("createAnimationFileInput::Error creating file input:", e); }
    return animFileInput;
  },

  // Handles the file input for animation-only MSH files
  async handleAnimationFileInput(e) {
    const files = e.target.files;
    if (msh3js.debug) console.log("handleAnimationFileInput::Files selected:", files);
    if (files.length > 0) {
      await msh3js.importAnimations(files);
    }
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
      msh3js.manageListeners("add", "bgFileInput", bgFileInput, { once: true });
    } catch (e) { console.error("createBackgroundImageInput::Error creating file input:", e); }

    return bgFileInput;
  },

  // Handles the file input for the background image
  async handleBackgroundImageInput(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading bar for the single file being uploaded.
    msh3js.showLoadingBar(1);

    // Store the URL in options. This will be a blob URL.
    msh3js.options.backgroundImage = file.name;

    const fileURL = URL.createObjectURL(file);
    await msh3js.loadAndSetBackground(fileURL, file.name.toLowerCase());

    // Hide the loading bar once the background is set.
    msh3js.hideLoadingBar();
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
    const totalBoundingBox = msh3js.three.sceneBounds ?? msh3js.getSceneBounds();
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

      // Before assigning the new background, dispose of the old one if it's a texture
      if (msh3js.three.scene.background && msh3js.three.scene.background.isTexture) {
        msh3js.three.scene.background.dispose();
        if (msh3js.debug) console.log("loadAndSetBackground::Disposed of old background texture.");
      }

      msh3js.three.scene.background = backgroundTexture;
      msh3js.three.scene.environment = backgroundTexture;

      // Update the loading bar to show completion for this file.
      msh3js.updateLoadingBar();

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

    // Show loading bar for the number of files being imported.
    msh3js.showLoadingBar(files.length);

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
        // Update loading bar progress and revoke URL
        msh3js.updateLoadingBar();
        URL.revokeObjectURL(fileURL);
      }
    }
    // If we successfully added animations, rebuild the UI to show them.
    if (animationsAdded) {
      msh3js.updateAnimationList(); // Efficiently update only the dropdown
      if (msh3js.debug) console.log("importAnimations::Animation list updated.");
    } else if (msh3js.debug) console.log("importAnimations::No new animations were added.");

    // Hide the loading bar when done.
    msh3js.hideLoadingBar();
  },

  // Initialize cloth simulations for all cloth meshes
  async initClothSimulations() {
    if (!msh3js.three.msh || msh3js.three.msh.length === 0) return;

    let OBB;
    if (msh3js._modules.OBB)
      OBB = msh3js._modules.OBB;
    else {
      const obbModule = await import("three/addons/math/OBB.js");
      OBB = obbModule.OBB;
      msh3js._modules.OBB = OBB;
    }

    // Process all MSH files, but only add new cloth simulations
    for (const msh of msh3js.three.msh) {
      // Only search for cloth meshes if the msh is flagged as having cloth.
      if (!msh.hasCloth) continue;

      const clothMeshes = [];
      msh.group.traverse((obj) => {
        // Check if a simulation for this mesh already exists
        const simExists = msh3js.three.dynamic.clothMeshes.some(sim => sim.mesh.uuid === obj.uuid);
        if (obj.isMesh && obj.userData.isCloth && !simExists) {
          clothMeshes.push(obj);
        }
      });

      // Create simulations for the newly found cloth meshes
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

        // Determine which collision objects this cloth mesh should interact with.
        const specificCollisionObjects = [];
        if (clothData?.coll?.collisionObjects) {
          for (const collRef of clothData.coll.collisionObjects) {
            const collObjectName = collRef.name.toLowerCase();
            const shape = collRef.shape;
            // Find the actual collision object in the global list.
            const collisionObj = msh3js.three.dynamic.collisionObjects.find(
              (obj) => obj.name.toLowerCase() === collObjectName
            );

            if (collisionObj) {
              let collider = null;
              // Pre-compute the bounding volume based on the shape type from the MSH data.
              if (shape === 0) { // Sphere
                if (!collisionObj.geometry.boundingSphere)
                  collisionObj.geometry.computeBoundingSphere();
                collider = new THREE.Sphere();

              } else if (shape === 1 || shape === 2) { // Cylinder or Box
                if (!collisionObj.geometry.boundingBox)
                  collisionObj.geometry.computeBoundingBox();
                collider = new OBB();
              }

              collisionObj.userData.shape = shape;
              collisionObj.userData.collider = collider;
              specificCollisionObjects.push(collisionObj);
            }
          }
        }

        const newClothMesh = {
          mesh: clothMesh,
          particles: particles,
          constraints: constraints,
          // Use only the collision objects specific to this cloth mesh.
          collisionObjects: specificCollisionObjects.length > 0 ? specificCollisionObjects : msh3js.three.dynamic.collisionObjects,
        };
        msh3js.three.dynamic.clothMeshes.push(newClothMesh);

        if (msh3js.debug) {
          console.log(`Cloth simulation initialized for ${clothMesh.name}:`, {
            particles: particles.length,
            constraints: constraints.length,
            fixedPoints: particles.filter(p => p.fixed).length, // Fallback to all if none are specified.
            collisionObjects: newClothMesh.collisionObjects
          });
        }
      }
    }
  },

  // Update cloth simulation (Verlet integration)
  updateClothSimulation(clothSim, deltaTime) {
    const dt = Math.min(deltaTime, 0.016);
    const iterations = 1; // Constraint relaxation iterations
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
      collisionObj.updateMatrixWorld(true);
      let collider = collisionObj.userData.collider;

      // Correctly update the collider's position and orientation for this frame
      if (collisionObj.userData.shape === 0) { // Sphere
        // Recalculate the sphere's world position each frame
        collider.copy(collisionObj.geometry.boundingSphere).applyMatrix4(collisionObj.matrixWorld);
      } else { // OBB
        // Recalculate the OBB's world position each frame
        collider.fromBox3(collisionObj.geometry.boundingBox).applyMatrix4(collisionObj.matrixWorld);
      }

      for (const particle of clothSim.particles) {
        if (particle.fixed) continue;

        if (collisionObj.userData.shape === 0) {
          const distance = particle.position.distanceTo(collider.center);
          if (distance < collider.radius) {
            const normal = particle.position.clone().sub(collider.center).normalize();
            particle.position.copy(collider.center).add(normal.multiplyScalar(collider.radius));
          }
        } else if (collisionObj.userData.shape === 1 || collisionObj.userData.shape === 2) {
          if (collider.containsPoint(particle.position)) {
            // Transform particle to OBB local space
            const localPos = particle.position.clone().sub(collider.center);
            const invRot = new THREE.Matrix3().copy(collider.rotation).transpose();
            localPos.applyMatrix3(invRot);

            // Compute distances to each face (positive values indicate inside)
            const dxMin = collider.halfSize.x + localPos.x;
            const dxMax = collider.halfSize.x - localPos.x;
            const dyMin = collider.halfSize.y + localPos.y;
            const dyMax = collider.halfSize.y - localPos.y;
            const dzMin = collider.halfSize.z + localPos.z;
            const dzMax = collider.halfSize.z - localPos.z;

            // Find the minimum positive distance (nearest face)
            let minDist = Infinity;
            let pushNormal = new THREE.Vector3(); // Local space normal of nearest face
            if (dxMin > 0 && dxMin < minDist) { minDist = dxMin; pushNormal.set(-1, 0, 0); }
            if (dxMax > 0 && dxMax < minDist) { minDist = dxMax; pushNormal.set(1, 0, 0); }
            if (dyMin > 0 && dyMin < minDist) { minDist = dyMin; pushNormal.set(0, -1, 0); }
            if (dyMax > 0 && dyMax < minDist) { minDist = dyMax; pushNormal.set(0, 1, 0); }
            if (dzMin > 0 && dzMin < minDist) { minDist = dzMin; pushNormal.set(0, 0, -1); }
            if (dzMax > 0 && dzMax < minDist) { minDist = dzMax; pushNormal.set(0, 0, 1); }

            if (minDist < Infinity) {
              // Apply push in local space, then transform back to world
              const pushVec = pushNormal.multiplyScalar(minDist + 1e-4); // Add epsilon to avoid re-penetration
              localPos.add(pushVec);
              localPos.applyMatrix3(collider.rotation);
              particle.position.copy(collider.center).add(localPos);
            }
          }
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

  // Reset cloth simulations
  resetClothSimulations() {
    if (!msh3js.three.msh || msh3js.three.msh.length === 0) return;

    if (msh3js.three.dynamic.clothMeshes.length > 0) {
      for (const clothSim of msh3js.three.dynamic.clothMeshes) {
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
      // Clear the list after resetting all simulations
      msh3js.three.dynamic.clothMeshes = [];
    }
  },

  // Plays a specific animation by name
  playAnimation(animationName, fromUi = true) {
    if (msh3js.debug) console.log(`playAnimation::Attempting to play "${animationName}"`);
    if (fromUi) msh3js.ui.currentAnimation = animationName;

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
      // Create canvases if none passed
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
        msh3js._supportedFeatures.webgl.supported = true;

        // Check for AA support in webgl
        let gl = webglCanvas.getContext("webgl", { antialias: true });
        if (gl) {
          const att = gl.getContextAttributes();
          msh3js._supportedFeatures.webgl.aa = att.antialias === true;
          msh3js._supportedFeatures.webgl.maxSamples = 2;
        } else {
          gl = webglCanvas.getContext("webgl", { antialias: false });
        }

        // Check for reverse depth buffer support
        const extClipControl = gl.getExtension("EXT_clip_control");
        if (extClipControl) msh3js._supportedFeatures.webgl.reverseDepth = true;

        // Populate sampleCountOptions for WebGL
        msh3js._supportedFeatures.webgl.sampleCountOptions = [{ text: 'Off', value: 0 }];
        if (msh3js._supportedFeatures.webgl.aa) {
          msh3js._supportedFeatures.webgl.sampleCountOptions.push({ text: 'On', value: 2 }); // WebGL 1 is effectively on/off
        }

        gl.finish(); // Let browser know we're done with this context
        gl = null; // Release context
      }
    } catch (e) {
      if (msh3js.debug)
        console.error("getSupportedGraphicsFeatures::WebGL error: ", e);
    } finally {
      if (msh3js.debug)
        console.log(
          "getSupportedGraphicsFeatures::WebGL support:",
          msh3js._supportedFeatures.webgl.supported,
          "\nWebGL AA support:",
          msh3js._supportedFeatures.webgl.aa,
          "\nWebGL Reverse depth buffer support:",
          msh3js._supportedFeatures.webgl.reverseDepth
        );
    }

    try {
      // Detect WebGL2 Support
      if (webgl2Canvas.getContext("webgl2")) {
        msh3js._supportedFeatures.webgl2.supported = true;
        msh3js._supportedFeatures.webgl2.reverseDepth = true;

        // Check for AA support in webgl2 and get max samples
        let gl2 = webgl2Canvas.getContext("webgl2", { antialias: true });
        if (gl2) {
          const att = gl2.getContextAttributes();
          msh3js._supportedFeatures.webgl2.aa = att.antialias === true;
          msh3js._supportedFeatures.webgl2.maxSamples = gl2.getParameter(gl2.MAX_SAMPLES);
        } else {
          msh3js._supportedFeatures.webgl2.aa = false;
          gl2 = webgl2Canvas.getContext("webgl2", { antialias: false });
        }

        // Populate sampleCountOptions for WebGL2
        msh3js._supportedFeatures.webgl2.sampleCountOptions = [{ text: 'Off', value: 0 }];
        if (msh3js._supportedFeatures.webgl2.aa) {
          // WebGL2 supports multiple sample counts, usually powers of 2 up to maxSamples.
          for (let i = 2; i <= msh3js._supportedFeatures.webgl2.maxSamples; i *= 2) {
            msh3js._supportedFeatures.webgl2.sampleCountOptions.push({
              text: `${i}x`, value: i
            });
          }
        }

        gl2.finish(); // Finished with this context
        gl2 = null; // Release context
      }
    } catch (e) {
      if (msh3js.debug)
        console.error("getSupportedGraphicsFeatures::WebGL2 error: ", e);
    } finally {
      if (msh3js.debug)
        console.log(
          "getSupportedGraphicsFeatures::WebGL2 support:",
          msh3js._supportedFeatures.webgl2.supported,
          "\nWebGL2 AA support:",
          msh3js._supportedFeatures.webgl2.aa,
          "\nWebGL2 max AA samples:",
          msh3js._supportedFeatures.webgl2.maxSamples,
        );
    }
  },

  // Get persistent storage support
  async getPersistentStorageSupport() {
    // Check for persistent storage
    if (window.navigator.storage && window.navigator.storage.persisted) {
      const allowed = await window.navigator.storage.persisted();
      if (msh3js.debug) console.log("getPersistentStorageSupport::Persistent Storage allowed:", allowed);
      if (allowed) {
        const persists = await window.navigator.storage.persist();
        msh3js._supportedFeatures.persistentStorage = persists;
        if (msh3js.debug) console.log("getPersistentStorageSupport::Persistent Storage enabled:", persists);
      }
    }
  },

  // Manages listeners by group (renderTrigger, resize, fileDrop) and action (add/remove)
  manageListeners(action, group, element = null, options = {}) {
    // Filter out noisy logs for drag/resize events from debug
    if (msh3js.debug && !['dragMove', 'dragClickCapture', 'resizeMove'].includes(group))
      console.log("manageListeners::params::action:", action, "group:", group);

    if (group === "fileDropCanvas") {
      if (action === "add") {
        if (msh3js._listeners.fileDrop) return; // Listener already active

        if (msh3js.isTauri) {
          // Use Tauri's event-based file drop via window, caching the modules.
          (async () => {
            let windowModule = msh3js._modules.tauriWindow;
            let fsModule = msh3js._modules.tauriFs;

            if (!windowModule) {
              windowModule = await import('@tauri-apps/api/window');
              msh3js._modules.tauriWindow = windowModule;
              if (msh3js.debug) console.log("manageListeners::Tauri window module loaded.");
            }
            if (!fsModule) {
              fsModule = await import('@tauri-apps/plugin-fs');
              msh3js._modules.tauriFs = fsModule;
              if (msh3js.debug) console.log("manageListeners::Tauri fs module loaded.");
            }

            const { getCurrentWindow } = windowModule;
            const { readFile, readTextFile } = fsModule;

            const appWindow = getCurrentWindow();
            appWindow.onDragDropEvent(async (event) => {
              if (event.payload.type === 'drop') {
                if (msh3js.debug) console.log("manageListeners:fileDropCanvas:Tauri file drop event received:", event.payload.paths);
                const files = [];
                const mshPaths = [];
                for (const path of event.payload.paths) {
                  try {
                    if (path.endsWith('.msh')) mshPaths.push(path);

                    let content = null; // readFile or readTextFile
                    if (path.endsWith('.option')) content = readTextFile(path);
                    else content = await readFile(path);

                    const fileName = path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1);
                    const file = new File([content], fileName, { type: 'application/octet-stream' });
                    files.push(file);
                  } catch (error) {
                    console.error(`manageListeners::Error reading dropped file in Tauri: ${path}`, error);
                  }
                }
                if (files.length > 0) {
                  msh3js.addFiles(files);
                  await msh3js.processFiles();
                  for (const path of mshPaths) {
                    // Load option file of msh
                    const optionFile = await msh3js._getOptionFile(path);
                    if (optionFile) {
                      msh3js.addFiles([optionFile]);
                      await msh3js.processFiles(); // Possible bumpmap required texture added
                    }
                    // Load required textures of msh
                    const mshData = msh3js.three.msh.find(msh => msh.fileName.toLowerCase() === path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1).toLowerCase());
                    if (mshData) {
                      const requiredTextures = await msh3js._getRequiredTextures(path, mshData.requiredTextures);
                      if (requiredTextures.length > 0) {
                        msh3js.addFiles(requiredTextures);
                        await msh3js.processFiles();
                      }
                      // If msh with cloth models
                      if (mshData.hasCloth) {
                        const clothMeshes = [];
                        // If model is cloth
                        mshData.group.traverse((child) => {
                          if (child.isMesh && child.userData.isCloth) {
                            clothMeshes.push(child);
                          }
                        });
                        if (clothMeshes.length > 0) {
                          const allClothParams = [];
                          for (const mesh of clothMeshes) {
                            // Get cloth ODF
                            const clothODF = await msh3js._getClothODF(path, mesh.name);
                            if (clothODF) {
                              const clothParams = msh3js._parseClothODF(clothODF);
                              if (clothParams.transparent) {
                                mesh.material.transparent = true;
                                if (msh3js.debug)
                                  console.log("manageListeners:fileDropCanvas: Cloth mesh ", mesh.name, " flagged as transparent.");
                              }
                              if (clothParams.hardEdge) {
                                mesh.material.transparent = false;
                                mesh.material.alphaTest = 0.5;
                                if (msh3js.debug)
                                  console.log("manageListeners:fileDropCanvas: Cloth mesh ", mesh.name, " flagged as hardEdge.");
                              }
                              allClothParams.push(clothParams);
                            }
                          }
                          for (const params of allClothParams) {
                            if (params.windSpeed) {
                              msh3js.options.clothWindSpeed = params.windSpeed * 0.1;
                              if (msh3js.debug)
                                console.log("manageListeners:fileDropCanvas: Setting cloth wind speed to ", msh3js.options.clothWindSpeed);
                            }
                            if (params.windDirection.length > 0) {
                              msh3js.options.clothWindDirection = params.windDirection[0];
                              if (msh3js.debug)
                                console.log("manageListeners:fileDropCanvas: Setting cloth wind direction to ", msh3js.options.clothWindDirection);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }).then(unlistenFn => {
              msh3js._listeners.fileDrop = unlistenFn;
            });
          })();
        } else {
          // Use standard browser drag and drop
          const dropZone = msh3js.canvas ?? msh3js._appContainer.getElementById("msh3jsCanvas") ?? msh3js.createCanvas({ id: "msh3jsCanvas", width: msh3js.size.width, height: msh3js.size.height });
          if (dropZone) {
            dropZone.addEventListener("dragenter", msh3js.preventDrag);
            dropZone.addEventListener("dragover", msh3js.preventDrag);
            dropZone.addEventListener("drop", msh3js.drop);
            msh3js._listeners.fileDrop = true; // Mark as active
          }
        }
      } else if (action === "remove") {
        if (typeof msh3js._listeners.fileDrop === 'function') {
          msh3js._listeners.fileDrop(); // Call Tauri's unlisten function
        } else if (msh3js._listeners.fileDrop === true) {
          const dropZone = msh3js.canvas;
          if (dropZone) {
            dropZone.removeEventListener("dragenter", msh3js.preventDrag);
            dropZone.removeEventListener("dragover", msh3js.preventDrag);
            dropZone.removeEventListener("drop", msh3js.drop);
          }
        }
        msh3js._listeners.fileDrop = null;
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
    } else if (group === "serviceWorker") {
      if (action === "add") {
        if (!msh3js._listeners.serviceWorker) {
          const handler = (event) => {
            if (event.data && event.data.action === 'reload') {
              console.log('Service Worker requested page reload.');
              window.location.reload();
            }
          };
          window.navigator.serviceWorker.addEventListener('message', handler);
          msh3js._listeners.serviceWorker = handler;
        }
      } else if (action === "remove") {
        if (msh3js._listeners.serviceWorker) {
          window.navigator.serviceWorker.removeEventListener('message', msh3js._listeners.serviceWorker);
          msh3js._listeners.serviceWorker = null;
        }
      }
    } else if (group === "animFileInput") {
      if (!element) return;
      if (action === "add") {
        if (!msh3js._listeners.animFileInput) {
          element.addEventListener("change", msh3js.handleAnimationFileInput);
          msh3js._listeners.animFileInput = msh3js.handleAnimationFileInput;
        }
      } else if (action === "remove") {
        if (msh3js._listeners.animFileInput) {
          element.removeEventListener("change", msh3js._listeners.animFileInput);
          msh3js._listeners.animFileInput = null;
        }
      }
    } else if (group === "bgFileInput") {
      if (!element) return;
      if (action === "add") {
        // Always remove the old listener before adding a new one to prevent duplicates,
        // especially since the element is recreated.
        if (msh3js._listeners.bgFileInput) {
          element.removeEventListener("change", msh3js._listeners.bgFileInput);
        }
        element.addEventListener("change", msh3js.handleBackgroundImageInput, options);
        msh3js._listeners.bgFileInput = msh3js.handleBackgroundImageInput;
      } else if (action === "remove") {
        if (msh3js._listeners.bgFileInput) {
          element.removeEventListener("change", msh3js._listeners.bgFileInput);
          msh3js._listeners.bgFileInput = null;
        }
      }
    } else if (group === "draggable") {
      if (!element) return;
      if (action === "add") {
        if (!msh3js._listeners.draggable.has(element)) {
          const handlers = {
            mouseover: msh3js._draggableMouseOver.bind(msh3js, element),
            dragStart: msh3js._draggableDragStart.bind(msh3js, element),
          };
          element.addEventListener('mouseover', handlers.mouseover);
          element.addEventListener('mousedown', handlers.dragStart);
          element.addEventListener('touchstart', handlers.dragStart, { passive: false });
          msh3js._listeners.draggable.set(element, handlers);
        }
      } else if (action === "remove") {
        const handlers = msh3js._listeners.draggable.get(element);
        if (handlers) {
          element.removeEventListener('mouseover', handlers.mouseover);
          element.removeEventListener('mousedown', handlers.dragStart);
          element.removeEventListener('touchstart', handlers.dragStart);
          msh3js._listeners.draggable.delete(element);
          msh3js._draggableStates.delete(element);
        }
      }
    } else if (group === "resizable") {
      if (!element) return;
      if (action === "add") {
        if (!msh3js._listeners.resizable.has(element)) {
          const handlers = {
            mouseMoveCursor: msh3js._resizableMouseMoveCursor.bind(msh3js, element),
            mouseDown: msh3js._resizableMouseDown.bind(msh3js, element),
          };
          element.addEventListener('mousemove', handlers.mouseMoveCursor);
          element.addEventListener('mousedown', handlers.mouseDown);
          msh3js._listeners.resizable.set(element, handlers);
        }
      } else if (action === "remove") {
        const handlers = msh3js._listeners.resizable.get(element);
        if (handlers) {
          element.removeEventListener('mousemove', handlers.mouseMoveCursor);
          element.removeEventListener('mousedown', handlers.mouseDown);
          msh3js._listeners.resizable.delete(element);
          msh3js._resizableStates.delete(element);
        }
      }
    } else if (group === "dragMove") {
      if (action === "add") {
        if (!msh3js._listeners.dragMove) {
          const moveHandler = msh3js._draggableDragMove.bind(this, element);
          const endHandler = msh3js._draggableDragEnd.bind(this, element);
          document.addEventListener('mousemove', moveHandler);
          document.addEventListener('mouseup', endHandler);
          document.addEventListener('touchmove', moveHandler, { passive: false });
          document.addEventListener('touchend', endHandler);
          msh3js._listeners.dragMove = { moveHandler, endHandler };
        }
      } else if (action === "remove") {
        if (msh3js._listeners.dragMove) {
          document.removeEventListener('mousemove', msh3js._listeners.dragMove.moveHandler);
          document.removeEventListener('mouseup', msh3js._listeners.dragMove.endHandler);
          document.removeEventListener('touchmove', msh3js._listeners.dragMove.moveHandler);
          document.removeEventListener('touchend', msh3js._listeners.dragMove.endHandler);
          msh3js._listeners.dragMove = null;
        }
      }
    } else if (group === "resizeMove") {
      if (action === "add") {
        if (!msh3js._listeners.resizeMove) {
          const moveHandler = msh3js._resizableMouseMove.bind(this, element);
          const upHandler = msh3js._resizableMouseUp.bind(this, element);
          document.addEventListener('mousemove', moveHandler);
          document.addEventListener('mouseup', upHandler);
          msh3js._listeners.resizeMove = { moveHandler, upHandler };
        }
      } else if (action === "remove") {
        if (msh3js._listeners.resizeMove) {
          document.removeEventListener('mousemove', msh3js._listeners.resizeMove.moveHandler);
          document.removeEventListener('mouseup', msh3js._listeners.resizeMove.upHandler);
          msh3js._listeners.resizeMove = null;
        }
      }
    } else if (group === "dragClickCapture") {
      if (action === "add") {
        if (!msh3js._listeners.dragClickCapture) {
          const handler = (ev) => {
            if (msh3js._draggableStates.get(element)?.hasDragged) {
              ev.stopPropagation();
            }
            // Self-removing listener
            msh3js.manageListeners('remove', 'dragClickCapture', element);
          };
          element.addEventListener('click', handler, { capture: true });
          msh3js._listeners.dragClickCapture = handler;
        }
      } else if (action === "remove") {
        if (msh3js._listeners.dragClickCapture) {
          element.removeEventListener('click', msh3js._listeners.dragClickCapture, { capture: true });
          msh3js._listeners.dragClickCapture = null;
        }
      }
    } else if (group === "keyControls") {
      const keydownHandler = (e) => {
        if (!msh3js.three.orbitControls) return;

        // Prevent actions if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
          case '+':
          case '=':
            {
              const offset = new THREE.Vector3().subVectors(msh3js.three.camera.position, msh3js.three.orbitControls.target);
              offset.multiplyScalar(0.95); // Move 5% closer
              msh3js.three.camera.position.copy(msh3js.three.orbitControls.target).add(offset);
            }
            break;
          case '-':
          case '_':
            {
              const offset = new THREE.Vector3().subVectors(msh3js.three.camera.position, msh3js.three.orbitControls.target);
              offset.multiplyScalar(1.05); // Move 5% further
              msh3js.three.camera.position.copy(msh3js.three.orbitControls.target).add(offset);
            }
            break;
          case 'r':
          case 'R':
            msh3js.three.orbitControls.reset();
            break;
          case 'c':
          case 'C':
            if (msh3js._tweakpaneContainer) {
              msh3js._tweakpaneContainer.style.display = msh3js._tweakpaneContainer.style.display === 'none' ? '' : 'none';
            }
            break;
          case 'f':
          case 'F':
            msh3js.frameCamera();
            break;
          case 'x':
          case 'X':
            {
              const distance = msh3js.three.camera.position.distanceTo(msh3js.three.orbitControls.target);
              msh3js.three.camera.position.set(distance, 0, 0).add(msh3js.three.orbitControls.target);
            }
            break;
          case 'y':
          case 'Y':
            {
              const distance = msh3js.three.camera.position.distanceTo(msh3js.three.orbitControls.target);
              msh3js.three.camera.position.set(0, distance, 0).add(msh3js.three.orbitControls.target);
            }
            break;
          case 'z':
          case 'Z':
            {
              const distance = msh3js.three.camera.position.distanceTo(msh3js.three.orbitControls.target);
              msh3js.three.camera.position.set(0, 0, distance).add(msh3js.three.orbitControls.target);
            }
            break;
          case 'o':
          case 'O':
            msh3js._toggleCameraType();
            break;
        }
      };

      if (action === "add") {
        if (!msh3js._listeners.keyControls) {
          window.addEventListener("keydown", keydownHandler);
          msh3js._listeners.keyControls = keydownHandler;
        }
      } else if (action === "remove") {
        window.removeEventListener("keydown", msh3js._listeners.keyControls);
        msh3js._listeners.keyControls = null;
      }
    } else { console.warn("manageListeners::Unknown group:", group); }
  },

  // --- WebXR Session Handlers ---
  async startXR(sessionMode) {
    if (!msh3js.three.renderer || !msh3js._supportedFeatures.xr.supported) {
      console.error("startXR:: XR is not available or renderer is not initialized.");
      return;
    }

    if (msh3js.three.xrSession) {
      console.warn("startXR:: An XR session is already active.");
      return;
    }

    const sessionInit = {
      optionalFeatures: [
        'local-floor',
        'bounded-floor',
        'hit-test',
        'dom-overlay'
      ],
      domOverlay: { root: msh3js._tweakpaneContainer }
    };

    // For AR, we want a transparent background to see the camera feed.
    if (sessionMode === 'immersive-ar') {
      // Store the current background to restore it later.
      msh3js.three.preXRBackground = msh3js.three.scene.background;
      msh3js.three.scene.background = null;
      // Initially, the model is not placed.
      msh3js.three.xrModelPlaced = false;
    }

    // --- Reposition the scene for XR ---
    // Get the center of the scene's content.
    const sceneBounds = msh3js.three.sceneBounds;
    if (!sceneBounds.isEmpty()) {
      const sceneCenter = sceneBounds.getCenter(new THREE.Vector3());
      const sceneRadius = sceneBounds.getBoundingSphere(new THREE.Sphere()).radius;

      // Calculate an offset to move the scene in front of the user.
      // We'll place it along the Z-axis, at a distance based on its size.
      const offset = new THREE.Vector3(
        -sceneCenter.x,
        -sceneCenter.y, // You might adjust this if you want the model on the floor.
        -sceneCenter.z - sceneRadius * 1.0 // Place it 1.5x its radius away.
      );

      // Apply this offset to all loaded MSH groups.
      msh3js.three.msh.forEach(msh => msh.group.position.add(offset));
    }

    try {
      msh3js.three.renderer.xr.enabled = true;
      const session = await window.navigator.xr.requestSession(sessionMode, sessionInit);
      msh3js.three.renderer.xr.setReferenceSpaceType('local-floor');
      await msh3js.three.renderer.xr.setSession(session);
      msh3js.three.xrSession = session;
      msh3js.three.xrSessionMode = sessionMode;

      // --- Fix for XR Depth Fighting (Z-Fighting) ---
      // The XR session uses an ArrayCamera (one camera per eye). We must update the
      // clipping planes on each individual eye camera to improve depth precision.
      const xrCameraArray = msh3js.three.renderer.xr.getCamera();
      const sceneRadius = msh3js.three.sceneBounds.getBoundingSphere(new THREE.Sphere()).radius;
      for (const camera of xrCameraArray.cameras) {
        camera.near = 0.1; // A small near plane is good for VR/AR.
        camera.far = sceneRadius * 4; // Tightly fit the far plane to the scene's size.
        camera.updateProjectionMatrix();
      }

      // --- AR Hit-Test and Reticle Setup ---
      if (sessionMode === 'immersive-ar') {
        // Create a reticle to show the hit-test point
        const reticleGeometry = new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2);
        const reticleMaterial = new THREE.MeshBasicMaterial();
        msh3js.three.xrReticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        msh3js.three.xrReticle.matrixAutoUpdate = false;
        msh3js.three.xrReticle.visible = false;
        msh3js.three.scene.add(msh3js.three.xrReticle);

        // Request a hit-test source
        const viewerSpace = await session.requestReferenceSpace('viewer');
        msh3js.three.xrHitTestSource = await session.requestHitTestSource({ space: viewerSpace });

        // Add a 'select' event listener for placing the model
        session.addEventListener('select', () => {
          if (msh3js.three.xrReticle.visible) {
            // Get the reticle's position and apply it to all loaded MSH groups.
            const placementPosition = new THREE.Vector3().setFromMatrixPosition(msh3js.three.xrReticle.matrix);
            msh3js.three.msh.forEach(msh => {
              msh.group.position.copy(placementPosition);
            });
            msh3js.three.xrModelPlaced = true;
            // Optionally, you could hide the reticle after placing the model.
            // msh3js.three.xrReticle.visible = false;
          }
        });

        // Hide the main model group until it's placed by the user.
        msh3js.three.msh.forEach(msh => msh.group.visible = false);
      }

      session.addEventListener('end', () => {
        // When the XR session ends, we must clean up and restore the non-XR rendering state.

        // Reset the position of all MSH groups to their original state.
        msh3js.three.msh.forEach(msh => {
          msh.group.position.set(0, 0, 0);
        });
        // Restore scene background
        if (msh3js.three.preXRBackground) {
          msh3js.three.scene.background = msh3js.three.preXRBackground;
          msh3js.three.preXRBackground = null;
        }

        msh3js.three.xrSession = null;
        msh3js.three.xrSessionMode = null;
        msh3js.three.renderer.xr.enabled = false;

        // Clean up AR-specific objects
        if (msh3js.three.xrHitTestSource) {
          msh3js.three.xrHitTestSource.cancel();
          msh3js.three.xrHitTestSource = null;
        }
        if (msh3js.three.xrReticle) {
          msh3js.three.scene.remove(msh3js.three.xrReticle);
          msh3js.three.xrReticle.geometry.dispose();
          msh3js.three.xrReticle.material.dispose();
          msh3js.three.xrReticle = null;
        }
        // The camera's state (especially projection matrix) is altered by the XR session.
        // The most reliable way to restore it is to create a new one.
        msh3js.createCamera();
        msh3js.createOrbitControls(); // OrbitControls must be re-linked to the new camera.

        // The EffectComposer holds a reference to the old camera. It must also be recreated.
        if (msh3js.three.composer) msh3js.createComposer();

        // CRITICAL: Resize the renderer and update camera aspect ratio for the main canvas.
        msh3js.resize();

        // Restart the original animation loop.
        msh3js.three.renderer.setAnimationLoop(msh3js.render);
        if (msh3js.debug) console.log("startXR::XR session ended.");
      });

      if (msh3js.debug) console.log(`startXR::Started ${sessionMode} session.`);
    } catch (error) {
      msh3js.three.renderer.xr.enabled = false;
      console.error(`startXR::Failed to start ${sessionMode} session:`, error);
    }
  },

  async stopXR() {
    if (msh3js.three.xrSession) {
      try {
        await msh3js.three.xrSession.end(); // This will trigger the 'end' event listener.
      } catch (error) {
        console.error("endXR::Failed to end XR session:", error);
      }
    }
  },

  // Handles AR hit-testing for each frame.
  handleARHitTest() {
    if (msh3js.three.xrHitTestSource && msh3js.three.xrReticle) {
      const frame = msh3js.three.renderer.xr.getFrame();
      if (frame) {
        const hitTestResults = frame.getHitTestResults(msh3js.three.xrHitTestSource);
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const referenceSpace = msh3js.three.renderer.xr.getReferenceSpace();
          const hitPose = hit.getPose(referenceSpace);

          msh3js.three.xrReticle.visible = true;
          msh3js.three.xrReticle.matrix.fromArray(hitPose.transform.matrix);

          // If the model hasn't been placed yet, make it follow the reticle.
          if (!msh3js.three.xrModelPlaced) {
            msh3js.three.msh.forEach(msh => msh.group.position.setFromMatrixPosition(msh3js.three.xrReticle.matrix));
            msh3js.three.msh.forEach(msh => msh.group.visible = true);
          }
        } else {
          msh3js.three.xrReticle.visible = false;
        }
      }
    }
  },

  // Prevents default drag behavior when dragging files over canvas
  preventDrag(e) {
    e.preventDefault();
    e.stopPropagation();
  },

  // Function to handle file drops on the canvas
  async drop(e) {
    e.stopPropagation();
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (msh3js.debug) console.log("drop::Files dropped:", droppedFiles);
    msh3js.addFiles(droppedFiles);
    await msh3js.processFiles(msh3js._files);
  },

  // Shows a loading bar with spheres corresponding to files uploaded
  showLoadingBar(count) {
    if (msh3js._loadingBar.container) {
      msh3js._loadingBar.spheresCount = count;
      // Reset loading spheres count
      msh3js._loadingBar.processedCount = 0;

      // Clear any previous spheres
      msh3js._loadingBar.spheres.forEach(sphere => sphere.remove());
      msh3js._loadingBar.spheres = [];

      // Dynamically create a sphere for each item being loaded
      for (let i = 0; i < count; i++) {
        const sphere = document.createElement('div');
        sphere.className = 'loading-sphere';
        msh3js._loadingBar.spheres.push(sphere);
        msh3js._loadingBar.container.appendChild(sphere);
      }
      // Make loading bar container visible
      msh3js._loadingBar.container.style.display = 'flex';
      if (msh3js.debug) console.log(`showLoadingBar::Showing loading bar for ${count} files.`);
    }
  },

  // Updates the loading bar progress.
  updateLoadingBar() {
    msh3js._loadingBar.processedCount++;
    if (msh3js._loadingBar.spheres.length > 0) {
      msh3js._loadingBar.spheres.forEach((sphere, index) => {
        sphere.style.opacity = index < msh3js._loadingBar.processedCount ? '1.0' : '0.1';
      });
    }
    if (msh3js.debug) console.log(`updateLoadingBar::Progress: ${msh3js._loadingBar.processedCount}/${msh3js._loadingBar.spheresCount}`);
  },

  // Hides the loading bar.
  hideLoadingBar() {
    if (msh3js._loadingBar.container) {
      msh3js._loadingBar.container.style.display = 'none';
    }
    if (msh3js.debug) console.log("hideLoadingBar::Hiding loading bar.");
  },

  // Fetches files from an array of URLs and processes them.
  async loadFromUrls(urls) {
    if (msh3js.debug) console.log("loadFromUrls::Loading from URLs:", urls);

    const files = [];
    // Show loading bar for the number of URLs
    msh3js.showLoadingBar(urls.length);

    // Use Promise.all to fetch all files in parallel for better performance.
    await Promise.all(urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`);
        }
        const blob = await response.blob();
        // Extract filename from the URL path.
        const fileName = url.substring(url.lastIndexOf('/') + 1);
        // Create a File object, which is what addFiles and processFiles expect.
        files.push(new File([blob], fileName, { type: blob.type }));
        // We call updateLoadingBar here, but it will appear to update all at once
        // because of Promise.all. This is visually fine.
        msh3js.updateLoadingBar();
      } catch (error) {
        console.error(`loadFromUrls::Failed to fetch ${url}:`, error);
        msh3js.updateLoadingBar(); // Still update the bar on error to not get stuck
      }
    }));

    if (files.length > 0) {
      msh3js.addFiles(files);
      await msh3js.processFiles(msh3js._files);
    }
  },

  // In a Tauri environment, this function loads required textures from the same directory as a given MSH file.
  async _getRequiredTextures(mshPath, requiredTextures) {
    if (!msh3js.isTauri || !requiredTextures || requiredTextures.length === 0) {
      return [];
    }

    if (msh3js.debug) console.log(`getRequiredTextures::Searching for ${requiredTextures.length} textures for ${mshPath}`);

    let fsModule = msh3js._modules.tauriFs;
    if (!fsModule) {
      fsModule = await import('@tauri-apps/plugin-fs');
      msh3js._modules.tauriFs = fsModule;
    }

    let pathModule = msh3js._modules.tauriPath;
    if (!pathModule) {
      pathModule = await import('@tauri-apps/api/path');
      msh3js._modules.tauriPath = pathModule;
    }

    const { readFile, exists } = fsModule;
    const { join, dirname } = pathModule;
    const companionFiles = [];

    try {
      const mshDir = await dirname(mshPath);

      for (const textureName of requiredTextures) {
        if (!msh3js._files[textureName.toLowerCase()]) {
          let texturePath = null;
          const pathInSameDir = await join(mshDir, textureName);
          const pathInPCDir = await join(mshDir, 'PC', textureName);
          const pathInParentDir = await join(await dirname(mshDir), textureName);

          if (await exists(pathInSameDir)) {
            texturePath = pathInSameDir;
          } else if (await exists(pathInPCDir)) {
            texturePath = pathInPCDir;
          } else if (await exists(pathInParentDir)) {
            texturePath = pathInParentDir;
          }

          try {
            if (texturePath) {
              const content = await readFile(texturePath);
              const file = new File([content], textureName, { type: 'application/octet-stream' });
              companionFiles.push(file);
              if (msh3js.debug) console.log(`getRequiredTextures::Successfully loaded companion texture: ${textureName}`);
            } else if (msh3js.debug) console.log("getRequiredTextures::Companion texture not found:", textureName);
          } catch (error) {
            if (msh3js.debug) console.warn(`getRequiredTextures::Could not find or read companion texture: ${textureName}`, error);
          }
        }
      }
    } catch (error) {
      console.error(`getRequiredTextures::Error determining directory for ${mshPath}:`, error);
    }

    return companionFiles;
  },

  // In a Tauri environment, this function loads an associated .option file from the same directory as a given MSH file.
  async _getOptionFile(mshPath) {
    if (!msh3js.isTauri) {
      return [];
    }

    const optionFileName = `${mshPath}.option`;
    const baseName = optionFileName.substring(optionFileName.lastIndexOf('\\') + 1).substring(optionFileName.lastIndexOf('/') + 1);

    // If the option file is already loaded, don't try to load it again.
    if (msh3js._files[baseName.toLowerCase()]) {
      return [];
    }

    if (msh3js.debug) console.log(`getOptionFile::Searching for option file for ${mshPath}`);

    let fsModule = msh3js._modules.tauriFs;
    if (!fsModule) {
      fsModule = await import('@tauri-apps/plugin-fs');
      msh3js._modules.tauriFs = fsModule;
    }

    const { readTextFile, exists } = fsModule;
    let optionFile = null;

    try {
      if (await exists(optionFileName)) {
        try {
          const content = await readTextFile(optionFileName);
          const file = new File([content], baseName, { type: 'text/plain' });
          optionFile = file;
          if (msh3js.debug) console.log(`getOptionFile::Successfully loaded companion option file: ${baseName}`);
        } catch (error) {
          if (msh3js.debug) console.warn(`getOptionFile::Could not read companion option file: ${baseName}`, error);
        }
      } else if (msh3js.debug) {
        console.log("getOptionFile::Companion option file not found:", baseName);
      }
    } catch (error) {
      console.error(`getOptionFile::Error checking for option file for ${mshPath}:`, error);
    }

    return optionFile;
  },

  // In a Tauri environment, this function loads the associated ODF for a cloth mesh and returns it's string contents.
  async _getClothODF(mshPath, odfName) {
    if (!msh3js.isTauri || !mshPath || !odfName) {
      return null;
    }
    if (msh3js.debug) console.log(`_getClothODF::Searching for ODF "${odfName}" for ${mshPath}`);

    let fsModule = msh3js._modules.tauriFs;
    if (!fsModule) {
      fsModule = await import('@tauri-apps/plugin-fs');
      msh3js._modules.tauriFs = fsModule;
    }

    let pathModule = msh3js._modules.tauriPath;
    if (!pathModule) {
      pathModule = await import('@tauri-apps/api/path');
      msh3js._modules.tauriPath = pathModule;
    }

    const { readTextFile, exists } = fsModule;
    const { join, dirname } = pathModule;

    try {
      const mshDir = await dirname(mshPath);
      let odfPath = null;

      // Define potential locations for the ODF file
      const pathInSameDir = await join(mshDir, `${odfName}.odf`);
      const pathInNeighboringDir = await join(await dirname(mshDir), 'odf', `${odfName}.odf`);

      if (await exists(pathInSameDir)) {
        odfPath = pathInSameDir;
      } else if (await exists(pathInNeighboringDir)) {
        odfPath = pathInNeighboringDir;
      }

      if (odfPath) {
        if (msh3js.debug) console.log(`_getClothODF::Found ODF at: ${odfPath}`);
        return await readTextFile(odfPath);
      } else if (msh3js.debug) {
        console.log(`_getClothODF::ODF file not found: ${odfName}.odf`);
      }
    } catch (error) {
      console.error(`_getClothODF::Error searching for ODF file for ${mshPath}:`, error);
    }

    return null;
  },

  // This function parses the ODF content to pull and return cloth ODF parameters
  _parseClothODF(content) {
    let windDirection = [];
    let windSpeed = null;
    let hardEdge = false;
    let transparent = false;

    if (content) {
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        // Remove comments from the line first
        const lineWithoutComment = line.split('//')[0];
        // Regex to match "key = value" format, ignoring case and spaces.
        const match = lineWithoutComment.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*"?([^"\n;]*)"?/i);
        if (match) {
          const key = match[1].toLowerCase();
          const value = match[2].trim();
          // Parse each cloth parameter value
          switch (key) {
            case 'winddirection':
              windDirection = value.split(/\s+/)
                .map(v => parseFloat(v))
                .filter(v => !isNaN(v))
                .slice(0, 2);
              break;
            case 'windspeed':
              windSpeed = parseFloat(value);
              break;
            case 'hardedge':
              hardEdge = value === '1';
              break;
            case 'transparent':
              transparent = value === '1';
              break;
          }
        }
      }
    }

    const clothParams = {
      windDirection, // Horizontal angle in degrees, vertical angle in degrees
      windSpeed,     // Float value of wind speed
      hardEdge,      // Either fully opaque or fully transparent
      transparent    // Interpreted as transparent by gradient
    };
    if (msh3js.debug) console.log("_parseClothODF: Cloth ODF parsed:", clothParams);

    return clothParams;
  },

  // Toggles the camera between perspective and orthographic views.
  _toggleCameraType() {
    if (!msh3js.three.camera || !msh3js.three.orbitControls) return;

    const oldCamera = msh3js.three.camera;
    let newCamera;

    if (oldCamera.isPerspectiveCamera) {
      if (msh3js.debug) console.log("toggleCameraType::Switching to Orthographic camera.");
      const distance = oldCamera.position.distanceTo(msh3js.three.orbitControls.target);
      const height = 2 * Math.tan(THREE.MathUtils.degToRad(oldCamera.fov) / 2) * distance;
      const width = height * oldCamera.aspect;

      newCamera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.01, oldCamera.far);
      newCamera.zoom = 1; // Start with a zoom of 1

    } else if (oldCamera.isOrthographicCamera) {
      if (msh3js.debug) console.log("toggleCameraType::Switching to Perspective camera.");
      newCamera = new THREE.PerspectiveCamera(75, oldCamera.aspect, 0.1, oldCamera.far);
      // Adjust zoom to maintain a similar view size. This is an approximation.
      newCamera.zoom = oldCamera.zoom;
    } else {
      return; // Unknown camera type
    }

    // Copy properties from the old camera to the new one
    newCamera.position.copy(oldCamera.position);
    newCamera.quaternion.copy(oldCamera.quaternion);
    newCamera.aspect = oldCamera.aspect;
    newCamera.name = "sceneCamera";
    newCamera.updateProjectionMatrix();

    // Update all necessary components to use the new camera
    msh3js.three.camera = newCamera;
    msh3js.three.orbitControls.object = newCamera;

    // Update post-processing passes
    if (msh3js.three.renderPass) {
      msh3js.three.renderPass.camera = newCamera;
    }
    if (msh3js.three.composer) {
      msh3js.three.composer.passes[0].camera = newCamera; // Assumes RenderPass is the first pass
    }
    if (msh3js.three.bloomComposer) {
      msh3js.three.bloomComposer.passes[0].camera = newCamera; // Assumes RenderPass is the first pass
    }

    if (msh3js.three.viewHelper) msh3js.three.viewHelper.camera = newCamera;
  },

  // Get files opened with webapp or Tauri
  async _getLaunchFiles() {
    // Get launch files and process them if present (for webapp)
    if (window.launchQueue && !msh3js.isTauri) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files && launchParams.files.length > 0) {
          const files = await Promise.all(launchParams.files.map(fh => fh.getFile()));
          if (msh3js.debug) console.log("getLaunchFiles::App launched with files:", launchParams.files);
          msh3js.addFiles(files);
          await msh3js.processFiles();
        }
      });
    }
    // Do the same for Tauri app
    if (msh3js.isTauri) {
      let eventModule = msh3js._modules.tauriEvent;
      let fsModule = msh3js._modules.tauriFs;

      if (!eventModule) {
        eventModule = await import('@tauri-apps/api/event');
        msh3js._modules.tauriEvent = eventModule;
        if (msh3js.debug) console.log("getLaunchFiles::Tauri event module loaded.");
      }
      if (!fsModule) {
        fsModule = await import('@tauri-apps/plugin-fs');
        msh3js._modules.tauriFs = fsModule;
        if (msh3js.debug) console.log("getLaunchFiles::Tauri fs module loaded.");
      }

      const { readFile, readTextFile } = fsModule;
      const { emit, listen } = eventModule;

      listen("open-file", async (event) => {
        const filePaths = event.payload;
        if (filePaths && filePaths.length > 0) {
          if (msh3js.debug) console.log("getLaunchFiles::Received launch files from Tauri:", filePaths);
          const filesToProcess = [];
          const mshPaths = [];
          for (const path of filePaths) {
            try {
              if (path.endsWith('.msh')) mshPaths.push(path);

              let content = null; // readFile or readTextFile
              if (path.endsWith('.option')) content = await readTextFile(path);
              else content = await readFile(path); // Ensure both are awaited

              const fileName = path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1);
              const file = new File([content], fileName, { type: 'application/octet-stream' });
              filesToProcess.push(file);
            } catch (error) {
              console.error(`getLaunchFiles::Error reading launch file in Tauri: ${path}`, error);
            }
          }
          if (filesToProcess.length > 0) {
            msh3js.addFiles(filesToProcess);
            await msh3js.processFiles();
            for (const path of mshPaths) {
              // Load option file of msh
              const optionFile = await msh3js._getOptionFile(path);
              if (optionFile) {
                msh3js.addFiles([optionFile]);
                await msh3js.processFiles(); // Possible bumpmap required texture added
              }
              // Load required textures of msh
              const mshData = msh3js.three.msh.find(msh => msh.fileName.toLowerCase() === path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1).toLowerCase());
              if (mshData) {
                const requiredTextures = await msh3js._getRequiredTextures(path, mshData.requiredTextures);
                if (requiredTextures.length > 0) {
                  msh3js.addFiles(requiredTextures);
                  await msh3js.processFiles();
                }
                // If msh with cloth models
                if (mshData.hasCloth) {
                  const clothMeshes = [];
                  // If model is cloth
                  mshData.group.traverse((child) => {
                    if (child.isMesh && child.userData.isCloth) {
                      clothMeshes.push(child);
                    }
                  });
                  if (clothMeshes.length > 0) {
                    const allClothParams = [];
                    for (const mesh of clothMeshes) {
                      // Get cloth ODF
                      const clothODF = await msh3js._getClothODF(path, mesh.name);
                      if (clothODF) {
                        const clothParams = msh3js._parseClothODF(clothODF);
                        if (clothParams.transparent) {
                          mesh.material.transparent = true;
                          if (msh3js.debug)
                            console.log(`_getLaunchFiles::Cloth mesh "${mesh.name}" flagged as transparent from ODF.`);
                        }
                        if (clothParams.hardEdge) {
                          mesh.material.transparent = false;
                          mesh.material.alphaTest = 0.5;
                          if (msh3js.debug)
                            console.log(`_getLaunchFiles::Cloth mesh "${mesh.name}" flagged as hard edge from ODF.`);
                        }
                        allClothParams.push(clothParams);
                      }
                    }
                    for (const params of allClothParams) {
                      if (params.windSpeed) {
                        msh3js.options.clothWindSpeed = params.windSpeed * 0.1;
                        if (msh3js.debug)
                          console.log(`_getLaunchFiles::Cloth wind speed set to ${msh3js.options.clothWindSpeed}.`);
                      }
                      if (params.windDirection.length > 0) {
                        msh3js.options.clothWindDirection = params.windDirection[0];
                        if (msh3js.debug)
                          console.log(`_getLaunchFiles::Cloth wind direction set to ${msh3js.options.clothWindDirection}.`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      // Inform Tauri that we're ready and listening
      emit("frontend-ready");
    }
  },

  // --- Draggable Handlers ---
  _draggableMouseOver(element, e) {
    const target = e.target;
    if (target.classList.contains('tp-rotv_t')) {
      target.style.cursor = 'grab';
    }
  },

  _draggableDragStart(element, e) {
    const target = e.target;
    if (!target.classList.contains('tp-rotv_t')) return;

    const point = e.touches ? e.touches[0] : e;
    const state = {
      isDragging: true,
      hasDragged: false,
      startPos: { x: point.clientX, y: point.clientY },
      offsetX: point.clientX - element.getBoundingClientRect().left,
      offsetY: point.clientY - element.getBoundingClientRect().top,
      dragThreshold: 5
    };
    msh3js._draggableStates.set(element, state);

    msh3js.manageListeners('add', 'dragMove', element);
    msh3js.manageListeners('add', 'dragClickCapture', element);
    target.style.cursor = 'grabbing';
  },

  _draggableDragMove(element, e) {
    const state = msh3js._draggableStates.get(element);
    if (!state?.isDragging) return;

    if (e.touches) e.preventDefault();

    const point = e.touches ? e.touches[0] : e;

    if (!state.hasDragged) {
      const dx = point.clientX - state.startPos.x;
      const dy = point.clientY - state.startPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > state.dragThreshold) {
        state.hasDragged = true;
      }
    }

    const parentRect = msh3js._appContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const newLeft = point.clientX - state.offsetX;
    const newTop = point.clientY - state.offsetY;

    element.style.left = `${Math.max(parentRect.left, Math.min(newLeft, parentRect.right - elementRect.width)) - parentRect.left}px`;
    element.style.top = `${Math.max(parentRect.top, Math.min(newTop, parentRect.bottom - elementRect.height)) - parentRect.top}px`;
  },

  _draggableDragEnd(element) {
    const state = msh3js._draggableStates.get(element);
    if (state) state.isDragging = false;

    msh3js.manageListeners('remove', 'dragMove', element);
    document.body.style.cursor = '';
  },

  // --- Resizable Handlers ---
  _resizableMouseMoveCursor(element, e) {
    const state = msh3js._resizableStates.get(element);
    if (state?.isResizing) return;

    const rect = element.getBoundingClientRect();
    const handleWidth = 8;
    if (e.clientX >= rect.right - handleWidth && e.clientX <= rect.right) {
      element.style.cursor = 'ew-resize';
    } else {
      element.style.cursor = ''; // Reset if not on the edge
    }
  },

  _resizableMouseDown(element, e) {
    if (element.style.cursor !== 'ew-resize') return;

    const state = {
      isResizing: true,
      startX: e.clientX,
      startWidth: element.offsetWidth,
      minWidth: 240,
    };
    msh3js._resizableStates.set(element, state);

    e.preventDefault();
    e.stopPropagation();

    msh3js.manageListeners('add', 'resizeMove', element);
  },

  _resizableMouseMove(element, e) {
    const state = msh3js._resizableStates.get(element);
    if (!state?.isResizing) return;

    const dx = e.clientX - state.startX;
    let newWidth = state.startWidth + dx;
    newWidth = Math.max(state.minWidth, newWidth);
    element.style.width = `${newWidth}px`;
  },

  _resizableMouseUp(element) {
    const state = msh3js._resizableStates.get(element);
    if (state) state.isResizing = false;

    msh3js.manageListeners('remove', 'resizeMove', element);
  },
};

export default msh3js;