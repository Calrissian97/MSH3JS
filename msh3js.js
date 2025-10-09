"use strict";
// msh3js.js - Main for msh3js msh model viewer
// (c) 2025 by Landon Hull aka Calrissian97
// This code is licensed under GPL 3.0

// Module Imports -----------------------------------------------------------
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MSHLoader } from "MSHLoader";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
// Note: The following will be imported dynamically instead
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

//import { ViewHelper } from "view-helper";
//import { Pane } from "tweakpane";
//import Stats from "stats-gl";
//import "webgl-lint";

// Global app object/namespace for application state and data
const msh3js = {
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
    dirLightAzimuth: 0.0, // Directional light azimuth (Rotation in degrees by Y axis)
    dirLightElevation: 0.0, // Directional light elevation (Rotation in degrees by X axis)
    dirLight2Color: "#ffffff",
    dirLight2Intensity: 0.0, // Disable secondary directional light by default
    dirLight2Azimuth: 0.0,
    dirLight2Elevation: 0.0,
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
    clothSim: true, // Enable cloth simulation
    clothWindSpeed: 2.0, // Wind speed for cloth simulation
    clothWindDirection: 280.0, // Wind direction in degrees (0-360)
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
    textureURLs: [],
  },
  // Debugging flag
  debug: true,
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
  // service worker
  _serviceWorker: null,
  // Dynamically Imported modules (ViewHelper, Stats, Tweakpane, webgl-lint)
  _modules: {},
  // Input files
  _files: {},
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
        const registration = await navigator.serviceWorker.register("/sw.js");
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
    //if (await msh3js.getLaunchFiles() === true) {
    //msh3js.processFiles(msh3js._files);
    //} else {
    // Create file input and display splashscreen
    msh3js.createFileInput();
    // -deprecated- msh3js.createSplashScreen();
    msh3js.manageListeners("add", "fileDropCanvas");
    // }
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
    msh3js._tweakpaneContainer.draggable = "true";
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
    if (options.dirLight2 !== null) params.dirLight2 = options.dirLight2;
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
    }
    if (params.dirLight != null) {
      // Set directional light color and intensity THREE MUST EXIST
      msh3js.three.dirLight.color.set(params.dirLight.color);
      msh3js.three.dirLight.intensity = params.dirLight.intensity;
    }
    if (params.dirLight2 != null) {
      // Set directional light color and intensity THREE MUST EXIST
      msh3js.three.dirLight2.color.set(params.dirLight2.color);
      msh3js.three.dirLight2.intensity = params.dirLight2.intensity;
    }
    // Optionally set up tweakpane and stats if needed
    if (params.displayTweakpane !== false) {
      await msh3js.initTweakpane(params.displayTweakpane);
    }
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
    const pane = new Pane({ title: "Controls", expanded: true }); // Main pane
    pane.registerPlugin(TweakpanePluginHtmlColorPicker);
    // Create the main tab layout for organizing controls.
    const tab = pane.addTab({
      pages: [
        // Tabs for orbitControls and app settings
        { title: "MSH" },
        { title: "Scene" },
        { title: "App" },
      ],
    });
    const mshTab = tab.pages[0];
    const controlsTab = tab.pages[1];
    const appSettingsTab = tab.pages[2];

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
      modelFolder.addBinding(model, "visible", { label: "Visible" });
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

      if (textureSlots.TX0D !== 'Unassigned') {
        const texturesFolder = materialFolder.addFolder({ title: "Textures", expanded: false });
        // List all assigned textures, add missing textures to the array
        for (const [label, textureName] of Object.entries(textureSlots)) {
          const lowerCaseTextureName = textureName.toLowerCase();
          const existingFile = msh3js._files[lowerCaseTextureName];
          if (!existingFile)
            msh3js.ui.missingTextures.push(lowerCaseTextureName);
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
    mshTab.addBlade({ view: "separator" });

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
      expanded: false,
    });
    bgFolder
      .addBinding(msh3js.options, "backgroundColor", {
        label: "Background Color",
        view: "html-color-picker",
      })
      .on("change", () => {
        msh3js.three.scene.background = new THREE.Color(
          msh3js.options.backgroundColor
        );
        if (msh3js.debug)
          console.log(
            "Background color set to:",
            msh3js.options.backgroundColor
          );
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

    const clothFolder = appSettingsTab.addFolder({
      title: "Cloth Simulation",
      expanded: true,
    });

    clothFolder.addBinding(msh3js.options, "clothSim", { label: "Enable Cloth Sim" }).on("change", () => {
        if (msh3js.options.clothSim) msh3js.initClothSimulations();
        else msh3js.resetClothSimulations();
        if (msh3js.debug)
          console.log("Cloth simulation set to:", msh3js.options.clothSim ? "on" : "off");
      });

    clothFolder.addBinding(msh3js.options, "clothWindSpeed", { label: "Wind Speed", min: 0, max: 10, step: 0.1 });
    clothFolder.addBinding(msh3js.options, "clothWindDirection", { label: "Wind Direction", min: 0, max: 360, step: 1 });

    // Button to save current app options to localStorage.
    const saveBtn = appSettingsTab.addButton({
      title: "Save",
      label: "Preferences:",
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
    const cacheBtn = appSettingsTab.addButton({
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

    // Assign the newly created pane to the global object.
    msh3js.pane = pane;
    if (msh3js.debug)
      console.log("initTweakpane::Tweakpane controls created:", pane);

    // Refresh the pane to ensure all bindings and visibility states are up-to-date.
    msh3js.pane.refresh();

    return pane;
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

    // Update scrolling textures
    if (msh3js.three.msh.length > 0) {
      for (const msh of msh3js.three.msh) {
        // Animate materials
        for (const material of msh.materials) {
          // Handle scrolling textures
          if (material.scrolling && material.three.map?.userData.scrollSpeedU) {
            material.three.map.offset.x += material.three.map.userData.scrollSpeedU * elapsedTime;
            material.three.map.offset.y += material.three.map.userData.scrollSpeedV * elapsedTime;
          }
          // Handle animated textures
          if (material.three.map?.userData.isAnimated) {
            const { gridSize, totalFrames, fps } = material.three.map.userData;
            const frameDuration = 1 / fps;
            const currentFrame = Math.floor((time / 1000) / frameDuration) % totalFrames;

            const row = Math.floor(currentFrame / gridSize);
            const col = currentFrame % gridSize;

            // The UVs are mapped to the first cell, so we just need to offset.
            material.three.map.offset.x = (col / gridSize);
            material.three.map.offset.y = -(row / gridSize); // Negative offset to move "down" the texture
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
      if ((lowerName.endsWith(".msh") || lowerName.endsWith(".tga")) && msh3js._files[lowerName] == null) {
        msh3js._files[lowerName] = {
          file: file,
          url: URL.createObjectURL(file),
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
    for (const fileObj of Object.values(msh3js._files)) {
      if (fileObj.file.name.toLowerCase().endsWith(".msh")) {
        // Load msh file with MSHLoader
        const mshScene = await msh3js.three.mshLoader.loadAsync(fileObj.url);
        if (msh3js.debug) console.log("processFiles::Loaded msh:", mshScene);
        // Populate three.msh with mshScene data
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
          }
        );
        // Add msh to Three scene
        msh3js.three.scene.add(mshScene);
        msh3js.frameCamera(mshScene);
        fileProcessed = true;
      }
    }
    // Check for textures and assign them to Three materials if required
    for (const fileObj of Object.values(msh3js._files)) {
      if (fileObj.file.name.toLowerCase().endsWith(".tga")) {
        // Ensure file is a required texture of a msh
        let required = false;
        for (const msh of msh3js.three.msh) {
          if (msh.requiredTextures.includes(fileObj.file.name.toLowerCase())) {
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
              msh.textures.push(ThreeTexture);
              // Assign textures to materials
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
                      if (msh3js.debug) console.log('processFiles::RGBA DataTexture constructed for specularMap from alpha channel.');

                    }

                    if (material.glow) {
                      material.three.emissive = new THREE.Color(0xffffff); // Use white to not tint the map
                      material.three.emissiveMap = ThreeTexture; // The texture itself provides the glow color
                    }

                    // If material is flagged as scrolling (DATA0-Horizontal speed, DATA1-Vertical speed, clone texture and have its offset adjusted in renderloop
                    if (material.scrolling) {
                      const scrollingTexture = ThreeTexture.clone();
                      scrollingTexture.wrapS = THREE.RepeatWrapping;
                      scrollingTexture.wrapT = THREE.RepeatWrapping;
                      // Store scroll speeds in userData. Speeds are often small, so we divide.
                      scrollingTexture.userData.scrollSpeedU = (material.matd.atrb.data0 || 0) / 255.0;
                      scrollingTexture.userData.scrollSpeedV = (material.matd.atrb.data1 || 0) / 255.0;
                      material.three.map = scrollingTexture;
                      if (msh3js.debug) console.log('processFiles::Scrolling RGBA DataTexture created by cloning diffuseMap for material:', material);
                    }

                    // If material is flagged as animated
                    if (material.matd.atrb.renderFlags.animated) {
                      const totalFrames = material.matd.atrb.data0 || 4; // Default to 4 frames if not specified
                      const fps = material.matd.atrb.data1 || 10; // Default to 10 fps

                      // The number of frames must be a perfect square.
                      const gridSize = Math.sqrt(totalFrames);
                      if (Math.floor(gridSize) !== gridSize) {
                        console.warn(`Animated texture for material "${material.name}" has ${totalFrames} frames, which is not a perfect square. Animation may not work correctly.`);
                      }

                      const animatedTexture = ThreeTexture.clone();
                      animatedTexture.wrapS = THREE.RepeatWrapping;
                      animatedTexture.wrapT = THREE.RepeatWrapping;
                      // Store animation data for the render loop
                      animatedTexture.userData.isAnimated = true;
                      animatedTexture.userData.gridSize = gridSize;
                      animatedTexture.userData.totalFrames = totalFrames;
                      animatedTexture.userData.fps = fps;
                      // Since UVs are mapped to the first cell, we only need to offset the texture.
                      // The repeat property should remain (1, 1).
                      material.three.map = animatedTexture;
                    }

                    // If material rendertype is energy/pulsate (DATA0- Minimum Brightness, DATA1- Blink Speed)
                    if (material.pulsate) {
                      const pulseSpeed = material.matd.atrb.data1 || 0;
                      if (pulseSpeed === 0) {
                        // A speed of 0 means it's always on at max brightness
                        material.three.userData.alwaysOn = true;
                        if (msh3js.debug) console.log('processFiles::Pulsating material configured (Always On):', material.name);
                      } else {
                        // Store pulsation parameters in userData for the render loop.
                        material.three.userData.minBrightness = (material.matd.atrb.data0 || 0) / 255.0;
                        material.three.userData.pulseSpeed = pulseSpeed;
                        if (msh3js.debug) console.log('processFiles::Pulsating material configured (Animated):', material.name);
                      }
                    }
                  }

                  // Handle tx1d (bump/normal map)
                  if (material.matd.tx1d && material.matd.tx1d.toLowerCase() === fileObj.file.name.toLowerCase()) {
                    if (material.matd.atrb && (material.matd.atrb.renderFlags.bumpmap || material.matd.atrb.renderFlags.bumpmapAndGlossmap)) {
                      if (msh3js.debug) console.log('msh3js::processFiles::Bumpmap/Normalmap texture found for material:', material.name);
                      // Infer if bumpmap or normalmap by filename
                      if (fileObj.file.name.toLowerCase().includes("bump")) {
                        ThreeTexture.colorSpace = THREE.LinearSRGBColorSpace;
                        material.three.bumpMap = ThreeTexture;
                        material.three.bumpScale = 0.1; // Default bump scale
                      } else if (fileObj.file.name.toLowerCase().includes("normal")) {
                        ThreeTexture.colorSpace = THREE.LinearSRGBColorSpace;
                        material.three.normalMap = ThreeTexture;
                        material.three.normalScale = new THREE.Vector2(0.33, 0.33);
                      }
                      material.three.needsUpdate = true;
                      msh.textures.push(ThreeTexture);
                    }
                  }

                  // Handle tx3d (cubemap)
                  // TODO
                  if (material.matd.tx3d && material.matd.tx3d.toLowerCase() === fileObj.file.name.toLowerCase()) {
                    if (material.chrome) {
                      if (msh3js.debug) console.log('msh3js::processFiles::Cubemap texture found for material:', material);
                      const cubeTexture = msh3js.convertCrossToCube(ThreeTexture);
                      material.three.envMap = cubeTexture;
                      material.three.needsUpdate = true;
                      msh.textures.push(ThreeTexture); // Keep original for reference
                    }
                  }
                }
              }
            } catch (error) {
              console.error("msh3js::processFiles::Error loading texture:", fileObj.file.name, "For material:", material, error);
            }
            required = true;
            fileProcessed = true;
          }
        }
        // If texture isn't required, delete from files array
        if (!required) {
          delete msh3js._files[fileObj.file.name.toLowerCase()];
        }
      }
    }
    // Cleanup URLs after loading is complete
    /*
    for (const fileObj of Object.values(msh3js._files)) {
      URL.revokeObjectURL(fileObj.url);
      fileObj.url = null;
    }
    */

    // Populate msh3js.ui elements w/msh data
    for (let material of msh3js.three.msh.at(-1).materials)
      msh3js.ui.materials.push(material);
    // Only actual mesh geometry is displayed
    msh3js.three.msh.at(-1).group.traverse((childObj) => {
      if (childObj.isMesh) msh3js.ui.models.push(childObj);
    });
    msh3js.ui.mshName = msh3js.three.msh.at(-1).fileName;
    msh3js.ui.mshSize = msh3js.three.msh.at(-1).fileSize;
    msh3js.ui.mshLastModified = new Date(msh3js.three.msh.at(-1).lastModified).toLocaleString();
    msh3js.ui.sceneName = msh3js.three.msh.at(-1).sceneInfo.name;
    // Reset missing textures array
    msh3js.ui.missingTextures = [];
    const missingTextureNames = new Set();
    // Check for missing textures
    for (const msh of msh3js.three.msh) {
      for (const requiredTexture of msh.requiredTextures) {
        const texture = requiredTexture.toLowerCase();
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

    // Hide meshes that aren't meant to be visible by default
    for (let model of msh3js.ui.models) {
      if (!model.geometry) {
        model.visible = false;
        if (model.userData.isShadowVolume === true) {
          if (msh3js.options.enableShadows === true) {
            // If a shadowvolume, have it cast shadows
            model.castShadow = true;
          }
        }
      } else {
        // For visible models allow recieving shadows
        if (msh3js.options.enableShadows === true) {
          model.recieveShadow = true;
          // If no shadowvolume, allow casting
          if (msh3js.three.msh.at(-1).hasShadowVolume !== true) {
            model.castShadow = true;
          }
        }
      }
    }

    // Reconstruct Tweakpane pane if already present
    if (msh3js.pane != null) await msh3js.initTweakpane(true);
    if (msh3js.debug) console.log("processFiles::Files processed:", msh3js._files);
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

  // Get launch fileHandles from launchQueue and populate msh3js.files
  async getLaunchFiles() {
    return new Promise((resolve) => {
      if ('launchQueue' in window) {
        window.launchQueue.setConsumer(async (launchParams) => {
          if (launchParams.files.length > 0) {
            const files = [];
            for (const fileHandle of launchParams.files) {
              try {
                const file = await fileHandle.getFile();
                if (msh3js.debug) console.log("getLaunchFiles::File", file.name, "loaded:", file);
                files.push(file);
              } catch (e) {
                console.error("getLaunchFiles::Error loading file:", e);
              }
            }
            msh3js.addFiles(files);
            resolve(true);
          }
          else {
            resolve(false);
          }
        });
      } else {
        resolve(false);
      }
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
    if (msh3js.three.msh.length > 0)
      msh3js.frameCamera(msh3js.three.msh.at(-1).group);
    if (msh3js.debug)
      console.log("recreateRenderer::Renderer recreated.");
  },

  // Create and assign Three.js scene
  createScene() {
    msh3js.three.scene = new THREE.Scene();
    msh3js.three.scene.background = new THREE.Color(msh3js.options.backgroundColor);

    // Add ambient light
    msh3js.three.ambLight = new THREE.AmbientLight(msh3js.options.ambLightColor, msh3js.options.ambLightIntensity);
    msh3js.three.scene.add(msh3js.three.ambLight);

    // Add directional light
    msh3js.three.dirLight = new THREE.DirectionalLight(msh3js.options.dirLightColor, msh3js.options.dirLightIntensity);
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
    msh3js.calculateLightPosition(msh3js.three.dirLight);
    msh3js.three.scene.add(msh3js.three.dirLight);
    msh3js.three.scene.add(msh3js.three.dirLight.target);
    // Add helper for directional light
    msh3js.three.dirLightHelper = new THREE.DirectionalLightHelper(msh3js.three.dirLight, 5);
    msh3js.three.dirLightHelper.visible = msh3js.options.enableDirLightHelper;
    msh3js.three.scene.add(msh3js.three.dirLightHelper);

    // Add directional light 2
    msh3js.three.dirLight2 = new THREE.DirectionalLight(0xaaaaff, 0.0);
    msh3js.three.dirLight2.castShadow = false;
    msh3js.three.dirLight2.position.set(-msh3js.three.dirLight.position.x, // Inverse direction of dirLight by default
      -msh3js.three.dirLight.position.y, -msh3js.three.dirLight.position.z);
    msh3js.three.dirLight2.target.position.set(0, 0, 0);
    msh3js.three.scene.add(msh3js.three.dirLight2);
    msh3js.three.scene.add(msh3js.three.dirLight2.target);

    // Add helper for directional light 2
    msh3js.three.dirLightHelper2 = new THREE.DirectionalLightHelper(msh3js.three.dirLight2, 5);
    msh3js.three.dirLightHelper2.visible = msh3js.options.enableDirLightHelper2;
    msh3js.three.scene.add(msh3js.three.dirLightHelper2);

    // Add grid helper
    msh3js.three.gridHelper = new THREE.GridHelper(10, 10);
    msh3js.three.gridHelper.visible = msh3js.options.enableGrid;
    msh3js.three.scene.add(msh3js.three.gridHelper);

    if (msh3js.debug) console.log("createScene::Scene created: ", msh3js.three.scene);
    return msh3js.three.scene;
  },

  // Calculate directional light positions
  calculateLightPosition(dirLight = null, azimuth = null, elevation = null) {
    // Directional light parameters
    dirLight = dirLight ?? msh3js.three.dirLight ?? msh3js.three.dirLight2 ?? null;
    azimuth = azimuth ?? msh3js.three.dirLightAzimuth ?? msh3js.three.dirLight2Azimuth ?? 45; // degrees
    elevation = elevation ?? msh3js.three.dirLightElevation ?? msh3js.three.dirLight2Elevation ?? 30; // degrees
    const bboxCenter = msh3js.three.msh.at(-1)?.sceneInfo?.center ?? [0, 0, 0];
    const center = new THREE.Vector3(bboxCenter[0], bboxCenter[1], bboxCenter[2]);
    const radius = msh3js.three.msh.at(-1)?.sceneInfo?.radius ?? 10;
    const distance = Math.max((radius ?? 10) + 1.0, 1.0); // ensures min 1 unit beyond radius
    // Convert to radians and calculate light position
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    const x = (distance * Math.sin(phi) * Math.cos(theta)) + center.x;
    const y = (distance * Math.cos(phi)) + center.y;
    const z = (distance * Math.sin(phi) * Math.sin(theta)) + center.z;
    // Set light positions if present
    if (dirLight != null) {
      dirLight.position.set(x, y, z);
      dirLight.target.position.copy(center);
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
      500 // far plane
    ); // Create a new Three.JS camera
    msh3js.three.camera.position.set(0, 1, 5); // Set camera position
    if (msh3js.debug) console.log("createCamera::Camera created: ", msh3js.three.camera);
    return msh3js.three.camera;
  },

  // Frame camera to fit an object's bounding box
  // TODO: reverse depth threshold
  frameCamera(obj = null, margin = 1.0) {
    if (!msh3js.three.camera) msh3js.createCamera();
    let target;
    if (obj instanceof THREE.Box3) {
      target = obj.clone();
    } else if (obj instanceof THREE.Object3D) {
      target = new THREE.Box3().setFromObject(obj, true); // The 'true' flag considers only visible objects
    } else {
      console.warn("frameCamera::Invalid object type. Expected Box3 or Object3D.");
      return false;
    }
    if (target.isEmpty()) {
      console.warn("frameCamera::Object is empty. Cannot frame camera.");
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

    // Dynamically adjust near and far planes
    msh3js.three.camera.near = Math.max(0.1, radius / 100);
    msh3js.three.camera.far = radius * 4; // Ensure far plane is well beyond the object

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
    if (msh3js.debug) console.log("frameCamera::Camera framed to object: ", obj);
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
      if (msh3js.debug)
        console.log(
          "LoadingManager::In progress:",
          url,
          " : " + loaded + " / " + total
        );
    };
    msh3js.three.loadingManager.onLoad = function () {
      if (msh3js.debug)
        console.log("LoadingManager::Finished!");
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
      fileInput.accept = ".msh,.tga";
      msh3js._appContainer.appendChild(fileInput);
      msh3js._fileInput = fileInput;
      msh3js.manageListeners("add", "fileInput");

    } catch (e) { console.error("createFileInput::Error creating file input:", e); }
    if (msh3js.debug)
      console.log("createFileInput::File input created: ", fileInput);
    return fileInput;
  },

  // Create splash to direct user
  /* -deprecated-
  createSplashScreen() {
    if (msh3js.splashScreen != null) return msh3js.splashScreen;
    try {
      // Create SVG element
      msh3js.splashScreen = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      msh3js.splashScreen.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      msh3js.splashScreen.setAttribute("width", msh3js.size.width + "px");
      msh3js.splashScreen.setAttribute("height", msh3js.size.height + "px");
      msh3js.splashScreen.id = "splashScreen";
      msh3js.splashScreen.style.cursor = "pointer";
      msh3js.splashScreen.style.zIndex = "2";
      msh3js.splashScreen.style.backgroundColor = "#000000CC";
      msh3js.splashScreen.style.position = "absolute";
      msh3js.splashScreen.style.top = "0";
      msh3js.splashScreen.style.left = "0";

      // Create text element
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("id", "splashText");
      text.setAttribute("x", "50%");
      text.setAttribute("y", "50%");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("font-family", "system-ui");
      text.setAttribute("font-size", "14pt");
      text.setAttribute("fill", "#F8F8F8");
      text.textContent = "Drag and Drop or Click here\nto select a .msh file";
      msh3js.splashScreen.appendChild(text);
      // Append SVG to _appContainer
      msh3js._appContainer.appendChild(msh3js.splashScreen);
    } catch (e) {
      console.error("createSplashScreen::Error creating splash screen:", e);
      msh3js.splashScreen = null;
      return null;
    }
    if (msh3js.debug)
      console.log("createSplashScreen::Splash screen created and appended to DOM: ", msh3js.splashScreen);
    return msh3js.splashScreen;
  },
  */

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
            for (const cloth of model.modl.geom.cloth) {
              if (clothMesh.name.includes(cloth.name)) {
                clothData = cloth;
                break;
              }
            }
          }
          if (clothData) break;
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
      if (particle.fixed) continue;

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
};

export default msh3js;
