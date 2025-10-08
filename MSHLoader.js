"use strict";
// mshLoader.js - Loads a binary msh file into Three.js
// (c) 2025 by Landon Hull aka Calrissian97
// This code is licensed under APACHE 2.0 license

import * as THREE from "three";

// mshLoader class for parsing msh files
export class MSHLoader extends THREE.Loader {
    constructor(manager) {
        if (!manager) throw new Error("THREE.MSHLoader: Manager is undefined.");
        super(manager);
        // MSH file data
        this.sceneInfo = null;
        this.models = null;
        this.materials = null;
        this.textures = null;
        // File op globals
        this.buffer = null;
        this.byteOffset = null;
        this.debug = true;
    }
    destroy() {
        this.buffer = null;
        this.byteOffset = null;
        this.sceneInfo = null;
        this.models = null;
        this.materials = null;
        this.textures = null;
    }

    load(url, onLoad, onProgress, onError) {
        const scope = this;
        const manager = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;
        this._setupLoader(manager).load(url, function (arrayBuffer) {
            try {
                const scene = scope.parse(arrayBuffer, url);
                if (onLoad) onLoad(scene);
                if (scope.debug) console.log("File" + url + "parsed.");
            } catch (e) {
                if (onError) onError(e);
                else
                    console.error("Error parsing msh:", e);
                manager.itemError(url);
            }
        }, onProgress, onError);
    }

