"use strict";
// mshLoader.js - Loads a binary msh file into Three.js
// (c) 2025 by Landon Hull aka Calrissian97
// This code is licensed under GPL 3.0

import * as THREE from "three";

/**
 * MSHLoader is a THREE.js loader for the ".msh" binary file format,
 * used in games like Star Wars: Clone Wars, Star Wars: Battlefront I/II (2005) 
 * by Pandemic Studios as an intermediate 3D model format.
 * It parses the file's geometry, materials, textures, skeleton, and animations.
 */
export class MSHLoader extends THREE.Loader {
    constructor(manager) {
        // The manager handles the loading of all assets.
        if (!manager) throw new Error("THREE.MSHLoader: Manager is undefined.");
        super(manager);
        // Properties to store the parsed data from the MSH file.
        this.sceneInfo = null;
        this.models = null;
        this.materials = null;
        this.textures = null;
        this.animations = null;
        this.keyframes = null;
        // Globals for file reading operations.
        this.buffer = null;
        this.byteOffset = null;
        this.debug = true;
    }

    // Cleans up and resets the loader's state.
    destroy() {
        this.buffer = null;
        this.byteOffset = null;
        this.sceneInfo = null;
        this.models = null;
        this.materials = null;
        this.textures = null;
        this.animations = null;
        this.keyframes = null;
    }

    /**
     * Loads a .msh file from a URL using callbacks.
     * @param {string} url - The URL of the .msh file.
     * @param {function} onLoad - Callback for when loading is complete.
     * @param {function} onProgress - Callback for loading progress.
     * @param {function} onError - Callback for loading errors.
     */
    load(url, onLoad, onProgress, onError) {
        const scope = this;
        const manager = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;
        // Use the internal _setupLoader to get a configured FileLoader.
        this._setupLoader(manager).load(url, function (arrayBuffer) {
            try {
                // Once the file is loaded, parse its content.
                const scene = scope.parse(arrayBuffer, url);
                if (onLoad) onLoad(scene);
                if (scope.debug) console.log("File" + url + "parsed.");
            } catch (e) {
                if (onError) onError(e);
                else // Log error with parsing
                    console.error("Error parsing msh:", e);
                manager.itemError(url); // Register error with manager
            }
        }, onProgress, onError);
    }

    /**
     * Loads a .msh file from a URL asynchronously using Promises.
     * @param {string} url - The URL of the .msh file.
     * @param {function} onProgress - Callback for loading progress.
     * @returns {Promise<THREE.Group>} A promise that resolves with the loaded scene.
     */
    async loadAsync(url, onProgress) {
        const scope = this; // Store scope for resolving
        // Initialize manager for file loading
        const manager = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;
        // Setup the loader with manager
        const loader = this._setupLoader(manager);
        return new Promise((resolve, reject) => {
            loader.load(
                url,
                // On successful file load, parse the data.
                (data) => {
                    try {
                        // Resolve to the parsed msh as a THREE.Scene
                        resolve(scope.parse(data, url));
                        if (scope.debug) console.log("File" + url + "parsed.");
                    } catch (e) {
                        reject(e); // Reject if errors encountered, log error
                        console.error("Error parsing msh:", e);
                        manager.itemError(url);
                    }
                },
                onProgress,
                (error) => { // This is the onError callback for the underlying FileLoader.
                    reject(error); // Reject if FileLoader fails and log error
                    console.error("Error loading file", url + ":", error);
                }
            );
        });
    }

    // Sets the base path for the loader.
    setPath(path) {
        super.setPath(path); return this;
    }

