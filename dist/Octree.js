"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var three_1 = require("three");
var OctreeNode_1 = require("./OctreeNode");
var utils_1 = require("./utils");
var OctreeObjectData_1 = require("./OctreeObjectData");
var Octree = /** @class */ (function () {
    function Octree(parameters) {
        if (parameters === void 0) { parameters = {}; }
        // static properties ( modification is not recommended )
        this.nodeCount = 0;
        this.INDEX_INSIDE_CROSS = -1;
        this.INDEX_OUTSIDE_OFFSET = 2;
        this.INDEX_OUTSIDE_MAP = [];
        this.utilVec31Search = new three_1.Vector3();
        this.utilVec32Search = new three_1.Vector3();
        this.objects = [];
        this.objectsMap = {};
        this.objectsData = [];
        this.objectsDeferred = [];
        this.undeferred = false;
        parameters.tree = this;
        this.INDEX_OUTSIDE_POS_X = utils_1.isNumber(parameters.INDEX_OUTSIDE_POS_X) ? parameters.INDEX_OUTSIDE_POS_X : 0;
        this.INDEX_OUTSIDE_NEG_X = utils_1.isNumber(parameters.INDEX_OUTSIDE_NEG_X) ? parameters.INDEX_OUTSIDE_NEG_X : 1;
        this.INDEX_OUTSIDE_POS_Y = utils_1.isNumber(parameters.INDEX_OUTSIDE_POS_Y) ? parameters.INDEX_OUTSIDE_POS_Y : 2;
        this.INDEX_OUTSIDE_NEG_Y = utils_1.isNumber(parameters.INDEX_OUTSIDE_NEG_Y) ? parameters.INDEX_OUTSIDE_NEG_Y : 3;
        this.INDEX_OUTSIDE_POS_Z = utils_1.isNumber(parameters.INDEX_OUTSIDE_POS_Z) ? parameters.INDEX_OUTSIDE_POS_Z : 4;
        this.INDEX_OUTSIDE_NEG_Z = utils_1.isNumber(parameters.INDEX_OUTSIDE_NEG_Z) ? parameters.INDEX_OUTSIDE_NEG_Z : 5;
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_POS_X] = { index: this.INDEX_OUTSIDE_POS_X, count: 0, x: 1, y: 0, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_NEG_X] = { index: this.INDEX_OUTSIDE_NEG_X, count: 0, x: -1, y: 0, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_POS_Y] = { index: this.INDEX_OUTSIDE_POS_Y, count: 0, x: 0, y: 1, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_NEG_Y] = { index: this.INDEX_OUTSIDE_NEG_Y, count: 0, x: 0, y: -1, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_POS_Z] = { index: this.INDEX_OUTSIDE_POS_Z, count: 0, x: 0, y: 0, z: 1 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_NEG_Z] = { index: this.INDEX_OUTSIDE_NEG_Z, count: 0, x: 0, y: 0, z: -1 };
        // pass scene to see octree structure
        this.scene = parameters.scene;
        if (this.scene) {
            this.visualGeometry = new three_1.BoxBufferGeometry(1, 1, 1);
            this.visualMaterial = new three_1.MeshBasicMaterial({
                color: 0xff0066,
                wireframe: true,
                wireframeLinewidth: 1
            });
        }
        // properties
        this.depthMax = utils_1.isNumber(parameters.depthMax) ? parameters.depthMax : Infinity;
        this.objectsThreshold = utils_1.isNumber(parameters.objectsThreshold) ? parameters.objectsThreshold : 8;
        this.overlapPct = utils_1.isNumber(parameters.overlapPct) ? parameters.overlapPct : 0.15;
        this.undeferred = parameters.undeferred || false;
        this.root = parameters.root instanceof OctreeNode_1.OctreeNode ? parameters.root : new OctreeNode_1.OctreeNode(parameters);
    }
    Octree.prototype.update = function () {
        // add any deferred objects that were waiting for render cycle
        if (this.objectsDeferred.length > 0) {
            for (var i = 0, il = this.objectsDeferred.length; i < il; i++) {
                var _a = this.objectsDeferred[i], object = _a.object, options = _a.options;
                this.addDeferred(object, options);
            }
            this.objectsDeferred.length = 0;
        }
    };
    Octree.prototype.add = function (object, options) {
        if (this.undeferred) {
            // add immediately
            this.updateObject(object);
            this.addDeferred(object, options);
        }
        else {
            // defer add until update called
            this.objectsDeferred.push({ object: object, options: options });
        }
    };
    Octree.prototype.addDeferred = function (object, options) {
        // ensure object is not object data
        if (object instanceof OctreeObjectData_1.OctreeObjectData) {
            object = object.object;
        }
        // check uuid to avoid duplicates
        if (!object.uuid) {
            object.uuid = three_1.MathUtils.generateUUID();
        }
        if (!this.objectsMap[object.uuid]) {
            // store
            this.objects.push(object);
            this.objectsMap[object.uuid] = object;
            // check options
            var useFaces = false;
            var useVertices = false;
            if (options) {
                useFaces = options.useFaces;
                useVertices = options.useVertices;
            }
            if (useVertices === true) {
                // TODO: support InterleavedBuffer/InterleavedBufferAttribute?
                if (object.geometry instanceof three_1.BufferGeometry && object.geometry.attributes.position instanceof three_1.BufferAttribute) {
                    var position = object.geometry.attributes.position;
                    for (var i = 0, l = position.count; i < l; i++) {
                        this.addObjectData(object, new three_1.Vector3().fromBufferAttribute(position, i));
                    }
                }
                else if (object.geometry instanceof three_1.Geometry) {
                    var vertices = object.geometry.vertices;
                    for (var i = 0, l = vertices.length; i < l; i++) {
                        this.addObjectData(object, vertices[i]);
                    }
                }
            }
            else if (useFaces === true) {
                if (object.geometry instanceof three_1.BufferGeometry) {
                    var position = object.geometry.attributes.position;
                    var index = object.geometry.index;
                    // TODO: support face/vertex normals and colors?
                    if (index) {
                        // indexed triangles
                        for (var i = 0, l = index.count; i < l; i += 3) {
                            this.addObjectData(object, new three_1.Face3(i, i + 1, i + 2));
                        }
                    }
                    else {
                        // every 3 vertices are one triangle
                        for (var i = 0, l = position.count; i < l; i += 3) {
                            this.addObjectData(object, new three_1.Face3(i, i + 1, i + 2));
                        }
                    }
                }
                else if (object.geometry instanceof three_1.Geometry) {
                    var faces = object.geometry.faces;
                    for (var i = 0, l = faces.length; i < l; i++) {
                        this.addObjectData(object, faces[i]);
                    }
                }
            }
            else {
                this.addObjectData(object);
            }
        }
    };
    Octree.prototype.addObjectData = function (object, part) {
        var objectData = new OctreeObjectData_1.OctreeObjectData(object, part);
        // add to tree objects data list
        this.objectsData.push(objectData);
        // add to nodes
        this.root.addObject(objectData);
    };
    Octree.prototype.remove = function (object) {
        // ensure object is not object data for index search
        if (object instanceof OctreeObjectData_1.OctreeObjectData) {
            object = object.object;
        }
        // check uuid
        if (this.objectsMap[object.uuid]) {
            this.objectsMap[object.uuid] = undefined;
            // check and remove from objects, nodes, and data lists
            var index = this.objects.indexOf(object);
            if (index !== -1) {
                this.objects.splice(index, 1);
                // remove from nodes
                var objectsDataRemoved = this.root.removeObject(object);
                // remove from objects data list
                for (var i = 0, l = objectsDataRemoved.length; i < l; i++) {
                    var objectData = objectsDataRemoved[i];
                    var indexData = this.objectsData.indexOf(objectData);
                    if (indexData !== -1) {
                        this.objectsData.splice(indexData, 1);
                    }
                }
            }
        }
        else if (this.objectsDeferred.length > 0) {
            // check and remove from deferred
            var index = utils_1.indexOfPropertyWithValue(this.objectsDeferred, 'object', object);
            if (index !== -1) {
                this.objectsDeferred.splice(index, 1);
            }
        }
    };
    Octree.prototype.extend = function (octree) {
        if (octree instanceof Octree) {
            // for each object data
            var objectsData = octree.objectsData;
            for (var i = 0, l = objectsData.length; i < l; i++) {
                var objectData = objectsData[i];
                this.add(objectData, { useFaces: objectData.useFaces, useVertices: objectData.useVertices });
            }
        }
    };
    Octree.prototype.rebuild = function () {
        var objectsUpdate = [];
        // check all object data for changes in position
        // assumes all object matrices are up to date
        for (var i = 0, l = this.objectsData.length; i < l; i++) {
            var objectData = this.objectsData[i];
            var node = objectData.node;
            // update object
            objectData.update();
            // if position has changed since last organization of object in tree
            if (node instanceof OctreeNode_1.OctreeNode && !objectData.positionLast.equals(objectData.position)) {
                // get octant index of object within current node
                var indexOctantLast = objectData.indexOctant;
                var indexOctant = node.getOctantIndex(objectData);
                // if object octant index has changed
                if (indexOctant !== indexOctantLast) {
                    // add to update list
                    objectsUpdate.push(objectData);
                }
            }
        }
        // update changed objects
        for (var i = 0, l = objectsUpdate.length; i < l; i++) {
            var objectData = objectsUpdate[i];
            // remove object from current node
            objectData.node.removeObject(objectData);
            // add object to tree root
            this.root.addObject(objectData);
        }
    };
    Octree.prototype.updateObject = function (object) {
        if (object instanceof OctreeObjectData_1.OctreeObjectData) {
            object = object.object;
        }
        // search all parents between object and root for world matrix update
        var parentCascade = [object];
        var parent = object.parent;
        var parentUpdate;
        while (parent) {
            parentCascade.push(parent);
            parent = parent.parent;
        }
        for (var i = 0, l = parentCascade.length; i < l; i++) {
            parent = parentCascade[i];
            if (parent.matrixWorldNeedsUpdate) {
                parentUpdate = parent;
            }
        }
        // update world matrix starting at uppermost parent that needs update
        if (typeof parentUpdate !== 'undefined') {
            parentUpdate.updateMatrixWorld();
        }
    };
    Octree.prototype.search = function (position, radius, organizeByObject, direction) {
        var directionPct;
        // add root objects
        var objects = [].concat(this.root.objects);
        // ensure radius (i.e. distance of ray) is a number
        if (!(radius > 0)) {
            radius = Number.MAX_VALUE;
        }
        // if direction passed, normalize and pct
        if (direction instanceof three_1.Vector3) {
            direction = direction.clone().normalize();
            directionPct = new three_1.Vector3(1, 1, 1).divide(direction);
        }
        // search each node of root
        for (var i = 0, l = this.root.nodesIndices.length; i < l; i++) {
            var node = this.root.nodesByIndex[this.root.nodesIndices[i]];
            objects = node.search(position, radius, objects, direction, directionPct);
        }
        // if should organize results by object
        if (organizeByObject === true) {
            var results = [];
            var resultsObjectsIndices = [];
            var resultData = void 0;
            // for each object data found
            for (var i = 0, l = objects.length; i < l; i++) {
                var objectData = objects[i];
                var object = objectData.object;
                var resultObjectIndex = resultsObjectsIndices.indexOf(object);
                // if needed, create new result data
                if (resultObjectIndex === -1) {
                    resultData = {
                        object: object,
                        faces: [],
                        vertices: []
                    };
                    results.push(resultData);
                    resultsObjectsIndices.push(object);
                }
                else {
                    resultData = results[resultObjectIndex];
                }
                // object data has faces or vertices, add to list
                if (objectData.faces) {
                    resultData.faces.push(objectData.faces);
                }
                else {
                    resultData.vertices.push(objectData.vertices);
                }
            }
            return results;
        }
        else {
            return objects;
        }
    };
    Octree.prototype.findClosestVertex = function (position, radius) {
        var search = this.search(position, radius, true);
        if (!search[0]) {
            return null;
        }
        var object = search[0].object;
        var vertices = search[0].vertices;
        if (vertices.length === 0) {
            return null;
        }
        var distance;
        var vertex = null;
        var localPosition = object.worldToLocal(position.clone());
        for (var i = 0, l = vertices.length; i < l; i++) {
            distance = vertices[i].distanceTo(localPosition);
            if (distance > radius) {
                continue;
            }
            // use distance in new comparison to find the closest point
            radius = distance;
            vertex = vertices[i];
        }
        if (vertex === null) {
            return null;
        }
        return object.localToWorld(vertex.clone());
    };
    Octree.prototype.setRoot = function (root) {
        if (root instanceof OctreeNode_1.OctreeNode) {
            // store new root
            this.root = root;
            // update properties
            this.root.updateProperties();
        }
    };
    Octree.prototype.getDepthEnd = function () {
        return this.root.getDepthEnd();
    };
    Octree.prototype.getNodeCountEnd = function () {
        return this.root.getNodeCountEnd();
    };
    Octree.prototype.getObjectCountEnd = function () {
        return this.root.getObjectsCountEnd();
    };
    Octree.prototype.toConsole = function () {
        this.root.toConsole();
    };
    return Octree;
}());
exports.Octree = Octree;