    async loadAsync(url, onProgress) {
        const scope = this;
        const manager = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;
        const loader = this._setupLoader(manager);
        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (data) => {
                    try {
                        resolve(scope.parse(data, url));
                        if (scope.debug) console.log("File" + url + "parsed.");
                    } catch (e) {
                        reject(e);
                        console.error("Error parsing msh:", e);
                        manager.itemError(url);
                    }
                },
                onProgress,
                (error) => { // This is the onError callback for FileLoader
                    reject(error);
                    console.error("Error loading file", url + ":", error);
                }
            );
        });
    }

    setPath(path) {
        super.setPath(path); return this;
    }

    // Parse the input arrayBuffer for scene data, construct THREE objects, and return a THREE Group
    parse(arrayBuffer, url) {
        try {
            // Initialize globals
            this.buffer = new DataView(arrayBuffer);
            this.byteOffset = 0;
            this.models = [];
            this.materials = [];
            this.textures = new Set();
        } catch (error) { console.error("parse::Error initializing MSHLoader:", error); }

        // Output scene
        const scene = new THREE.Group();

        // Read file data
        this.sceneInfo = this._readSceneInfo(this.buffer);
        this.materials = this._readMaterials(this.buffer);
        this.models = this._readGeometries(this.buffer);
        this.textures = Array.from(this.textures);
        if (this.debug) {
            console.log("parse::MSH file data read.")
            console.log("parse::Scene info:", this.sceneInfo);
            console.log("parse::Materials:", this.materials);
            console.log("parse::Textures:", this.textures);
            console.log("parse::Models:", this.models);
        }

        // Construct Three.js Material objects inside this.materials[x].three
        for (let material of this.materials) {
            let transparent = false, specular = false, specColor = null, diffColor = null;
            if (material.matd.atrb != null) {
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
                    // Colors are stored in BGRA format, convert to RGBA
                    specColor = new THREE.Color(material.matd.specularColor[2], material.matd.specularColor[1], material.matd.specularColor[0]);
                }
                if (material.matd.atrb.bitFlags.glow || material.matd.atrb.bitFlags.emissive || material.matd.atrb.renderFlags.glow)
                    material.glow = true;
                if (material.matd.atrb.renderFlags.scrolling)
                    material.scrolling = true;
                if (material.matd.atrb.renderFlags.pulsate)
                    material.pulsate = true;
                if (material.matd.atrb.renderFlags.chrome)
                    material.chrome = true;
            }
            diffColor = new THREE.Color(material.matd.diffuseColor[2], material.matd.diffuseColor[1], material.matd.diffuseColor[0]);
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
            material.three = threeMaterial;
        }
        if (this.debug) console.log("parse::THREE Materials constructed:", this.materials);

        // Unique map of models identified by name
        const modelsMap = new Map();

        // Construct Three.js Mesh objects in this.models[x].three
        for (let model of this.models) {
            // Assign visibility flag if not already (Some msh files don't have a flgs chunk)
            if (!model.modl.flgs) {
                if (model.name.toLowerCase().startsWith("sv_") || model.name.toLowerCase().startsWith("shadowvolume") || model.name.toLowerCase().endsWith("shadowvolume") ||
                    model.name.toLowerCase().startsWith("collision") || model.name.toLowerCase().endsWith("collision") || model.name.toLowerCase().startsWith("p_") ||
                    model.name.toLowerCase().endsWith("_lowrez") || model.name.toLowerCase().endsWith("_lowres") || model.name.toLowerCase().endsWith("_lod2") ||
                    model.name.toLowerCase().endsWith("_lod3") || model.name.toLowerCase().startsWith("hp_"))
                    model.modl.flgs = 1;
                // Otherwise assign it the visible value (0)
                else
                    model.modl.flgs = 0;
            }
            // If model has geometry, process its segm and clth chunks
            if (model.modl.geom) {
                // Merged segment data to construct a single geometry
                const mergedPositions = [];
                const mergedNormals = [];
                const mergedUVs = [];
                const mergedColors = [];
                const mergedTris = [];
                const geometryGroups = [];
                let vertexOffset = 0; // Running total of verts
                let indexOffset = 0; // Running total of indices

                // Loop through segments appending attributes to merged lists
                for (let segment of model.modl.geom.segments) {
                    //const attributes = {};
                    if (segment.posl.vertices) {
                        mergedPositions.push(...segment.posl.vertices);
                        //attributes.position = new THREE.Float32BufferAttribute(segment.posl.vertices, 3);
                    }
                    if (segment.nrml.normals) {
                        mergedNormals.push(...segment.nrml.normals);
                        //attributes.normal = new THREE.Float32BufferAttribute(segment.nrml.normals, 3);
                    }
                    if (segment.uv0l.uvs) {
                        mergedUVs.push(...segment.uv0l.uvs);
                        //attributes.uv = new THREE.Float32BufferAttribute(segment.uv0l.uvs, 2);
                    }
                    if (segment.clrl.colors) {
                        this.materials[segment.mati].three.vertexColors = true;
                        // Colors are stored in BGRA 0-255 format, convert to RGBA 0.0-1.0 for Three.js
                        const bgra = segment.clrl.colors;
                        const rgba = new Float32Array(bgra.length);
                        for (let i = 0; i < bgra.length; i += 4) {
                            rgba[i] = bgra[i + 2] / 255.0; // R <- B
                            rgba[i + 1] = bgra[i + 1] / 255.0; // G
                            rgba[i + 2] = bgra[i] / 255.0;     // B <- R
                            rgba[i + 3] = bgra[i + 3] / 255.0; // A
                        }
                        //attributes.color = new THREE.Float32BufferAttribute(rgba, 4);
                        mergedColors.push(...rgba);
                    } else if (segment.clrb.color) {
                        // Expand single color to all verts in the segment
                        const bgra = segment.clrb.color;
                        const vertexCount = segment.posl.vertexCount;
                        if (vertexCount > 0) {
                            this.materials[segment.mati].three.vertexColors = true;
                            const rgba = new Float32Array(vertexCount * 4);
                            for (let i = 0; i < vertexCount; i++) {
                                rgba[i * 4] = bgra[2] / 255.0; // R <- B
                                rgba[i * 4 + 1] = bgra[1] / 255.0; // G
                                rgba[i * 4 + 2] = bgra[0] / 255.0; // B <- R
                                rgba[i * 4 + 3] = bgra[3] / 255.0; // A
                            }
                            mergedColors.push(...rgba);
                        }
                    }
                    let trianglesCCW = [];
                    if (segment.ndxt.trianglesCCW) {
                        // Cleanup abberations
                        //segment.ndxt.trianglesCCW = this._cleanupTriangles(segment.ndxt.trianglesCCW, segment.posl.vertices);
                        for (let i = 0; i <= segment.ndxt.trianglesCCW.length - 3; i += 3) {
                            trianglesCCW.push(segment.ndxt.trianglesCCW[i], segment.ndxt.trianglesCCW[i + 1], segment.ndxt.trianglesCCW[i + 2]);
                        }
                    }
                    if (segment.strp.triangleStrips) {
                        // Unroll trianglestrips into a single list of triangles CCW for indexing
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
                        // Cleanup abberations
                        //segment.strp.trianglesCCW = this._cleanupTriangles(segment.strp.trianglesCCW, segment.posl.vertices);
                        for (let i = 0; i <= segment.strp.trianglesCCW.length - 3; i += 3) {
                            trianglesCCW.push(segment.strp.trianglesCCW[i], segment.strp.trianglesCCW[i + 1], segment.strp.trianglesCCW[i + 2]);
                        }
                    }
                    if (segment.ndxl.polygons) {
                        // Use triangulation algo to push quads into tris for the ndxl.triangles buffer.
                        segment.ndxl.trianglesCCW = [];
                        for (const polygon of segment.ndxl.polygons) {
                            if (polygon.length < 3) continue;
                            const v0 = polygon[0];
                            for (let i = 1; i < polygon.length - 1; i++) segment.ndxl.trianglesCCW.push(v0, polygon[i], polygon[i + 1]);
                        }
                        // Cleanup abberations
                        //segment.ndxl.trianglesCCW = this._cleanupTriangles(segment.ndxl.trianglesCCW, segment.posl.vertices);
                        for (let i = 0; i <= segment.ndxl.trianglesCCW.length - 3; i += 3) {
                            trianglesCCW.push(segment.ndxl.trianglesCCW[i], segment.ndxl.trianglesCCW[i + 1], segment.ndxl.trianglesCCW[i + 2]);
                        }
                    }
                    // Append segment indices
                    if (trianglesCCW.length > 0)
                        for (let index of trianglesCCW)
                            mergedTris.push(index + vertexOffset);

                    // Record a Group for this segment
                    geometryGroups.push({
                        start: indexOffset,
                        count: trianglesCCW.length,
                        materialIndex: segment.mati,
                    });

                    // Increment offsets
                    indexOffset += trianglesCCW.length;
                    vertexOffset += segment.posl.vertexCount;
                    /*
                    // Append segment attributes
                    if (Object.keys(attributes).length > 0) {
                        // From here each segment will append their geometry data into model.modl.geom
                        if (model.modl.geom.attributes != null)
                            for (const key in attributes)
                                model.modl.geom.attributes[key].push(...attributes[key]);
                        else
                            model.modl.geom.attributes = attributes;

                        if (model.modl.geom.trianglesCCW == null)
                            model.modl.geom.trianglesCCW = trianglesCCW;
                        else
                            model.modl.geom.trianglesCCW.push(...trianglesCCW);

                        const geometry = new THREE.BufferGeometry();
                        for (const key in attributes) geometry.setAttribute(key, attributes[key]);
                        // Instead of this use both segments then merge after
                        geometry.setIndex(new THREE.Uint16BufferAttribute(trianglesCCW, 1));
                        const mesh = new THREE.Mesh(geometry, this.materials[segment.mati].three);
                        mesh.name = model.name + "_" + this.materials[segment.mati].name;
                        if (model.name.toLowerCase().startsWith("sv_") || model.name.toLowerCase().includes("shadowvolume")) {
                            mesh.userData.isShadowVolume = true;
                        }

                        if (model.three != null && model.three.isMesh === true) {
                            // Push extra meshes to scene manually
                            // This is temp and adds extra meshes, meshes should be constructed as one group
                            scene.add(mesh);
                        } else {
                            // First mesh
                            model.three = mesh;
                        }
                    }
                    */
                }

                // Create geometry for this model
                const geometry = new THREE.BufferGeometry();
                // Set attributes (positions, normals, uvs, colors)
                if (mergedPositions.length > 0)
                    geometry.setAttribute("position", new THREE.Float32BufferAttribute(mergedPositions, 3));
                if (mergedNormals.length > 0)
                    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mergedNormals, 3));
                if (mergedUVs.length > 0)
                    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mergedUVs, 2));
                if (mergedColors.length > 0)
                    geometry.setAttribute("color", new THREE.Float32BufferAttribute(mergedColors, 4));
                // Set indices (CCW triangles)
                if (mergedTris.length > 0)
                    if (mergedPositions.length > 0) {
                        // Cleanup abberations -- note that this cleanup can cause errors, needs further work
                        //const cleanedTris = this._cleanupTriangles(mergedTris, mergedPositions);
                        geometry.setIndex(new THREE.Uint16BufferAttribute(mergedTris, 1));
                    }

                // Array of THREE materials actually assigned to this geometry
                const assignedMaterials = [];
                // Map to track mati -> local mesh material index
                const matiMap = new Map();
                // Add groups and build materials array
                for (let group of geometryGroups) {
                    const mati = group.materialIndex;
                    let localMati = 0;
                    // If already present simply get localMati
                    if (matiMap.has(mati)) {
                        localMati = matiMap.get(mati);
                    } else {
                        // Add material to assignedMaterials
                        const material = this.materials[mati].three;
                        assignedMaterials.push(material);
                        localMati = assignedMaterials.length - 1;
                        matiMap.set(mati, localMati);
                    }
                    geometry.addGroup(group.start, group.count, localMati);
                }

                // Create multi-material mesh
                const mesh = new THREE.Mesh(geometry, assignedMaterials);
                mesh.name = model.name;
                // If vertex colors are present then add flag to userData
                if (mesh.geometry.attributes.color != null && mesh.geometry.attributes.color.count > 0)
                    mesh.userData.hasVertexColors = true;
                model.three = mesh;
                // Construct and add cloth meshes as children
                for (let cloth of model.modl.geom.cloth) {
                    const geometry = new THREE.BufferGeometry();
                    if (cloth.cpos.vertices)
                        geometry.setAttribute("position", new THREE.Float32BufferAttribute(cloth.cpos.vertices, 3));
                    if (cloth.cuv0.uvs)
                        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(cloth.cuv0.uvs, 2));
                    if (cloth.cmsh.trianglesCCW)
                        geometry.setIndex(new THREE.Uint32BufferAttribute(cloth.cmsh.trianglesCCW, 1));
                    // Override vertexColors to white
                    if (cloth.cpos.vertices) {
                        // Create and set vertex colors to white since cloth meshes don't have them
                        const vertexCount = cloth.cpos.vertices.length / 3;
                        const colors = new Float32Array(vertexCount * 4);
                        for (let i = 0; i < vertexCount; i++) {
                            colors[i * 4] = 1.0;     // R
                            colors[i * 4 + 1] = 1.0; // G
                            colors[i * 4 + 2] = 1.0; // B
                            colors[i * 4 + 3] = 1.0; // A
                        }
                        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
                        geometry.computeVertexNormals();
                    }

                    const clothMat = new THREE.MeshPhongMaterial({
                        name: "clothMaterial_" + cloth.name,
                        shininess: 0.0,
                        transparent: true,
                        side: THREE.DoubleSide,
                        wireframe: true,
                        vertexColors: true,
                    });
                    const material = {
                        name: "clothMaterial_" + cloth.name,
                        three: clothMat,
                        texture: cloth.ctex,
                    };
                    this.materials.push(material);
                    if (this.debug) console.log("parse::Material", material.name, "created for cloth", cloth.name + ".");

                    const mesh = new THREE.Mesh(geometry, this.materials.at(-1).three);
                    mesh.name = model.name + "_cloth_" + cloth.name;
                    mesh.userData.isCloth = true;
                    model.three.add(mesh);
                    if (this.debug) console.log("parse::Mesh created for cloth", cloth.name + ":", mesh);
                }
            } else {
                model.three = new THREE.Object3D();
                model.three.name = model.name;
            }
            // Apply transforms (Scale is ignored ingame)
            model.three.position.set(model.modl.tran.translation[0], model.modl.tran.translation[1], model.modl.tran.translation[2]);
            model.three.quaternion.set(model.modl.tran.rotation[0], model.modl.tran.rotation[1], model.modl.tran.rotation[2], model.modl.tran.rotation[3]);
            //model.three.scale.set(scales[0], scales[1], scales[2]);
            modelsMap.set(model.name.toLowerCase(), model);
        }
        if (this.debug) console.log("parse::THREE Meshes constructed:", this.models);

        // Add models to their parent models or to the scene
        // Adjust visibility of meshes, flag scene if cloth is present
        for (let model of this.models) {
            if (model.modl.prnt) {
                const parent = modelsMap.get(model.modl.prnt.toLowerCase());
                if (parent) {
                    parent.three.add(model.three);
                    if (this.debug) console.log("parse::Model", model.name, "added to parent model", parent.name + ".");
                }
                else {
                    console.error("parse::Parent model not found for model:", model.name);
                }
            } else {
                // If no parent, add to scene
                scene.add(model.three);
                if (this.debug) console.log("parse::Model", model.name, "added to scene.");
            }
            // Adjust visibility of meshes regardless of lineage
            if (model.three.isMesh) {
                // Visibility determined by flgs
                model.three.visible = model.modl.flgs !== 1;
                // Override visibility for bones
                if (model.three.name.toLowerCase().includes("bone")) model.three.visible = true;
            }
            else model.three.visible = true;
            // If model is a cloth, add flag to scene userData
            if (model.modl.geom && model.modl.geom.cloth && model.modl.geom.cloth.length > 0) {
                scene.userData.hasCloth = true;
            }
            // If model is a shadowvolume, add flag to scene userData
            if (model.three.userData.isShadowVolume) scene.userData.hasShadowVolume = true;
            // If model has vertex colors, add flag to scene userData
            if (model.three.userData.hasVertexColors) scene.userData.hasVertexColors = true;
        }
        if (this.debug) console.log("parse::THREE Meshes and Materials added to output THREE Group scene.");
        scene.userData.textures = Array.from(this.textures);
        scene.userData.materials = this.materials;
        scene.userData.models = this.models;
        scene.userData.sceneInfo = this.sceneInfo;
        scene.name = this.sceneInfo.name;
        if (this.debug) console.log("parse::Scene userData objects assigned, scene ready:", scene);
        return scene;
    }

    // Read scene info from SINF chunk and return object
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
        // NAME
        byteOffset += 4;
        sceneNameLength = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        name = this._readString(buffer, byteOffset, sceneNameLength);
        byteOffset += sceneNameLength;
        // FRAM
        byteOffset += 8;
        frameStart = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        frameEnd = this._readUint32LE(buffer, byteOffset);
        byteOffset += 4;
        fps = this._readFloat32LE(buffer, byteOffset);
        byteOffset += 4;
        // BBOX
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

    // Read all materials from MATL chunk and return an array of objects
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
            // NAME and DATA
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
                        scrolling: renderType === 3,
                        specular: renderType === 4,
                        glossmap: renderType === 5,
                        chrome: renderType === 6,
                        animated: renderType === 7,
                        ice: renderType === 8,
                        detail: renderType === 11,
                        refracted: renderType === 22,
                        emboss: renderType === 23,
                        wireframe: renderType === 24,
                        pulsate: renderType === 25,
                        bumpmap: renderType === 27,
                        bumpmapAndGlossmap: renderType === 28,
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

    // Read all geometries from MODL chunks and return an array of objects
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
                geom = { segments: [], cloth: [] };
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
                            wght: null,
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
                            name: byteOffset,
                            ctex: "",
                            cpos: { vertexCount: 0, vertices: null },
                            cuv0: { uvCount: 0, uvs: null },
                            fidx: { pointCount: 0, fixedPoints: null },
                            fwgt: { pointCount: 0, boneName: "" },
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
                        geom.cloth.push(clth);
                        byteOffset = clothEnd;
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
                    geom
                }
            });
        }
        return models;
    }

    // Remove degenerate (zero-area or duplicate) triangles
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

    // Remove duplicate vertices within a threshold
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

    // Setup THREE file loader
    _setupLoader(manager) {
        manager = manager !== undefined ? manager : THREE.DefaultLoadingManager;
        const loader = new THREE.FileLoader(manager);
        loader.setPath(this.path)
            .setWithCredentials(this.withCredentials)
            .setRequestHeader(this.requestHeader)
            .setResponseType("arraybuffer");
        return loader;
    }

    // Utility function to find a chunk by its header
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

    // Utility function to find all instances of a chunk by its header
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

    // Utility functions for reading binary data in little endian w/safety checks
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
}