    /**
     * The main parsing function. It takes the raw file data (ArrayBuffer)
     * and orchestrates the process of reading chunks, creating THREE.js objects,
     * and assembling the final scene.
     * @param {ArrayBuffer} arrayBuffer - The raw binary data of the .msh file.
     * @returns {THREE.Group} The fully constructed scene as a THREE.Group.
     */
    parse(arrayBuffer, url) {
        try {
            // Reset and initialize properties for the new file.
            this.buffer = new DataView(arrayBuffer);
            this.byteOffset = 0;
            this.models = [];
            this.materials = [];
            this.textures = new Set();
            this.animations = [];
            this.keyframes = [];
            // Log errors with initializing properties.
        } catch (error) { console.error("parse::Error initializing MSHLoader:", error); }

        // This THREE.Group will be the root object for the loaded model.
        const scene = new THREE.Group();

        // Read the main data chunks from the file buffer.
        this.sceneInfo = this._readSceneInfo(this.buffer);  // SINF chunk
        this.materials = this._readMaterials(this.buffer);  // MATL chunk
        this.models = this._readGeometries(this.buffer);    // MODL chunk(s)
        const animData = this._readAnimations(this.buffer); // ANM2 chunk
        if (animData) { // If ANM2 chunk present, record animations and keyframes.
            this.animations = animData.animations;
            this.keyframes = animData.keyframes;
        }
        // Store all unique texture names referenced.
        this.textures = Array.from(this.textures);
        // Store set of bone names
        let boneNames = new Set();

        // Prioritize finding bones from skinning data (ENVL chunks) as it's the most reliable source.
        for (const model of this.models) {
            if (model.name.toLowerCase().startsWith("bone")) {
                boneNames.add(model.name);
                continue;
            }
            const boneMndxArray = model.modl.geom?.envelope?.indices;
            if (boneMndxArray) {
                const boneModels = this.models.filter(m => boneMndxArray.includes(m.modl.mndx));
                boneModels.forEach(m => boneNames.add(m.name));
            }
        }

        // Log all parsed data for debugging purposes.
        if (this.debug) {
            console.log("parse::MSH file data read.")
            console.log("parse::Scene info:", this.sceneInfo);
            console.log("parse::Materials:", this.materials);
            console.log("parse::Textures:", this.textures);
            console.log("parse::Models:", this.models);
            console.log("parse::Animations:", this.animations);
            console.log("parse::Keyframes:", this.keyframes);
            console.log("parse::Bones:", boneNames);
        }

        // --- Step 1: Construct THREE Materials ---
        // Iterate through the raw material data and create THREE.MeshPhongMaterial objects
        // inside of this.materials[x].three.
        for (let material of this.materials) {
            let transparent = false, specular = false, specColor = null, diffColor = null;
            if (material.matd.atrb != null) {
                // Check material flags to determine properties like transparency and specularity.
                if (material.matd.atrb.bitFlags.singleTransparent || material.matd.atrb.bitFlags.doubleTransparent ||
                    material.matd.atrb.bitFlags.additiveTransparent || material.matd.atrb.bitFlags.hardEdgedTransparent ||
                    material.matd.atrb.renderFlags.ice || material.matd.atrb.renderFlags.refracted) {
                    transparent = true;
                    material.transparent = true;
                }
                if (material.matd.atrb.bitFlags.specular || material.matd.atrb.renderFlags.specular ||
                    material.matd.atrb.renderFlags.glossmap || material.matd.atrb.renderFlags.emboss ||
                    material.matd.atrb.renderFlags.ice || material.matd.atrb.renderFlags.bumpmapAndGlossmap) {
                    specular = true;
                    material.specular = true;
                    // Colors are stored in BGRA format, convert to conventional RGB.
                    specColor = new THREE.Color(material.matd.specularColor[2], material.matd.specularColor[1], material.matd.specularColor[0]);
                }
                // Check material flags and add our own flags for these conditions (glowing, scrolling, etc).
                if (material.matd.atrb.bitFlags.glow || material.matd.atrb.bitFlags.emissive || material.matd.atrb.renderFlags.glow)
                    material.glow = true;
                if (material.matd.atrb.renderFlags.scrolling || material.matd.atrb.renderFlags.glowScroll)
                    material.scrolling = true;
                if (material.matd.atrb.renderFlags.pulsate)
                    material.pulsate = true;
                if (material.matd.atrb.renderFlags.chrome)
                    material.chrome = true;
            }
            // Set the diffuse color, swapping R and B to convert BGRA format msh files use to conventional RGB.
            diffColor = new THREE.Color(material.matd.diffuseColor[2], material.matd.diffuseColor[1], material.matd.diffuseColor[0]);
            // Create the final THREE material with all the determined properties.
            const threeMaterial = new THREE.MeshPhongMaterial({
                name: material.name,
                color: diffColor,
                specular: specular ? specColor : "#ffffff",
                shininess: specular ? material.matd.shininess : 0,
                transparent: transparent,
                side: material.matd.atrb.bitFlags.doubleTransparent ? THREE.DoubleSide : THREE.FrontSide,
                alphaTest: material.matd.atrb.bitFlags.hardEdgedTransparent ? 0.5 : 0,
                forceSinglePass: material.matd.atrb.bitFlags.singleTransparent,
                blending: material.matd.atrb.bitFlags.additiveTransparent ? THREE.AdditiveBlending : THREE.NormalBlending,
                dithering: true,
                wireframe: true,
            });
            // Store the created THREE material in our material data object.
            material.three = threeMaterial;
        }
        if (this.debug) console.log("parse::THREE Materials constructed:", this.materials);

        // --- Step 2: Construct THREE Meshes, Bones, and other Objects ---
        // This map will help us quickly find parent models by name when building the hierarchy.
        const modelsMap = new Map();
        const allBones = []; // Array to hold all THREE.Bone objects.
        // Iterate through all the raw model data.
        for (let model of this.models) {
            // If this model's name was found in boneNames, create as a bone.
            if (boneNames.has(model.name)) {
                const bone = new THREE.Bone();
                bone.name = model.name;
                model.three = bone;
                allBones.push(bone);
                // Apply the initial (bind pose) transformation from the file.
                bone.position.set(model.modl.tran.translation[0], model.modl.tran.translation[1], model.modl.tran.translation[2]);
                bone.quaternion.set(model.modl.tran.rotation[0], model.modl.tran.rotation[1], model.modl.tran.rotation[2], model.modl.tran.rotation[3]);
                modelsMap.set(model.name.toLowerCase(), model);
                continue; // Skip to the next model
            }

            // If the model is a hardpoint, create it as an Object3D and ignore its geometry.
            if (model.name.toLowerCase().startsWith("hp")) {
                const hardpoint = new THREE.Object3D();
                hardpoint.name = model.name;
                model.three = hardpoint;
                hardpoint.position.set(model.modl.tran.translation[0], model.modl.tran.translation[1], model.modl.tran.translation[2]);
                hardpoint.quaternion.set(model.modl.tran.rotation[0], model.modl.tran.rotation[1], model.modl.tran.rotation[2], model.modl.tran.rotation[3]);
                modelsMap.set(model.name.toLowerCase(), model);
                continue; // Skip to the next model
            }

            // Infer visibility based on Pandemic Studios' naming conventions.
            if (model.name.toLowerCase().startsWith("sv_") || model.name.toLowerCase().startsWith("shadowvolume") || model.name.toLowerCase().endsWith("shadowvolume") ||
                model.name.toLowerCase().startsWith("collision") || model.name.toLowerCase().endsWith("collision") || model.name.toLowerCase().startsWith("p_") ||
                model.name.toLowerCase().endsWith("_lowrez") || model.name.toLowerCase().endsWith("_lowres") || model.name.toLowerCase().endsWith("_lod2") ||
                model.name.toLowerCase().endsWith("_lod3") || model.name.toLowerCase().startsWith("c_"))
                model.modl.flgs = 1;
            // Otherwise override flgs and assign it the visible value (0).
            else
                model.modl.flgs = 0;

            // If the model has a GEOM chunk, create buffer geometry
            if (model.modl.geom) {
                let mesh = null;
                // Create buffer geometry from SEGM chunks
                if (model.modl.geom.segments.length > 0) {
                    // We will merge all geometry segments from this model into a single BufferGeometry.
                    const mergedPositions = []; // All vertex positions for this model.
                    const mergedNormals = [];   // All vertex normals.
                    const mergedUVs = [];       // All UVs.
                    const mergedColors = [];    // All vertex colors.
                    const mergedTris = [];      // All triangles.
                    const geometryGroups = [];  // All geometry-material pairs.
                    let vertexOffset = 0;       // Running total of vertices.
                    let indexOffset = 0;        // Running total of indices.

                    // Loop through segments appending attributes to merged lists.
                    for (let segment of model.modl.geom.segments) {
                        if (segment.posl.vertices) // If geometry segment has vertices add them.
                            mergedPositions.push(...segment.posl.vertices);

                        if (segment.nrml.normals) // If geometry segment has normals add them.
                            mergedNormals.push(...segment.nrml.normals);

                        if (segment.uv0l.uvs) // If geometry segment has UVs add them.
                            mergedUVs.push(...segment.uv0l.uvs);

                        // Handle per-vertex colors (CLRL chunk) if present.
                        if (segment.clrl.colors) { // Flag assigned material for vertex colors present.
                            this.materials[segment.mati].three.vertexColors = true;
                            // Colors are stored as BGRA (0-255), so convert to RGBA (0.0-1.0) for THREE.
                            const bgra = segment.clrl.colors;
                            const rgba = new Float32Array(bgra.length);
                            for (let i = 0; i < bgra.length; i += 4) {
                                rgba[i] = bgra[i + 2] / 255.0;     // R <- B
                                rgba[i + 1] = bgra[i + 1] / 255.0; // G
                                rgba[i + 2] = bgra[i] / 255.0;     // B <- R
                                rgba[i + 3] = bgra[i + 3] / 255.0; // A
                            }
                            // Add this segment's vertex colors.
                            mergedColors.push(...rgba);
                            // Handle single color for the whole segment (CLRB chunk) if present.
                        } else if (segment.clrb.color) {
                            // Colors are stored as BGRA (0-255), so convert to RGBA (0.0-1.0) for THREE.
                            const bgra = segment.clrb.color;
                            const vertexCount = segment.posl.vertexCount;
                            if (vertexCount > 0) {
                                // Flag assigned material for vertex colors present.
                                this.materials[segment.mati].three.vertexColors = true;
                                const rgba = new Float32Array(vertexCount * 4);
                                for (let i = 0; i < vertexCount; i++) {
                                    rgba[i * 4] = bgra[2] / 255.0;     // R <- B
                                    rgba[i * 4 + 1] = bgra[1] / 255.0; // G
                                    rgba[i * 4 + 2] = bgra[0] / 255.0; // B <- R
                                    rgba[i * 4 + 3] = bgra[3] / 255.0; // A
                                }
                                // Add this segment's expanded vertex color.
                                mergedColors.push(...rgba);
                            }
                        }
                        // Process indices from NDXT chunks which contain triangles (CCW winding).
                        let trianglesCCW = [];
                        if (segment.ndxt.trianglesCCW) {
                            // If NDXT chunk present, add each triangle for this segment to the geometry's total list.
                            for (let i = 0; i <= segment.ndxt.trianglesCCW.length - 3; i += 3)
                                trianglesCCW.push(segment.ndxt.trianglesCCW[i], segment.ndxt.trianglesCCW[i + 1], segment.ndxt.trianglesCCW[i + 2]);
                        }
                        // STRP chunks contain triangle strips, which need to be unrolled into a list of triangles.
                        if (segment.strp.triangleStrips) {
                            // Unroll triangle strips into a single list of triangles (CCW winding) if STRP chunk is present.
                            segment.strp.trianglesCCW = [];
                            for (const strip of segment.strp.triangleStrips) {
                                let indices = Array.from(strip);
                                if (indices.length < 3) continue; // Less than three indices indicates the end of a single strip.
                                // Add CCW triangles to this segment's list.
                                for (let i = 0; i <= indices.length - 3; i++) {
                                    if (i % 2 === 0) { // Triangle strips alternate winding between clockwise and counter-clockwise.
                                        segment.strp.trianglesCCW.push(indices[i], indices[i + 1], indices[i + 2]);
                                    } else {
                                        segment.strp.trianglesCCW.push(indices[i], indices[i + 2], indices[i + 1]);
                                    }
                                }
                            }
                            // Add this segment's list of CCW triangles to this geometry's total list.
                            for (let i = 0; i <= segment.strp.trianglesCCW.length - 3; i += 3)
                                trianglesCCW.push(segment.strp.trianglesCCW[i], segment.strp.trianglesCCW[i + 1], segment.strp.trianglesCCW[i + 2]);
                        }
                        // NDXL chunks contain polygons (quads), which need to be triangulated for THREE.
                        if (segment.ndxl.polygons) {
                            // A simple fan triangulation algorithm for convex polygons.
                            segment.ndxl.trianglesCCW = [];
                            for (const polygon of segment.ndxl.polygons) {
                                if (polygon.length < 3) continue; // Polygon must have at least three points.
                                const v0 = polygon[0]; // Starting vertex.
                                // Add three points of the polygon to this segment's triangle list.
                                for (let i = 1; i < polygon.length - 1; i++)
                                    segment.ndxl.trianglesCCW.push(v0, polygon[i], polygon[i + 1]);
                            }
                            // Add this segment's list of CCW triangles to this geometry's total list.
                            for (let i = 0; i <= segment.ndxl.trianglesCCW.length - 3; i += 3)
                                trianglesCCW.push(segment.ndxl.trianglesCCW[i], segment.ndxl.trianglesCCW[i + 1], segment.ndxl.trianglesCCW[i + 2]);
                        }
                        // Append the segment's final triangle indices to the merged list, adjusting for the current vertex offset.
                        if (trianglesCCW.length > 0)
                            for (let index of trianglesCCW)
                                mergedTris.push(index + vertexOffset);

                        // Record a geometry group for this segment. This tells THREE.js which part of the geometry uses which material.
                        geometryGroups.push({
                            start: indexOffset,          // Each segment starts at a different position.
                            count: trianglesCCW.length,  // Length of indices for this segment.
                            materialIndex: segment.mati, // Index of material assigned to this segment.
                        });

                        // Increment offsets for next segment.
                        indexOffset += trianglesCCW.length;
                        vertexOffset += segment.posl.vertexCount;
                    }

                    // Now that all segments are processesd, create the final BufferGeometry for this model.
                    const geometry = new THREE.BufferGeometry();
                    // Set the merged attributes from the segments' positions, normals, uvs, colors if present.
                    if (mergedPositions.length > 0)
                        geometry.setAttribute("position", new THREE.Float32BufferAttribute(mergedPositions, 3));
                    if (mergedNormals.length > 0)
                        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mergedNormals, 3));
                    if (mergedUVs.length > 0)
                        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mergedUVs, 2));
                    if (mergedColors.length > 0)
                        geometry.setAttribute("color", new THREE.Float32BufferAttribute(mergedColors, 4));
                    // Set the final merged triangles index list for this model's geometry.
                    if (mergedTris.length > 0 && mergedPositions.length > 0)
                        geometry.setIndex(new THREE.Uint16BufferAttribute(mergedTris, 1));

                    // This array will hold the THREE materials that are used by this mesh.
                    const assignedMaterials = [];
                    // This map tracks the original material index (mati) to its new local index in `assignedMaterials`.
                    const matiMap = new Map();
                    // Add the geometry groups and build the final material array for this mesh.
                    for (let group of geometryGroups) {
                        const mati = group.materialIndex;
                        let localMati = 0;
                        // If we've already added this material, just get its local index.
                        if (matiMap.has(mati)) {
                            localMati = matiMap.get(mati);
                        } else {
                            // Add material to assignedMaterials and map the mati to it's local mati in `assignedMaterials`.
                            const material = this.materials[mati].three;
                            assignedMaterials.push(material);
                            localMati = assignedMaterials.length - 1;
                            matiMap.set(mati, localMati);
                        }
                        // Add this segment-material group to the model's total geometry
                        geometry.addGroup(group.start, group.count, localMati);
                    }

                    // --- Skinned Mesh (from SEGM buffer geometry) ---
                    if (model.modl.geom.envelope && model.modl.geom.envelope.indices) {
                        // The WGHT chunk contains indices that point into the ENVL chunk's list of bone model indices (mndx).
                        // We need to build the final skinIndex and skinWeight attributes by merging all segments.
                        const envlBoneMndx = model.modl.geom.envelope.indices;
                        const finalSkinIndices = [];
                        const finalSkinWeights = [];

                        for (const segment of model.modl.geom.segments) {
                            if (segment.wght && segment.wght.indices && segment.wght.weights) {
                                for (let i = 0; i < segment.wght.indices.length; i++) {
                                    // The index from WGHT points to a bone's mndx in the ENVL array.
                                    const envlIndex = segment.wght.indices[i];
                                    const boneMndx = envlBoneMndx[envlIndex];
                                    finalSkinIndices.push(boneMndx);
                                }
                                finalSkinWeights.push(...segment.wght.weights);
                            }
                            else {
                                // If a segment in a skinned mesh has no WGHT chunk, we must pad the skinning attributes with zeros
                                // to prevent buffer length mismatches and NaN errors.
                                const vertexCount = segment.posl.vertexCount;
                                finalSkinIndices.push(...new Array(vertexCount * 4).fill(0));
                                finalSkinWeights.push(...new Array(vertexCount * 4).fill(0));
                            }
                        }

                        // Add the skinning attributes required by THREE.SkinnedMesh.
                        // The skinIndex is initially populated with the bone's model index (mndx).
                        // It will be remapped to the final skeleton bone index later.
                        geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(finalSkinIndices, 4));
                        geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(finalSkinWeights, 4));
                        mesh = new THREE.SkinnedMesh(geometry, assignedMaterials);
                        mesh.name = model.name; // Give THREE mesh the model's name.

                        // If vertex colors were found, add a flag to the mesh's userData for later detection.
                        if (mesh.geometry.attributes.color != null && mesh.geometry.attributes.color.count > 0)
                            mesh.userData.hasVertexColors = true;

                        model.three = mesh; // Add THREE SkinnedMesh to model.three.
                    }

                    // --- Standard Mesh (from SEGM chunks) ---
                    else {
                        // Create a standard multi-material mesh.
                        mesh = new THREE.Mesh(geometry, assignedMaterials);
                        mesh.name = model.name; // Give THREE mesh the model's name.

                        // If vertex colors were found, add a flag to the mesh's userData for later detection.
                        if (mesh.geometry.attributes.color != null && mesh.geometry.attributes.color.count > 0)
                            mesh.userData.hasVertexColors = true;

                        model.three = mesh; // Add THREE Mesh to model.three.
                    }
                }

                // --- Cloth Mesh (from CLTH chunk) ---
                else if (model.modl.geom.cloth) {
                    const cloth = model.modl.geom.cloth;
                    const clothGeometry = new THREE.BufferGeometry();

                    if (cloth.cpos.vertices) {
                        clothGeometry.setAttribute("position", new THREE.Float32BufferAttribute(cloth.cpos.vertices, 3));
                        const vertexCount = cloth.cpos.vertices.length / 3;
                        const colors = new Float32Array(vertexCount * 4);
                        colors.fill(1.0);
                        clothGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
                        clothGeometry.computeVertexNormals();
                    }

                    if (cloth.cuv0.uvs)
                        clothGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(cloth.cuv0.uvs, 2));

                    if (cloth.cmsh.trianglesCCW)
                        clothGeometry.setIndex(new THREE.Uint32BufferAttribute(cloth.cmsh.trianglesCCW, 1));

                    const clothMat = new THREE.MeshPhongMaterial({
                        name: "clothMaterial_" + cloth.name,
                        shininess: 0.0,
                        transparent: true,
                        side: THREE.DoubleSide,
                        wireframe: true,
                        vertexColors: true,
                    });
                    const material = { name: "clothMaterial_" + cloth.name, three: clothMat, texture: cloth.ctex };
                    this.materials.push(material);

                    // Create cloth as a standard Mesh.
                    mesh = new THREE.Mesh(clothGeometry, clothMat);
                    mesh.name = cloth.name;
                    mesh.userData.isCloth = true;
                    model.three = mesh;
                }
            }

            // --- Object3D (No geometry) ---
            else {
                model.three = new THREE.Object3D;
                model.three.name = model.name;
            }
            // Apply the model's initial transformation. (Scale is typically ignored in-game).
            model.three.position.set(model.modl.tran.translation[0], model.modl.tran.translation[1], model.modl.tran.translation[2]);
            model.three.quaternion.set(model.modl.tran.rotation[0], model.modl.tran.rotation[1], model.modl.tran.rotation[2], model.modl.tran.rotation[3]);
            //model.three.scale.set(scales[0], scales[1], scales[2]);
            modelsMap.set(model.name.toLowerCase(), model); // Add model to set by model name.
            model.three.visible = model.modl.flgs === 0;    // Adjust visibility based on flgs.
        }
        if (this.debug) console.log("parse::THREE Meshes constructed:", this.models);

        // --- Step 3: Assemble the Scene Hierarchy ---
        // Now that all objects are created, parent them correctly.
        for (let model of this.models) {
            if (model.modl.prnt) {
                const parent = modelsMap.get(model.modl.prnt.toLowerCase());
                if (parent) {
                    parent.three.add(model.three);
                }
                else
                    console.error("parse::Parent model not found for model:", model.name);
            } else {
                // If a model has no parent, it's a root object and should be added directly to the scene.
                // This includes root bones, which are necessary for the SkinnedMesh to be part of the scene graph.
                scene.add(model.three);
            }
            // If model is a cloth, add flag to scene userData.
            if (model.modl.geom && model.modl.geom.cloth) scene.userData.hasCloth = true;
            // If model is a shadowvolume, add flag to scene userData.
            if (model.three.userData.isShadowVolume) scene.userData.hasShadowVolume = true;
            // If model has vertex colors, add flag to scene userData.
            if (model.three.userData.hasVertexColors) scene.userData.hasVertexColors = true;
        }
        if (this.debug) console.log("parse::Scene hierarchy assembled.");

        // --- Step 4: Create and Bind the Skeleton ---
        // If any bones were created, we can now build the skeleton.
        if (allBones.length > 0) {
            scene.updateMatrixWorld(true); // Matrix MUST be updated before creating skelly
            // Create a single skeleton from the flat list of all bones. The hierarchy is already set up.
            const skeleton = new THREE.Skeleton(allBones);
            if (this.debug) console.log("parse::Skeleton created:", skeleton);

            // Create a map from a bone's model index (mndx) to its final index in the skeleton.
            const boneMndxToSkeletonIndex = new Map();
            for (let i = 0; i < skeleton.bones.length; i++) {
                const boneName = skeleton.bones[i].name.toLowerCase();
                const model = modelsMap.get(boneName);
                if (model) {
                    boneMndxToSkeletonIndex.set(model.modl.mndx, i);
                }
            }

            // Find all SkinnedMeshes and bind the skeleton to them.
            for (const model of this.models) {
                if (model.three.isSkinnedMesh) {
                    // Remap the skinIndex attribute from the initial mndx to the final skeleton bone index.
                    const skinIndexAttribute = model.three.geometry.getAttribute('skinIndex');
                    if (skinIndexAttribute) {
                        for (let i = 0; i < skinIndexAttribute.array.length; i++) {
                            const mndx = skinIndexAttribute.array[i];
                            skinIndexAttribute.array[i] = boneMndxToSkeletonIndex.get(mndx) ?? 0; // Default to bone 0 if not found
                        }
                    }
                    model.three.bind(skeleton, model.three.matrixWorld); // Matrix MUST be included to calculate inverse matrices
                }
            }
        }
        if (this.debug) console.log("parse::Skeleton bound to SkinnedMeshes.");

        // --- Step 5: Create AnimationClips ---
        // Convert the raw animation data into THREE.AnimationClip objects.
        const animationClips = [];
        for (const anim of this.animations) {
            const tracks = [];
            // For each bone's keyframe data...
            for (const kf of this.keyframes) {
                const bone = scene.getObjectByName(kf.bone);
                if (!bone) continue;
 
                // Filter and sort translation keyframes for the current animation.
                const relevantTranslations = kf.translations
                    .filter(t => t.frame >= anim.firstFrame && t.frame <= anim.lastFrame)
                    .sort((a, b) => a.frame - b.frame);
 
                if (relevantTranslations.length > 0) {
                    const posTimes = relevantTranslations.map(t => (t.frame - anim.firstFrame) / anim.fps);
                    const posValues = relevantTranslations.flatMap(t => t.value);
                    tracks.push(new THREE.VectorKeyframeTrack(`${kf.bone}.position`, posTimes, posValues));
                }
 
                // Filter and sort rotation keyframes for the current animation.
                const relevantRotations = kf.rotations
                    .filter(r => r.frame >= anim.firstFrame && r.frame <= anim.lastFrame)
                    .sort((a, b) => a.frame - b.frame);
 
                if (relevantRotations.length > 0) {
                    const rotTimes = relevantRotations.map(r => (r.frame - anim.firstFrame) / anim.fps);
                    const rotValues = relevantRotations.flatMap(r => r.value);
                    tracks.push(new THREE.QuaternionKeyframeTrack(`${kf.bone}.quaternion`, rotTimes, rotValues));
                }
            }
            // Calculate the duration of the animation in seconds.
            const duration = (anim.lastFrame - anim.firstFrame) / anim.fps;
            // Create the final AnimationClip.
            const clip = new THREE.AnimationClip(anim.name, duration, tracks);
            animationClips.push(clip);
            if (this.debug) console.log("parse::THREE.AnimationClip created for:", anim.name);
        }
        if (this.debug) console.log("parse::AnimationClips created:", animationClips);


        // Store pulled msh data in scene.userData for later retrieval.
        scene.userData.textures = Array.from(this.textures);
        scene.userData.materials = this.materials;
        scene.userData.models = this.models;
        scene.userData.sceneInfo = this.sceneInfo;
        scene.userData.animations = this.animations;
        scene.userData.keyframes = this.keyframes;
        scene.name = this.sceneInfo.name; // Give THREE.Scene name from sceneInfo.
        scene.animations = animationClips; // Attach AnimationClips to the scene's 'animations' property as THREE expects.
        if (this.debug) console.log("parse::Scene userData objects assigned, scene ready:", scene);
        return scene;
    }

    /**
     * Finds and reads the SINF (Scene Info) chunk, which contains metadata
     * like the scene name, frame range, and bounding box.
     */
    _readSceneInfo(buffer) {
        // Guess usual offset first
        let sinf = this._findChunk(buffer, "SINF", 16, 20); // Usual offset (stock and zetools)
        // If not found, search entire file for SINF, return null if not found
        if (!sinf) sinf = this._findChunk(buffer, "SINF");
        if (!sinf) return null;
        // Scene info vars
        let byteOffset = sinf.chunkStart + 8;
        let name = "", sceneNameLength = 0, frameStart = 0, frameEnd = 100, fps = 30.0,
            rotationX = 0.0, rotationY = 0.0, rotationZ = 0.0, rotationW = 1.0, centerX = 0.0,
            centerY = 0.0, centerZ = 0.0, extentsX = 0.0, extentsY = 0.0, extentsZ = 0.0, radius = 0.0;
        // NAME chunk
        byteOffset += 4;
        sceneNameLength = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        name = this._readString(buffer, byteOffset, sceneNameLength);
        byteOffset += sceneNameLength;
        // FRAM chunk
        byteOffset += 8;
        frameStart = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        frameEnd = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        fps = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        // BBOX chunk
        byteOffset += 8;
        rotationX = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        rotationY = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        rotationZ = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        rotationW = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        centerX = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        centerY = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        centerZ = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        extentsX = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        extentsY = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        extentsZ = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        radius = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        return {
            name,
            frameStart,
            frameEnd,
            fps,
            radius,
            rotation: [rotationX, rotationY, rotationZ, rotationW],
            center: [centerX, centerY, centerZ],
            extents: [extentsX, extentsY, extentsZ],
        };
    }

    /**
     * Finds and reads the MATL (Materials) chunk, which contains definitions
     * for all materials used in the model.
     */
    _readMaterials(buffer) {
        // Guess common offsets first
        let matl = this._findChunk(buffer, "MATL", 124, 128); // ZETools export offset
        if (!matl) matl = this._findChunk(buffer, "MATL", 104, 108); // Stock minimum offset
        if (!matl) matl = this._findChunk(buffer, "MATL"); // Search entire file
        if (!matl) return null;
        let byteOffset = matl.chunkStart + 8;
        const matCount = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        const materials = [];
        for (let i = 0; i < matCount; i++) {
            let nameLength = 0, materialName = "", diffuseColor = [], specularColor = [], ambientColor = [],
                shininess = 0, flags = 0, renderType = 0, data0 = 0, data1 = 0, atrb = null, tx0d = null,
                tx1d = null, tx2d = null, tx3d = null;
            // NAME and DATA chunks
            byteOffset += 12;
            nameLength = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;
            materialName = this._readString(buffer, byteOffset, nameLength);
            byteOffset += nameLength;
            byteOffset += 8;
            diffuseColor = [
                this._readFloat32LE(buffer, byteOffset),
                this._readFloat32LE(buffer, byteOffset + 4),
                this._readFloat32LE(buffer, byteOffset + 8),
                this._readFloat32LE(buffer, byteOffset + 12)
            ];
            byteOffset += 16;
            specularColor = [
                this._readFloat32LE(buffer, byteOffset),
                this._readFloat32LE(buffer, byteOffset + 4),
                this._readFloat32LE(buffer, byteOffset + 8),
                this._readFloat32LE(buffer, byteOffset + 12)
            ];
            byteOffset += 16;
            ambientColor = [
                this._readFloat32LE(buffer, byteOffset),
                this._readFloat32LE(buffer, byteOffset + 4),
                this._readFloat32LE(buffer, byteOffset + 8),
                this._readFloat32LE(buffer, byteOffset + 12)
            ];
            byteOffset += 16;
            shininess = this._readFloat32LE(buffer, byteOffset);
            byteOffset += 4;
            if (this._readString(buffer, byteOffset, 4) === "ATRB") {
                byteOffset += 8;
                flags = this._readUint8LE(buffer, byteOffset);
                byteOffset += 1;
                renderType = this._readUint8LE(buffer, byteOffset);
                byteOffset += 1;
                data0 = this._readUint8LE(buffer, byteOffset);
                byteOffset += 1;
                data1 = this._readUint8LE(buffer, byteOffset);
                byteOffset += 1;
                atrb = {
                    flags,
                    renderType,
                    data0,
                    data1,
                    bitFlags: {
                        emissive: (flags & 1 << 0) !== 0,
                        glow: (flags & 1 << 1) !== 0,
                        singleTransparent: (flags & 1 << 2) !== 0,
                        doubleTransparent: (flags & 1 << 3) !== 0,
                        hardEdgedTransparent: (flags & 1 << 4) !== 0,
                        perpixelLighting: (flags & 1 << 5) !== 0,
                        additiveTransparent: (flags & 1 << 6) !== 0,
                        specular: (flags & 1 << 7) !== 0,
                    },
                    renderFlags: {
                        normal: renderType === 0,
                        glow: renderType === 1,
                        lightMap: renderType === 2,
                        scrolling: renderType === 3,
                        specular: renderType === 4,
                        glossmap: renderType === 5,
                        chrome: renderType === 6,
                        animated: renderType === 7,
                        ice: renderType === 8, //deprecated
                        sky: renderType === 9, //deprecated
                        water: renderType === 10, //deprecated
                        detail: renderType === 11,
                        scroll2: renderType === 12, //unsupported
                        rotate: renderType === 13, //unsupported
                        glowRotate: renderType === 14, //unsupported
                        planarReflection: renderType === 15, //deprecated
                        glowScroll: renderType === 16,
                        glowScroll2: renderType === 17, //unsupported
                        curvedReflection: renderType === 18, //deprecated
                        normalMapFade: renderType === 19, //unsupported
                        normalMapInvFade: renderType === 20, //unsupported
                        iceReflection: renderType === 21, //deprecated
                        refracted: renderType === 22,
                        emboss: renderType === 23,
                        wireframe: renderType === 24,
                        pulsate: renderType === 25,
                        afterburner: renderType === 26, //deprecated
                        bumpmap: renderType === 27,
                        bumpmapAndGlossmap: renderType === 28,
                        bumpmapAndDetailmapAndEnvmap: renderType === 29,
                        multistate: renderType === 30, //deprecated
                        shield: renderType === 31, //deprecated
                    }
                };
            }
            if (this._readString(buffer, byteOffset, 4) === "TX0D") {
                byteOffset += 4;
                const tx0Length = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                tx0d = this._readString(buffer, byteOffset, tx0Length);
                if (!tx0d.endsWith(".tga")) tx0d += ".tga";
                this.textures.add(tx0d.toLowerCase());
                byteOffset += tx0Length;
            }
            if (this._readString(buffer, byteOffset, 4) === "TX1D") {
                byteOffset += 4;
                const tx1Length = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                tx1d = this._readString(buffer, byteOffset, tx1Length);
                if (!tx1d.endsWith(".tga")) tx1d += ".tga";
                this.textures.add(tx1d.toLowerCase());
                byteOffset += tx1Length;
            }
            if (this._readString(buffer, byteOffset, 4) === "TX2D") {
                byteOffset += 4;
                const tx2Length = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                tx2d = this._readString(buffer, byteOffset, tx2Length);
                if (!tx2d.endsWith(".tga")) tx2d += ".tga";
                this.textures.add(tx2d.toLowerCase());
                byteOffset += tx2Length;
            }
            if (this._readString(buffer, byteOffset, 4) === "TX3D") {
                byteOffset += 4;
                const tx3Length = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                tx3d = this._readString(buffer, byteOffset, tx3Length);
                if (!tx3d.endsWith(".tga")) tx3d += ".tga";
                this.textures.add(tx3d.toLowerCase());
                byteOffset += tx3Length;
            }
            materials.push({
                name: materialName,
                matd: {
                    name: materialName,
                    diffuseColor,
                    specularColor,
                    ambientColor,
                    shininess,
                    atrb,
                    tx0d,
                    tx1d,
                    tx2d,
                    tx3d
                }
            });
        }
        return materials;
    }

    /**
     * Finds and reads all MODL (Model) chunks. Each MODL chunk represents a node
     * in the scene hierarchy and may contain geometry (GEOM), cloth (CLTH),
     * and/or skinning (ENVL) data.
     */
    _readGeometries(buffer) {
        const modlChunks = this._findAllChunks(buffer, "MODL");
        const models = [];
        for (const modl of modlChunks) {
            let byteOffset = modl.chunkStart + 8;
            // Parse MTYP
            byteOffset += 4; // MTYP header
            const mtypSize = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;
            const mtyp = this._readUint32LE(buffer, byteOffset);
            byteOffset += mtypSize;
            // Parse MNDX
            byteOffset += 4; // MNDX header
            const mndxSize = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;
            const mndx = this._readUint32LE(buffer, byteOffset);
            byteOffset += mndxSize;
            // Parse NAME
            byteOffset += 4; // NAME header
            const nameLength = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;
            const name = this._readString(buffer, byteOffset, nameLength);
            byteOffset += nameLength;
            // Optional PRNT
            let prnt = null;
            const prntHeader = this._readString(buffer, byteOffset, 4);
            if (prntHeader === "PRNT") {
                byteOffset += 4;
                const prntLength = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                prnt = this._readString(buffer, byteOffset, prntLength);
                byteOffset += prntLength;
            }
            // Optional FLGS
            let flgs = 0;
            const flgsHeader = this._readString(buffer, byteOffset, 4);
            if (flgsHeader === "FLGS") {
                byteOffset += 4;
                const flgsSize = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                flgs = this._readUint32LE(buffer, byteOffset);
                byteOffset += flgsSize;
            }
            // Parse TRAN
            byteOffset += 4; // TRAN header
            const tranSize = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;
            // Scale (XYZ)
            const scale = [
                this._readFloat32LE(buffer, byteOffset),
                this._readFloat32LE(buffer, byteOffset + 4),
                this._readFloat32LE(buffer, byteOffset + 8)
            ];
            byteOffset += 12;
            // Rotation (XYZW)
            const rotation = [
                this._readFloat32LE(buffer, byteOffset),
                this._readFloat32LE(buffer, byteOffset + 4),
                this._readFloat32LE(buffer, byteOffset + 8),
                this._readFloat32LE(buffer, byteOffset + 12)
            ];
            byteOffset += 16;
            // Translation (XYZ)
            const translation = [
                this._readFloat32LE(buffer, byteOffset),
                this._readFloat32LE(buffer, byteOffset + 4),
                this._readFloat32LE(buffer, byteOffset + 8)
            ];
            byteOffset += 12;
            // Check for GEOM
            const geomHeader = this._readString(buffer, byteOffset, 4);
            let geom = null;
            if (geomHeader === "GEOM") {
                byteOffset += 4;
                const geomSize = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                const geomEnd = byteOffset + geomSize;
                byteOffset += 52; // Skip BBOX
                geom = { segments: [], cloth: null, envelope: null };
                while (byteOffset < geomEnd) {
                    const chunkHeader = this._readString(buffer, byteOffset, 4);
                    if (chunkHeader === "SEGM") {
                        let segm = {
                            mati: 0,
                            posl: { vertexCount: 0, vertices: null },
                            nrml: { normals: null },
                            uv0l: { uvs: null },
                            ndxt: { trianglesCCW: null },
                            ndxl: { polygons: null, trianglesCCW: null },
                            strp: { triangleStrips: null, trianglesCCW: null },
                            clrl: { colors: null },
                            clrb: { color: null },
                            wght: { count: 0, indices: null, weights: null },
                            shdw: null,
                        };
                        byteOffset += 4; // Skip SEGM header
                        const segmSize = this._readUint32LE(buffer, byteOffset);
                        byteOffset += 4; // Skip SEGM size
                        const segmEnd = byteOffset + segmSize;
                        // While inside this segm chunk...
                        while (byteOffset < segmEnd) {
                            const segmentChild = this._readString(buffer, byteOffset, 4);
                            if (segmentChild === "MATI") {
                                byteOffset += 8; // Skip MATI header and size
                                segm.mati = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4; // Skip mati
                            } else if (segmentChild === "POSL") {
                                byteOffset += 4;
                                const poslSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const poslEnd = byteOffset + poslSize;
                                const vertexCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                segm.posl.vertexCount = vertexCount;
                                segm.posl.vertices = new Float32Array(vertexCount * 3);
                                for (let i = 0; i < vertexCount; i++) {
                                    if (byteOffset >= poslEnd) break;
                                    segm.posl.vertices[i * 3] = this._readFloat32LE(buffer, byteOffset);
                                    segm.posl.vertices[i * 3 + 1] = this._readFloat32LE(buffer, byteOffset + 4);
                                    segm.posl.vertices[i * 3 + 2] = this._readFloat32LE(buffer, byteOffset + 8);
                                    byteOffset += 12;
                                }
                                byteOffset = poslEnd;
                            } else if (segmentChild === "NRML") {
                                byteOffset += 4;
                                const nrmlSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const nrmlEnd = byteOffset + nrmlSize;
                                const normalsCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                segm.nrml.normals = new Float32Array(normalsCount * 3);
                                for (let i = 0; i < normalsCount; i++) {
                                    if (byteOffset >= nrmlEnd) break;
                                    segm.nrml.normals[i * 3] = this._readFloat32LE(buffer, byteOffset);
                                    segm.nrml.normals[i * 3 + 1] = this._readFloat32LE(buffer, byteOffset + 4);
                                    segm.nrml.normals[i * 3 + 2] = this._readFloat32LE(buffer, byteOffset + 8);
                                    byteOffset += 12;
                                }
                                byteOffset = nrmlEnd;
                            } else if (segmentChild === "UV0L") {
                                byteOffset += 4;
                                const uv0lSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const uv0lEnd = byteOffset + uv0lSize;
                                const uvCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                segm.uv0l.uvs = new Float32Array(uvCount * 2);
                                for (let i = 0; i < uvCount; i++) {
                                    if (byteOffset >= uv0lEnd) break;
                                    segm.uv0l.uvs[i * 2] = this._readFloat32LE(buffer, byteOffset);
                                    segm.uv0l.uvs[i * 2 + 1] = this._readFloat32LE(buffer, byteOffset + 4);
                                    byteOffset += 8;
                                }
                                byteOffset = uv0lEnd;
                            } else if (segmentChild === "NDXT") {
                                byteOffset += 4;
                                const ndxtSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const ndxtEnd = byteOffset + ndxtSize;
                                const numTris = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                segm.ndxt.trianglesCCW = [];
                                let triangleIndex = 0;
                                for (let i = 0; i < numTris; i++) {
                                    if (byteOffset >= ndxtEnd) break;
                                    segm.ndxt.trianglesCCW[triangleIndex++] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                    segm.ndxt.trianglesCCW[triangleIndex++] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                    segm.ndxt.trianglesCCW[triangleIndex++] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                }
                                byteOffset = ndxtEnd;
                            } else if (segmentChild === "NDXL") {
                                byteOffset += 4;
                                const ndxlSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const ndxlEnd = byteOffset + ndxlSize;
                                const numPolygons = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                segm.ndxl.polygons = [];
                                for (let i = 0; i < numPolygons; i++) {
                                    if (byteOffset >= ndxlEnd) break;
                                    const numIndices = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                    const polygonIndices = new Uint16Array(numIndices);
                                    for (let j = 0; j < numIndices; j++) {
                                        polygonIndices[j] = this._readUint16LE(buffer, byteOffset);
                                        byteOffset += 2;
                                    }
                                    segm.ndxl.polygons.push(polygonIndices);
                                }
                                byteOffset = ndxlEnd;
                            } else if (segmentChild === "STRP") {
                                byteOffset += 4;
                                const strpSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const strpEnd = byteOffset + strpSize;
                                const allRawIndices = [];
                                let tempOffset = byteOffset + 4; // Skip the numIndices field for now
                                while (tempOffset < strpEnd) {
                                    // Defensive check to avoid reading past the buffer if chunk size is wrong
                                    if (tempOffset + 2 > buffer.byteLength) break;
                                    allRawIndices.push(this._readUint16LE(buffer, tempOffset));
                                    tempOffset += 2;
                                }
                                // Process the raw indices into separate strips.
                                segm.strp.triangleStrips = [];
                                if (allRawIndices.length > 0) {
                                    let currentStrip = [];
                                    for (let i = 0; i < allRawIndices.length; i++) {
                                        const rawIndex = allRawIndices[i];
                                        // Check if this index is the START of a separator pair.
                                        const isSeparatorStart = (rawIndex & 0x8000) &&
                                            (i + 1 < allRawIndices.length) &&
                                            (allRawIndices[i + 1] & 0x8000);
                                        if (isSeparatorStart) {
                                            // If a strip is in progress, finalize it and add it to the list.
                                            if (currentStrip.length > 0) {
                                                segm.strp.triangleStrips.push(new Uint16Array(currentStrip));
                                            }
                                            // Start a new, empty strip.
                                            currentStrip = [];
                                        }
                                        const vertexIndex = rawIndex & 0x7FFF;
                                        currentStrip.push(vertexIndex);
                                    }
                                    // After the loop, push the last remaining strip.
                                    if (currentStrip.length > 0) {
                                        segm.strp.triangleStrips.push(new Uint16Array(currentStrip));
                                    }
                                }
                                byteOffset = strpEnd;
                            } else if (segmentChild === "CLRL") {
                                // BGRA 0-255 colors
                                byteOffset += 4;
                                const clrlSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const clrlEnd = byteOffset + clrlSize;
                                const colorsCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                segm.clrl = { colors: new Uint8Array(colorsCount * 4) };
                                for (let i = 0; i < colorsCount; i++) {
                                    if (byteOffset >= clrlEnd) break;
                                    segm.clrl.colors[i * 4] = this._readUint8LE(buffer, byteOffset);
                                    segm.clrl.colors[i * 4 + 1] = this._readUint8LE(buffer, byteOffset + 1);
                                    segm.clrl.colors[i * 4 + 2] = this._readUint8LE(buffer, byteOffset + 2);
                                    segm.clrl.colors[i * 4 + 3] = this._readUint8LE(buffer, byteOffset + 3);
                                    byteOffset += 4;
                                }
                                byteOffset = clrlEnd;
                            } else if (segmentChild === "CLRB") {
                                // BGRA 0-255 color for entire segment
                                byteOffset += 8;
                                segm.clrb = { color: new Uint8Array(4) };
                                segm.clrb.color[0] = this._readUint8LE(buffer, byteOffset);
                                segm.clrb.color[1] = this._readUint8LE(buffer, byteOffset + 1);
                                segm.clrb.color[2] = this._readUint8LE(buffer, byteOffset + 2);
                                segm.clrb.color[3] = this._readUint8LE(buffer, byteOffset + 3);
                                byteOffset += 4;
                            } else if (segmentChild === "WGHT") {
                                byteOffset += 4;
                                const wghtSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const wghtEnd = byteOffset + wghtSize;
                                // Number of 32-byte bone-index and weight quads to follow
                                const weightsCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                segm.wght.count = weightsCount;

                                // Each vertex has 4 bone indices and 4 weights.
                                const boneIndices = new Uint32Array(weightsCount * 4); // Index into ENVL
                                const boneWeights = new Float32Array(weightsCount * 4); // Percentage of influence

                                for (let i = 0; i < weightsCount; i++) {
                                    if (byteOffset > wghtEnd) break; // Safety check
                                    const baseIndex = i * 4;
                                    // Collect all eight values per vertex
                                    for (let j = 0; j < 4; j++) {
                                        boneIndices[baseIndex + j] = this._readUint32LE(buffer, byteOffset);
                                        byteOffset += 4;
                                        boneWeights[baseIndex + j] = this._readFloat32LE(buffer, byteOffset);
                                        byteOffset += 4;
                                    }
                                }
                                
                                segm.wght.indices = boneIndices;
                                segm.wght.weights = boneWeights;
                                byteOffset = wghtEnd;
                            } else {
                                // Skip unknown chunk
                                byteOffset += 4;
                                const childSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4 + childSize;
                            }
                        }
                        geom.segments.push(segm);
                    } else if (chunkHeader === "CLTH") {
                        let clth = {
                            name: name,
                            ctex: "",
                            cpos: { vertexCount: 0, vertices: null },
                            cuv0: { uvCount: 0, uvs: null },
                            fidx: { pointCount: 0, fixedPoints: null },
                            fwgt: { pointCount: 0, boneNames: null },
                            cmsh: { vertexCount: 0, trianglesCCW: null },
                            sprs: { stretchCount: 0, stretchPoints: null },
                            cprs: { crossCount: 0, crossPoints: null },
                            bprs: { bendCount: 0, bendPoints: null },
                            coll: { collisionObjCount: 0, collisionObjects: null },
                        }
                        byteOffset += 4;
                        const clothSize = this._readUint32LE(buffer, byteOffset);
                        byteOffset += 4;
                        const clothEnd = byteOffset + clothSize;
                        // While inside this CLTH chunk
                        while (byteOffset < clothEnd) {
                            const clthChild = this._readString(buffer, byteOffset, 4);
                            if (clthChild === "CTEX") {
                                byteOffset += 4;
                                const ctexLength = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.ctex = this._readString(buffer, byteOffset, ctexLength);
                                if (!clth.ctex.endsWith(".tga"))
                                    clth.ctex += ".tga";
                                this.textures.add(clth.ctex.toLowerCase());
                                byteOffset += ctexLength;
                            } else if (clthChild === "CPOS") {
                                byteOffset += 4;
                                const cposSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const cposEnd = byteOffset + cposSize;
                                const cposCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.cpos.vertexCount = cposCount;
                                clth.cpos.vertices = new Float32Array(cposCount * 3);
                                for (let i = 0; i < cposCount; i++) {
                                    if (byteOffset >= cposEnd) break;
                                    clth.cpos.vertices[i * 3] = this._readFloat32LE(buffer, byteOffset);
                                    clth.cpos.vertices[i * 3 + 1] = this._readFloat32LE(buffer, byteOffset + 4);
                                    clth.cpos.vertices[i * 3 + 2] = this._readFloat32LE(buffer, byteOffset + 8);
                                    byteOffset += 12;
                                }
                                byteOffset = cposEnd;
                            } else if (clthChild === "CUV0") {
                                byteOffset += 4;
                                const cuv0Size = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const cuv0End = byteOffset + cuv0Size;
                                const cuv0Count = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.cuv0.uvCount = cuv0Count;
                                clth.cuv0.uvs = new Float32Array(cuv0Count * 2);
                                for (let i = 0; i < cuv0Count; i++) {
                                    if (byteOffset >= cuv0End) break;
                                    clth.cuv0.uvs[i * 2] = this._readFloat32LE(buffer, byteOffset);
                                    clth.cuv0.uvs[i * 2 + 1] = this._readFloat32LE(buffer, byteOffset + 4);
                                    byteOffset += 8;
                                }
                                byteOffset = cuv0End;
                            } else if (clthChild === "FIDX") {
                                byteOffset += 4;
                                const fidxSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const fidxEnd = byteOffset + fidxSize;
                                const fidxCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.fidx.pointCount = fidxCount;
                                clth.fidx.fixedPoints = new Uint32Array(fidxCount);
                                for (let i = 0; i < fidxCount; i++) {
                                    if (byteOffset >= fidxEnd) break;
                                    clth.fidx.fixedPoints[i] = this._readUint32LE(buffer, byteOffset);
                                    byteOffset += 4;
                                }
                                byteOffset = fidxEnd;
                            } else if (clthChild === "FWGT") {
                                byteOffset += 4;
                                const fwgtSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const fwgtEnd = byteOffset + fwgtSize;
                                const fwgtCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.fwgt.pointCount = fwgtCount;
                                clth.fwgt.boneNames = new Array(fwgtCount);
                                for (let i = 0; i < fwgtCount; i++) {
                                    if (byteOffset >= fwgtEnd) break;
                                    const boneNameChars = [];
                                    while (byteOffset < fwgtEnd) {
                                        const charCode = this._readUint8LE(buffer, byteOffset);
                                        byteOffset++;
                                        if (charCode === 0) break;
                                        boneNameChars.push(String.fromCharCode(charCode));
                                    }
                                    const boneName = boneNameChars.join('');
                                    clth.fwgt.boneNames[i] = boneName;
                                }
                                byteOffset = fwgtEnd;
                            } else if (clthChild === "CMSH") {
                                byteOffset += 4;
                                const cmshSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const cmshEnd = byteOffset + cmshSize;
                                const cmshCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.cmsh.vertexCount = cmshCount;
                                clth.cmsh.trianglesCCW = new Uint32Array(cmshCount * 3);
                                for (let i = 0; i < cmshCount; i++) {
                                    if (byteOffset >= cmshEnd) break;
                                    clth.cmsh.trianglesCCW[i * 3] = this._readUint32LE(buffer, byteOffset);
                                    clth.cmsh.trianglesCCW[i * 3 + 1] = this._readUint32LE(buffer, byteOffset + 4);
                                    clth.cmsh.trianglesCCW[i * 3 + 2] = this._readUint32LE(buffer, byteOffset + 8);
                                    byteOffset += 12;
                                }
                                byteOffset = cmshEnd;
                            } else if (clthChild === "SPRS") {
                                byteOffset += 4;
                                const sprsSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const sprsEnd = byteOffset + sprsSize;
                                const sprsCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.sprs.stretchCount = sprsCount;
                                clth.sprs.stretchPoints = new Uint16Array(sprsCount * 2);
                                for (let i = 0; i < sprsCount; i++) {
                                    if (byteOffset >= sprsEnd) break;
                                    clth.sprs.stretchPoints[i * 2] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                    clth.sprs.stretchPoints[i * 2 + 1] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                }
                                byteOffset = sprsEnd;
                            } else if (clthChild === "CPRS") {
                                byteOffset += 4;
                                const cprsSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const cprsEnd = byteOffset + cprsSize;
                                const cprsCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.cprs.crossCount = cprsCount;
                                clth.cprs.crossPoints = new Uint16Array(cprsCount * 2);
                                for (let i = 0; i < cprsCount; i++) {
                                    if (byteOffset >= cprsEnd) break;
                                    clth.cprs.crossPoints[i * 2] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                    clth.cprs.crossPoints[i * 2 + 1] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                }
                                byteOffset = cprsEnd;
                            } else if (clthChild === "BPRS") {
                                byteOffset += 4;
                                const bprsSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                const bprsEnd = byteOffset + bprsSize;
                                const bprsCount = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4;
                                clth.bprs.bendCount = bprsCount;
                                clth.bprs.bendPoints = new Uint16Array(bprsCount * 2);
                                for (let i = 0; i < bprsCount; i++) {
                                    if (byteOffset >= bprsEnd) break;
                                    clth.bprs.bendPoints[i * 2] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                    clth.bprs.bendPoints[i * 2 + 1] = this._readUint16LE(buffer, byteOffset);
                                    byteOffset += 2;
                                }
                                byteOffset = bprsEnd;
                            } else {
                                // Skip unknown chunk
                                byteOffset += 4;
                                const childSize = this._readUint32LE(buffer, byteOffset);
                                byteOffset += 4 + childSize;
                            }
                        }
                        geom.cloth = clth;
                        byteOffset = clothEnd;
                    } else if (chunkHeader === "ENVL") {
                        byteOffset += 4; // Skip ENVL header
                        const envlSize = this._readUint32LE(buffer, byteOffset);
                        byteOffset += 4;
                        const envlEnd = byteOffset + envlSize;

                        const numIndices = this._readUint32LE(buffer, byteOffset);
                        byteOffset += 4;
                        const indices = new Uint32Array(numIndices);

                        for (let i = 0; i < numIndices; i++) { // numIndices is the vertex count
                            if (byteOffset > envlEnd) break; // Safety check
                            indices[i] = this._readUint32LE(buffer, byteOffset);
                            byteOffset += 4;
                        }

                        geom.envelope = { count: numIndices, indices: indices };
                        byteOffset = envlEnd;
                    } else {
                        // Skip unknown chunk
                        byteOffset += 4;
                        const skipSize = this._readUint32LE(buffer, byteOffset);
                        byteOffset += 4 + skipSize;
                    }
                }
            }
            models.push({
                name: name.toLowerCase(),
                modl: {
                    name,
                    mtyp,
                    mndx,
                    prnt,
                    flgs,
                    tran: { scale, rotation, translation },
                    geom,
                }
            });
        }
        return models;
    }

    /**
     * Finds and reads the ANM2 (Animation) chunk. This chunk contains two main
     * sub-chunks: CYCL (defines the animations like "walk", "run") and
     * KFR3 (contains the actual position/rotation keyframe data for each bone).
     */
    _readAnimations(buffer) {
        let anm2 = this._findChunk(buffer, "ANM2");
        if (!anm2) return null; // Simply return null if not found
        const animations = []; // List of animations found
        let byteOffset = anm2.chunkStart + 12; // Skip CYCL header
        const cyclSize = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        const cyclEnd = byteOffset + cyclSize;
        const animationCount = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        for (let i = 0; i < animationCount; i++) {
            if (byteOffset >= cyclEnd) break;
            let animName = this._readString(buffer, byteOffset, 64); // Always 64-byte animation name
            byteOffset += 64;
            let fps = this._readFloat32LE(buffer, byteOffset); // FPS, usually 30
            byteOffset += 4;
            let playStyle = this._readUint32LE(buffer, byteOffset); // Looping(?)
            byteOffset += 4;
            let firstFrame = this._readUint32LE(buffer, byteOffset); // First keyframe for this animation
            byteOffset += 4;
            let lastFrame = this._readUint32LE(buffer, byteOffset); // Last frame used for this animation
            byteOffset += 4;
            let anim = {
                name: animName,
                fps,
                playStyle,
                firstFrame,
                lastFrame
            };
            animations.push(anim);
        }
        byteOffset = cyclEnd;
        const keyframes = []; // List of keyframes by bone
        byteOffset += 4; // Skip KFR3 chunk header
        const kfr3Size = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        const kfr3End = byteOffset + kfr3Size;
        const boneCount = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;

        // Bones in the KFR3 chunk are identified by a CRC32 hash of their name.
        // We pre-calculate the CRC for all our model names to create a fast lookup map.
        const crcToModelNameMap = new Map();
        for (const model of this.models)
            crcToModelNameMap.set(this.CalcLowerCRC(model.modl.name), model.name);

        for (let i = 0; i < boneCount; i++) {
            if (byteOffset >= kfr3End) break; // Safety break

            const boneCRC = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;
            // Look up the bone name using the CRC.
            const bone = crcToModelNameMap.get(boneCRC) || boneCRC;

            const keyframeType = this._readUint32LE(buffer, byteOffset); // Unknown
            byteOffset += 4;
            const translationFramesCount = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;
            const rotationFramesCount = this._readUint32LE(buffer, byteOffset);
            byteOffset += 4;

            // Read all translation (position) keyframes for this bone.
            // Note that frames are not sorted sequentially
            const translationFrames = [];
            for (let j = 0; j < translationFramesCount; j++) {
                if (byteOffset >= kfr3End) break;
                const frameIndex = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                const x = this._readFloat32LE(buffer, byteOffset);
                byteOffset += 4;
                const y = this._readFloat32LE(buffer, byteOffset);
                byteOffset += 4;
                const z = this._readFloat32LE(buffer, byteOffset);
                byteOffset += 4;
                translationFrames.push({ frame: frameIndex, value: [x, y, z] });
            }

            // Read all rotation (quaternion) keyframes for this bone.
            const rotationFrames = [];
            for (let j = 0; j < rotationFramesCount; j++) {
                if (byteOffset >= kfr3End) break;
                const frameIndex = this._readUint32LE(buffer, byteOffset);
                byteOffset += 4;
                const x = this._readFloat32LE(buffer, byteOffset);
                byteOffset += 4;
                const y = this._readFloat32LE(buffer, byteOffset);
                byteOffset += 4;
                const z = this._readFloat32LE(buffer, byteOffset);
                byteOffset += 4;
                const w = this._readFloat32LE(buffer, byteOffset);
                byteOffset += 4;
                rotationFrames.push({ frame: frameIndex, value: [x, y, z, w] });
            }

            // A "keyframe" object here represents the full set of animation data for a single bone across all animations.
            const boneKeyframes = {
                bone,
                keyframeType,
                translations: translationFrames,
                rotations: rotationFrames,
            };
            keyframes.push(boneKeyframes);
        }
        byteOffset = kfr3End;
        return { animations, keyframes };
    }

    /**
     * A utility function to remove degenerate (zero-area or duplicate) triangles
     * from an index list. This can help clean up messy geometry data.
     * (Currently not used in the main parse loop due to potential side effects).
     */
    _cleanupTriangles(triangleIndices, vertexPositions) {
        const seen = new Set()
        const out = []

        // Compute cross product of v × w
        const cross = (v, w) => [
            v[1] * w[2] - v[2] * w[1],
            v[2] * w[0] - v[0] * w[2],
            v[0] * w[1] - v[1] * w[0]
        ]

        for (let i = 0; i < triangleIndices.length; i += 3) {
            const a = triangleIndices[i]
            const b = triangleIndices[i + 1]
            const c = triangleIndices[i + 2]

            // Skip if degenerate by identical indices
            if (a === b || b === c || c === a) continue

            // Zero-area check via cross product
            const ax = vertexPositions[3 * a], ay = vertexPositions[3 * a + 1], az = vertexPositions[3 * a + 2]
            const bx = vertexPositions[3 * b], by = vertexPositions[3 * b + 1], bz = vertexPositions[3 * b + 2]
            const cx = vertexPositions[3 * c], cy = vertexPositions[3 * c + 1], cz = vertexPositions[3 * c + 2]
            const v0 = [bx - ax, by - ay, bz - az]
            const v1 = [cx - ax, cy - ay, cz - az]
            const cr = cross(v0, v1)

            // If small enough, skip
            if (Math.abs(cr[0]) < 1e-6 &&
                Math.abs(cr[1]) < 1e-6 &&
                Math.abs(cr[2]) < 1e-6) {
                continue
            }

            // Undirected duplicate check: sort indices so [a,b,c] == any permutation
            const sortedKey = [a, b, c]
                .sort((x, y) => x - y)
                .join(',')
            // Skip if already seen
            if (seen.has(sortedKey)) continue
            seen.add(sortedKey)

            // Keep the original CCW ordering
            out.push(a, b, c)
        }
        return out
    }

    /**
     * A utility function to remove duplicate vertices within a certain precision.
     * (Currently not used due to possible side-effects).
     */
    _cleanupVertices(vertexPositions, precision = 5) {
        // Precision of 1e-6 to 1e-4 is common
        const seen = new Set()
        const out = []
        for (let i = 0; i < vertexPositions.length; i += 3) {
            const x = vertexPositions[i]
            const y = vertexPositions[i + 1]
            const z = vertexPositions[i + 2]
            const key = `${x.toFixed(precision)},${y.toFixed(precision)},${z.toFixed(precision)}`
            if (seen.has(key)) continue
            seen.add(key)
            out.push(x, y, z)
        }
        return out
    }

    /**
     * Configures and returns a THREE.FileLoader instance for loading the
     * binary data from a URL.
     */
    _setupLoader(manager) {
        manager = manager !== undefined ? manager : THREE.DefaultLoadingManager;
        const loader = new THREE.FileLoader(manager);
        loader.setPath(this.path)
            .setWithCredentials(this.withCredentials)
            .setRequestHeader(this.requestHeader)
            .setResponseType("arraybuffer");
        return loader;
    }

    /**
     * A utility function to find the first occurrence of a chunk in the buffer
     * by its 4-character header (e.g., "MODL", "SINF"). It performs a
     * recursive search within known parent chunks to locate possible children.
     */
    _findChunk(buffer, header, startPos, endPos) {
        buffer = buffer || this.buffer;
        let offset = startPos || 0;
        let end = endPos || buffer.byteLength;
        const parentChunks = ["HEDR", "MSH2", "SINF", "CAMR", "MATL", "MODL", "GEOM", "SEGM", "CLTH", "ANM2"];
        while (offset < end) {
            let chunkHeader = this._readString(buffer, offset, 4);
            let chunkSize = this._readUint32LE(buffer, offset + 4);
            if (chunkHeader === header)
                return { chunkStart: offset, chunkEnd: offset + 8 + chunkSize };
            else if (parentChunks.includes(chunkHeader)) {
                // If the chunk is a parent, search this chunk
                let foundChild = this._findChunk(buffer, header, offset + 8, offset + 8 + chunkSize);
                if (foundChild) return foundChild;
            }
            offset += 8 + chunkSize; // Skip to next chunk if not found
        }
        return null;
    }

    /**
     * A utility function to find all occurrences of a chunk by its header.
     * This is used for chunks like "MODL" where there can be multiple instances.
     */
    _findAllChunks(buffer, header, startPos, endPos) {
        buffer = buffer || this.buffer;
        endPos = endPos || buffer.byteLength;
        let offset = startPos || 0;
        const parentChunks = ["HEDR", "MSH2", "SINF", "CAMR", "MATL", "MODL", "GEOM", "SEGM", "CLTH", "ANM2"];
        const found = [];
        while (offset < endPos) {
            // Prevent reading past buffer
            if (offset + 8 > buffer.byteLength || offset + 8 > endPos) break;
            const chunkHeader = this._readString(buffer, offset, 4);
            const chunkSize = this._readUint32LE(buffer, offset + 4);
            // Defensive: chunkSize may be undefined or too large
            if (typeof chunkSize !== "number" || chunkSize < 0 || offset + 8 + chunkSize > buffer.byteLength) {
                // Skip 1 byte to avoid infinite loop on corrupt data
                offset++;
                continue;
            }
            if (chunkHeader === header) {
                found.push({ chunkStart: offset, chunkEnd: offset + 8 + chunkSize });
            }
            if (parentChunks.includes(chunkHeader)) {
                // Recursively search inside this parent chunk
                const children = this._findAllChunks(buffer, header, offset + 8, offset + 8 + chunkSize);
                found.push(...children);
            }
            offset += 8 + chunkSize;
        }
        return found;
    }

    /**
     * A set of utility functions for reading different data types (e.g., Uint32, Float32)
     * from the DataView in little-endian format, with basic safety checks.
     */
    _readUint32LE(buffer, byteOffset) {
        if (buffer == undefined) buffer = this.buffer;
        if (byteOffset == undefined) byteOffset = this.byteOffset;
        try { return buffer.getUint32(byteOffset, true); }
        catch (error) {
            console.error("Error reading uint32 at byte byteOffset", byteOffset, ":", error);
        }
    }

    _readUint16LE(buffer, byteOffset) {
        if (buffer == undefined) buffer = this.buffer;
        if (byteOffset == undefined) byteOffset = this.byteOffset;
        try { return buffer.getUint16(byteOffset, true); }
        catch (error) {
            console.error("Error reading uint16 at byte byteOffset", byteOffset, ":", error);
        }
    }

    _readUint8LE(buffer, byteOffset) {
        if (buffer == undefined) buffer = this.buffer;
        if (byteOffset == undefined) byteOffset = this.byteOffset;
        try { return buffer.getUint8(byteOffset, true); }
        catch (error) {
            console.error("Error reading uint8 at byte byteOffset", byteOffset, ":", error);
        }
    }

    _readFloat32LE(buffer, byteOffset) {
        if (buffer == undefined) buffer = this.buffer;
        if (byteOffset == undefined) byteOffset = this.byteOffset;
        try { return buffer.getFloat32(byteOffset, true); }
        catch (error) {
            console.error("Error reading float32 at byte byteOffset", byteOffset, ":", error);
        }
    }

    _readString(buffer, byteOffset, length) {
        if (buffer == undefined) buffer = this.buffer;
        if (byteOffset == undefined) byteOffset = this.byteOffset;
        if (typeof (length) === "number" && length > 0 && byteOffset + length < buffer.byteLength) {
            try {
                let str = "";
                for (let i = 0; i < length; i++)
                    str += String.fromCharCode(buffer.getUint8(byteOffset + i));
                // Remove null terminators
                return str.replace(/\0/g, "");
            } catch (error) {
                console.error("Error reading string of length", length, "at byte byteOffset", byteOffset, ":", error);
                return "";
            }
        }
    }

    /**
     * CRC32 tables and logic ported from http://schlechtwetterfront.github.io/ze_filetypes/index.html
     * Calculates the CRC32 hash of a lowercase string. This is used to match
     * bone names to the CRC values stored in the animation data.
     */
    CalcLowerCRC(str, crc = 0) {
        crc = ~crc >>> 0; // Use unsigned right shift to keep it as unsigned 32-bit
        if (str) {
            for (let i = 0; i < str.length; i++) {
                const charCode = str.charCodeAt(i);
                const lowerChar = TO_LOWER[charCode];
                crc = ((crc << 8) ^ TABLE_32[(crc >>> 24) ^ lowerChar]) >>> 0;
            }
        }
        return ~crc >>> 0;
    }
}

/**
 * A private helper method to build a standard BufferGeometry from segment data.
 * This logic was extracted from the main parse loop for clarity.
 * @param {object} model - The model data object containing geometry segments.
 * @returns {{geometry: THREE.BufferGeometry, assignedMaterials: Array<THREE.Material>}}
 */
MSHLoader.prototype._buildStandardGeometry = function (model) {
    const mergedPositions = [];
    const mergedNormals = [];
    const mergedUVs = [];
    const mergedColors = [];
    const mergedTris = [];
    const geometryGroups = [];
    let vertexOffset = 0;
    let indexOffset = 0;

    for (let segment of model.modl.geom.segments) {
        if (segment.posl.vertices) mergedPositions.push(...segment.posl.vertices);
        if (segment.nrml.normals) mergedNormals.push(...segment.nrml.normals);
        if (segment.uv0l.uvs) mergedUVs.push(...segment.uv0l.uvs);

        if (segment.clrl.colors) {
            this.materials[segment.mati].three.vertexColors = true;
            const bgra = segment.clrl.colors;
            const rgba = new Float32Array(bgra.length);
            for (let i = 0; i < bgra.length; i += 4) {
                rgba[i] = bgra[i + 2] / 255.0;
                rgba[i + 1] = bgra[i + 1] / 255.0;
                rgba[i + 2] = bgra[i] / 255.0;
                rgba[i + 3] = bgra[i + 3] / 255.0;
            }
            mergedColors.push(...rgba);
        } else if (segment.clrb.color) {
            const bgra = segment.clrb.color;
            const vertexCount = segment.posl.vertexCount;
            if (vertexCount > 0) {
                this.materials[segment.mati].three.vertexColors = true;
                const rgba = new Float32Array(vertexCount * 4);
                for (let i = 0; i < vertexCount; i++) {
                    rgba[i * 4] = bgra[2] / 255.0;
                    rgba[i * 4 + 1] = bgra[1] / 255.0;
                    rgba[i * 4 + 2] = bgra[0] / 255.0;
                    rgba[i * 4 + 3] = bgra[3] / 255.0;
                }
                mergedColors.push(...rgba);
            }
        }

        let trianglesCCW = [];
        if (segment.ndxt.trianglesCCW) {
            for (let i = 0; i <= segment.ndxt.trianglesCCW.length - 3; i += 3)
                trianglesCCW.push(segment.ndxt.trianglesCCW[i], segment.ndxt.trianglesCCW[i + 1], segment.ndxt.trianglesCCW[i + 2]);
        }
        if (segment.strp.triangleStrips) {
            segment.strp.trianglesCCW = [];
            for (const strip of segment.strp.triangleStrips) {
                let indices = Array.from(strip);
                if (indices.length < 3) continue;
                for (let i = 0; i <= indices.length - 3; i++) {
                    if (i % 2 === 0) {
                        segment.strp.trianglesCCW.push(indices[i], indices[i + 1], indices[i + 2]);
                    } else {
                        segment.strp.trianglesCCW.push(indices[i], indices[i + 2], indices[i + 1]);
                    }
                }
            }
            for (let i = 0; i <= segment.strp.trianglesCCW.length - 3; i += 3)
                trianglesCCW.push(segment.strp.trianglesCCW[i], segment.strp.trianglesCCW[i + 1], segment.strp.trianglesCCW[i + 2]);
        }
        if (segment.ndxl.polygons) {
            segment.ndxl.trianglesCCW = [];
            for (const polygon of segment.ndxl.polygons) {
                if (polygon.length < 3) continue;
                const v0 = polygon[0];
                for (let i = 1; i < polygon.length - 1; i++)
                    segment.ndxl.trianglesCCW.push(v0, polygon[i], polygon[i + 1]);
            }
            for (let i = 0; i <= segment.ndxl.trianglesCCW.length - 3; i += 3)
                trianglesCCW.push(segment.ndxl.trianglesCCW[i], segment.ndxl.trianglesCCW[i + 1], segment.ndxl.trianglesCCW[i + 2]);
        }

        if (trianglesCCW.length > 0)
            for (let index of trianglesCCW)
                mergedTris.push(index + vertexOffset);

        geometryGroups.push({
            start: indexOffset,
            count: trianglesCCW.length,
            materialIndex: segment.mati,
        });

        indexOffset += trianglesCCW.length;
        vertexOffset += segment.posl.vertexCount;
    }

    const geometry = new THREE.BufferGeometry();
    if (mergedPositions.length > 0) geometry.setAttribute("position", new THREE.Float32BufferAttribute(mergedPositions, 3));
    if (mergedNormals.length > 0) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mergedNormals, 3));
    if (mergedUVs.length > 0) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mergedUVs, 2));
    if (mergedColors.length > 0) geometry.setAttribute("color", new THREE.Float32BufferAttribute(mergedColors, 4));
    if (mergedTris.length > 0 && mergedPositions.length > 0) geometry.setIndex(new THREE.Uint16BufferAttribute(mergedTris, 1));

    const assignedMaterials = [];
    const matiMap = new Map();
    for (let group of geometryGroups) {
        const mati = group.materialIndex;
        let localMati = matiMap.has(mati) ? matiMap.get(mati) : (assignedMaterials.push(this.materials[mati].three), assignedMaterials.length - 1);
        matiMap.set(mati, localMati);
        geometry.addGroup(group.start, group.count, localMati);
    }

    return { geometry, assignedMaterials };
};

const TO_LOWER = new Uint8Array([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
    0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
    0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
    0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,
    0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
    0x40, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,
    0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f,
    0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77,
    0x78, 0x79, 0x7a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f,
    0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,
    0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f,
    0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77,
    0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f,
    0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f,
    0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
    0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,
    0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf,
    0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7,
    0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf,
    0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7,
    0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
    0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
    0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xdf,
    0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7,
    0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xee, 0xef,
    0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7,
    0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff,
]);

const TABLE_32 = new Uint32Array([
    0x00000000, 0x04C11DB7, 0x09823B6E, 0x0D4326D9,
    0x130476DC, 0x17C56B6B, 0x1A864DB2, 0x1E475005,
    0x2608EDB8, 0x22C9F00F, 0x2F8AD6D6, 0x2B4BCB61,
    0x350C9B64, 0x31CD86D3, 0x3C8EA00A, 0x384FBDBD,
    0x4C11DB70, 0x48D0C6C7, 0x4593E01E, 0x4152FDA9,
    0x5F15ADAC, 0x5BD4B01B, 0x569796C2, 0x52568B75,
    0x6A1936C8, 0x6ED82B7F, 0x639B0DA6, 0x675A1011,
    0x791D4014, 0x7DDC5DA3, 0x709F7B7A, 0x745E66CD,
    0x9823B6E0, 0x9CE2AB57, 0x91A18D8E, 0x95609039,
    0x8B27C03C, 0x8FE6DD8B, 0x82A5FB52, 0x8664E6E5,
    0xBE2B5B58, 0xBAEA46EF, 0xB7A96036, 0xB3687D81,
    0xAD2F2D84, 0xA9EE3033, 0xA4AD16EA, 0xA06C0B5D,
    0xD4326D90, 0xD0F37027, 0xDDB056FE, 0xD9714B49,
    0xC7361B4C, 0xC3F706FB, 0xCEB42022, 0xCA753D95,
    0xF23A8028, 0xF6FB9D9F, 0xFBB8BB46, 0xFF79A6F1,
    0xE13EF6F4, 0xE5FFEB43, 0xE8BCCD9A, 0xEC7DD02D,
    0x34867077, 0x30476DC0, 0x3D044B19, 0x39C556AE,
    0x278206AB, 0x23431B1C, 0x2E003DC5, 0x2AC12072,
    0x128E9DCF, 0x164F8078, 0x1B0CA6A1, 0x1FCDBB16,
    0x018AEB13, 0x054BF6A4, 0x0808D07D, 0x0CC9CDCA,
    0x7897AB07, 0x7C56B6B0, 0x71159069, 0x75D48DDE,
    0x6B93DDDB, 0x6F52C06C, 0x6211E6B5, 0x66D0FB02,
    0x5E9F46BF, 0x5A5E5B08, 0x571D7DD1, 0x53DC6066,
    0x4D9B3063, 0x495A2DD4, 0x44190B0D, 0x40D816BA,
    0xACA5C697, 0xA864DB20, 0xA527FDF9, 0xA1E6E04E,
    0xBFA1B04B, 0xBB60ADFC, 0xB6238B25, 0xB2E29692,
    0x8AAD2B2F, 0x8E6C3698, 0x832F1041, 0x87EE0DF6,
    0x99A95DF3, 0x9D684044, 0x902B669D, 0x94EA7B2A,
    0xE0B41DE7, 0xE4750050, 0xE9362689, 0xEDF73B3E,
    0xF3B06B3B, 0xF771768C, 0xFA325055, 0xFEF34DE2,
    0xC6BCF05F, 0xC27DEDE8, 0xCF3ECB31, 0xCBFFD686,
    0xD5B88683, 0xD1799B34, 0xDC3ABDED, 0xD8FBA05A,
    0x690CE0EE, 0x6DCDFD59, 0x608EDB80, 0x644FC637,
    0x7A089632, 0x7EC98B85, 0x738AAD5C, 0x774BB0EB,
    0x4F040D56, 0x4BC510E1, 0x46863638, 0x42472B8F,
    0x5C007B8A, 0x58C1663D, 0x558240E4, 0x51435D53,
    0x251D3B9E, 0x21DC2629, 0x2C9F00F0, 0x285E1D47,
    0x36194D42, 0x32D850F5, 0x3F9B762C, 0x3B5A6B9B,
    0x0315D626, 0x07D4CB91, 0x0A97ED48, 0x0E56F0FF,
    0x1011A0FA, 0x14D0BD4D, 0x19939B94, 0x1D528623,
    0xF12F560E, 0xF5EE4BB9, 0xF8AD6D60, 0xFC6C70D7,
    0xE22B20D2, 0xE6EA3D65, 0xEBA91BBC, 0xEF68060B,
    0xD727BBB6, 0xD3E6A601, 0xDEA580D8, 0xDA649D6F,
    0xC423CD6A, 0xC0E2D0DD, 0xCDA1F604, 0xC960EBB3,
    0xBD3E8D7E, 0xB9FF90C9, 0xB4BCB610, 0xB07DABA7,
    0xAE3AFBA2, 0xAAFBE615, 0xA7B8C0CC, 0xA379DD7B,
    0x9B3660C6, 0x9FF77D71, 0x92B45BA8, 0x9675461F,
    0x8832161A, 0x8CF30BAD, 0x81B02D74, 0x857130C3,
    0x5D8A9099, 0x594B8D2E, 0x5408ABF7, 0x50C9B640,
    0x4E8EE645, 0x4A4FFBF2, 0x470CDD2B, 0x43CDC09C,
    0x7B827D21, 0x7F436096, 0x7200464F, 0x76C15BF8,
    0x68860BFD, 0x6C47164A, 0x61043093, 0x65C52D24,
    0x119B4BE9, 0x155A565E, 0x18197087, 0x1CD86D30,
    0x029F3D35, 0x065E2082, 0x0B1D065B, 0x0FDC1BEC,
    0x3793A651, 0x3352BBE6, 0x3E119D3F, 0x3AD08088,
    0x2497D08D, 0x2056CD3A, 0x2D15EBE3, 0x29D4F654,
    0xC5A92679, 0xC1683BCE, 0xCC2B1D17, 0xC8EA00A0,
    0xD6AD50A5, 0xD26C4D12, 0xDF2F6BCB, 0xDBEE767C,
    0xE3A1CBC1, 0xE760D676, 0xEA23F0AF, 0xEEE2ED18,
    0xF0A5BD1D, 0xF464A0AA, 0xF9278673, 0xFDE69BC4,
    0x89B8FD09, 0x8D79E0BE, 0x803AC667, 0x84FBDBD0,
    0x9ABC8BD5, 0x9E7D9662, 0x933EB0BB, 0x97FFAD0C,
    0xAFB010B1, 0xAB710D06, 0xA6322BDF, 0xA2F33668,
    0xBCB4666D, 0xB8757BDA, 0xB5365D03, 0xB1F740B4,
]);