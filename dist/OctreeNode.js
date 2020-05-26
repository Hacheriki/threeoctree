"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var OctreeObjectData_1 = require("./OctreeObjectData");
var Octree_1 = require("./Octree");
var three_1 = require("three");
var OctreeNode = /** @class */ (function () {
    function OctreeNode(parameters) {
        // store or create tree
        if (parameters === void 0) { parameters = {}; }
        this.objects = [];
        this.nodesIndices = [];
        this.nodesByIndex = {};
        if (parameters.tree instanceof Octree_1.Octree) {
            this.tree = parameters.tree;
        }
        else if (!(parameters.parent instanceof OctreeNode)) {
            parameters.root = this;
            this.tree = new Octree_1.Octree(parameters);
        }
        // basic properties
        this.id = this.tree.nodeCount++;
        this.position = parameters.position instanceof three_1.Vector3 ? parameters.position : new three_1.Vector3();
        this.radius = parameters.radius > 0 ? parameters.radius : 1;
        this.indexOctant = parameters.indexOctant;
        this.depth = 0;
        // reset and assign parent
        this.reset();
        this.setParent(parameters.parent);
        // additional properties
        this.overlap = this.radius * this.tree.overlapPct;
        this.radiusOverlap = this.radius + this.overlap;
        this.left = this.position.x - this.radiusOverlap;
        this.right = this.position.x - this.radiusOverlap;
        this.bottom = this.position.y - this.radiusOverlap;
        this.top = this.position.y + this.radiusOverlap;
        this.back = this.position.z - this.radiusOverlap;
        this.front = this.position.z + this.radiusOverlap;
        // visual
        if (this.tree.scene) {
            this.visual = new three_1.Mesh(this.tree.visualGeometry, this.tree.visualMaterial);
            this.visual.scale.set(this.radiusOverlap * 2, this.radiusOverlap * 2, this.radiusOverlap * 2);
            this.visual.position.copy(this.position);
            this.tree.scene.add(this.visual);
        }
    }
    OctreeNode.prototype.setParent = function (parent) {
        // store new parent
        if (parent !== this && this.parent !== parent) {
            this.parent = parent;
            // update properties
            this.updateProperties();
        }
    };
    OctreeNode.prototype.updateProperties = function () {
        // properties
        if (this.parent instanceof OctreeNode) {
            this.tree = this.parent.tree;
            this.depth = this.parent.depth + 1;
        }
        else {
            this.depth = 0;
        }
        // cascade
        for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
            this.nodesByIndex[this.nodesIndices[i]].updateProperties();
        }
    };
    OctreeNode.prototype.reset = function (cascade, removeVisual) {
        if (cascade === void 0) { cascade = false; }
        if (removeVisual === void 0) { removeVisual = false; }
        this.objects = [];
        this.nodesIndices = [];
        this.nodesByIndex = {};
        // unset parent in nodes
        for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
            var node = this.nodesByIndex[this.nodesIndices[i]];
            node.setParent(undefined);
            if (cascade === true) {
                node.reset(cascade, removeVisual);
            }
        }
        // visual
        if (removeVisual === true && this.visual && this.visual.parent) {
            this.visual.parent.remove(this.visual);
        }
    };
    OctreeNode.prototype.addNode = function (node, indexOctant) {
        node.indexOctant = indexOctant;
        if (this.nodesIndices.indexOf(indexOctant) === -1) {
            this.nodesIndices.push(indexOctant);
        }
        this.nodesByIndex[indexOctant] = node;
        if (node.parent !== this) {
            node.setParent(this);
        }
    };
    OctreeNode.prototype.removeNode = function (indexOctant) {
        var index = this.nodesIndices.indexOf(indexOctant);
        this.nodesIndices.splice(index, 1);
        var node = this.nodesByIndex[indexOctant];
        delete this.nodesByIndex[indexOctant];
        if (node.parent === this) {
            node.setParent(undefined);
        }
    };
    OctreeNode.prototype.addObject = function (object) {
        // get object octant index
        var indexOctant = this.getOctantIndex(object);
        if (indexOctant > -1 && this.nodesIndices.length > 0) {
            // if object fully contained by an octant, add to subtree
            var node = this.branch(indexOctant);
            node.addObject(object);
        }
        else if (indexOctant < -1 && this.parent instanceof OctreeNode) {
            // if object lies outside bounds, add to parent node
            this.parent.addObject(object);
        }
        else {
            // add to this objects list
            var index = this.objects.indexOf(object);
            if (index === -1) {
                this.objects.push(object);
            }
            // node reference
            object.node = this;
            // check if need to expand, split, or both
            this.checkGrow();
        }
    };
    OctreeNode.prototype.addObjectWithoutCheck = function (objects) {
        for (var i = 0, l = objects.length; i < l; i++) {
            var object = objects[i];
            this.objects.push(object);
            object.node = this;
        }
    };
    OctreeNode.prototype.removeObject = function (object) {
        // cascade through tree to find and remove object
        var _a = this.removeObjectRecursive(object, {
            searchComplete: false,
            nodesRemovedFrom: [],
            objectsDataRemoved: []
        }), nodesRemovedFrom = _a.nodesRemovedFrom, objectsDataRemoved = _a.objectsDataRemoved;
        // if object removed, try to shrink the nodes it was removed from
        if (nodesRemovedFrom.length > 0) {
            for (var i = 0, l = nodesRemovedFrom.length; i < l; i++) {
                nodesRemovedFrom[i].shrink();
            }
        }
        return objectsDataRemoved;
    };
    OctreeNode.prototype.removeObjectRecursive = function (object, removeData) {
        var objectRemoved = false;
        // find index of object in objects list
        if (object instanceof OctreeObjectData_1.OctreeObjectData) {
            // search and remove object data (fast)
            // remove from this objects list
            var index = this.objects.indexOf(object);
            if (index !== -1) {
                this.objects.splice(index, 1);
                object.node = undefined;
                removeData.objectsDataRemoved.push(object);
                removeData.searchComplete = objectRemoved = true;
            }
        }
        else {
            // search and remove object data (slow)
            for (var i = this.objects.length - 1; i > -1; i--) {
                var objectData = this.objects[i];
                if (objectData.object === object) {
                    this.objects.splice(i, 1);
                    objectData.node = undefined;
                    removeData.objectsDataRemoved.push(objectData);
                    objectRemoved = true;
                    if (!objectData.faces && !objectData.vertices) {
                        removeData.searchComplete = true;
                        break;
                    }
                }
            }
        }
        // if object data removed and this is not on nodes removed  from
        if (objectRemoved) {
            removeData.nodesRemovedFrom.push(this);
        }
        // if search not complete, search nodes
        if (!removeData.searchComplete) {
            for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
                var node = this.nodesByIndex[this.nodesIndices[i]];
                // try removing object from node
                removeData = node.removeObjectRecursive(object, removeData);
                if (removeData.searchComplete) {
                    break;
                }
            }
        }
        return removeData;
    };
    OctreeNode.prototype.checkGrow = function () {
        // if object count above max
        if (this.objects.length > this.tree.objectsThreshold && this.tree.objectsThreshold > 0) {
            this.grow();
        }
    };
    OctreeNode.prototype.grow = function () {
        var objectsExpand = [];
        var objectsExpandOctants = [];
        var objectsSplit = [];
        var objectsSplitOctants = [];
        var objectsRemaining = [];
        // for each object
        for (var i = 0, l = this.objects.length; i < l; i++) {
            var object = this.objects[i];
            // get object octant index
            var indexOctant = this.getOctantIndex(object);
            if (indexOctant > -1) {
                // if lies within octant
                objectsSplit.push(object);
                objectsSplitOctants.push(indexOctant);
            }
            else if (indexOctant < -1) {
                // lies outside radius
                objectsExpand.push(object);
                objectsExpandOctants.push(indexOctant);
            }
            else {
                // lies across bounts between octants
                objectsRemaining.push(object);
            }
            // if has objects to split
            if (objectsSplit.length > 0) {
                objectsRemaining = objectsRemaining.concat(this.split(objectsSplit, objectsSplitOctants));
            }
            // if has objects to expand
            if (objectsExpand.length > 0) {
                objectsRemaining = objectsRemaining.concat(this.expand(objectsExpand, objectsExpandOctants));
            }
            // store remaining
            this.objects = objectsRemaining;
            // merge check
            this.checkMerge();
        }
    };
    OctreeNode.prototype.split = function (objects, octants) {
        var objectsRemaining;
        // if not at max depth
        if (this.depth < this.tree.depthMax) {
            objects = objects || this.objects;
            octants = octants || [];
            objectsRemaining = [];
            // for each object
            for (var i = 0, l = objects.length; i < l; i++) {
                var object = objects[i];
                // get object octant index
                var indexOctant = octants[i];
                // if object contained by octant, branch this tree
                if (indexOctant > -1) {
                    var node = this.branch(indexOctant);
                    node.addObject(object);
                }
                else {
                    objectsRemaining.push(object);
                }
            }
            // if all objects, set remaining as new objects
            if (objects === this.objects) {
                this.objects = objectsRemaining;
            }
        }
        else {
            objectsRemaining = this.objects;
        }
        return objectsRemaining;
    };
    OctreeNode.prototype.branch = function (indexOctant) {
        // node exists
        if (this.nodesByIndex[indexOctant] instanceof OctreeNode) {
            return this.nodesByIndex[indexOctant];
        }
        else {
            // properties
            var radius = this.radiusOverlap * 0.5;
            var overlap = radius * this.tree.overlapPct;
            var radiusOffset = radius - overlap;
            var offset = new three_1.Vector3(indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset);
            var position = offset.add(this.position);
            // node
            var node = new OctreeNode({
                tree: this.tree,
                parent: this,
                position: position,
                radius: radius,
                indexOctant: indexOctant
            });
            // store
            this.addNode(node, indexOctant);
            return node;
        }
    };
    OctreeNode.prototype.expand = function (objects, octants) {
        var iom = this.tree.INDEX_OUTSIDE_MAP;
        var objectsRemaining;
        // handle max depth down tree
        if (this.tree.root.getDepthEnd() < this.tree.depthMax) {
            objects = objects || this.objects;
            octants = octants || [];
            objectsRemaining = [];
            var objectsExpand = [];
            // reset counts
            for (var i = 0, l = iom.length; i < l; i++) {
                iom[i].count = 0;
            }
            // for all outside objects, find outside octants containing most objects
            for (var i = 0, l = objects.length; i < l; i++) {
                var object = objects[i];
                // get object octant index
                var indexOctant = octants[i];
                // if object outside this, include in calculations
                if (indexOctant < -1) {
                    // convert octant index to outside flags
                    var flagOutside = -indexOctant - this.tree.INDEX_OUTSIDE_OFFSET;
                    // check against bitwise flags
                    // x
                    if (flagOutside & this.tree.FLAG_POS_X) {
                        iom[this.tree.INDEX_OUTSIDE_POS_X].count++;
                    }
                    else if (flagOutside & this.tree.FLAG_NEG_X) {
                        iom[this.tree.INDEX_OUTSIDE_NEG_X].count++;
                    }
                    // y
                    if (flagOutside & this.tree.FLAG_POS_Y) {
                        iom[this.tree.INDEX_OUTSIDE_POS_Y].count++;
                    }
                    else if (flagOutside & this.tree.FLAG_NEG_Y) {
                        iom[this.tree.INDEX_OUTSIDE_NEG_Y].count++;
                    }
                    // z
                    if (flagOutside & this.tree.FLAG_POS_Z) {
                        iom[this.tree.INDEX_OUTSIDE_POS_Z].count++;
                    }
                    else if (flagOutside & this.tree.FLAG_NEG_Z) {
                        iom[this.tree.INDEX_OUTSIDE_NEG_Z].count++;
                    }
                    // store in expand list
                    objectsExpand.push(object);
                }
                else {
                    objectsRemaining.push(object);
                }
            }
            // if objects to expand
            if (objectsExpand.length > 0) {
                // shallow copy index outside map
                var indexOutsideCounts = iom.slice(0);
                // sort outside index count so highest is first
                indexOutsideCounts.sort(function (a, b) { return b.count - a.count; });
                // get highest outside indices
                // first is first
                var infoIndexOutside1 = indexOutsideCounts[0];
                var indexOutsideBitwise1 = infoIndexOutside1.index | 1;
                // second is (one of next two bitwise OR 1) that is not opposite of (first bitwise OR 1)
                var infoPotential1 = indexOutsideCounts[1];
                var infoPotential2 = indexOutsideCounts[2];
                var infoIndexOutside2 = (infoPotential1.index | 1) !== indexOutsideBitwise1 ? infoPotential1 : infoPotential2;
                var indexOutsideBitwise2 = infoIndexOutside2.index | 1;
                // third is (one of next three bitwise OR 1) that is not opposite of (first or second bitwise OR 1)
                infoPotential1 = indexOutsideCounts[2];
                infoPotential2 = indexOutsideCounts[3];
                var infoPotential3 = indexOutsideCounts[4];
                var indexPotentialBitwise1 = infoPotential1.index | 1;
                var indexPotentialBitwise2 = infoPotential2.index | 1;
                var infoIndexOutside3 = indexPotentialBitwise1 !== indexOutsideBitwise1
                    && indexPotentialBitwise1 !== indexOutsideBitwise2 ? infoPotential1 :
                    indexPotentialBitwise2 !== indexOutsideBitwise1
                        && indexPotentialBitwise2 !== indexOutsideBitwise2 ? infoPotential2 : infoPotential3;
                // get this octant normal based on outside octant indices
                var octantX = infoIndexOutside1.x + infoIndexOutside2.x + infoIndexOutside3.x;
                var octantY = infoIndexOutside1.y + infoIndexOutside2.y + infoIndexOutside3.y;
                var octantZ = infoIndexOutside1.z + infoIndexOutside2.z + infoIndexOutside3.z;
                // get this octant indices based on octant normal
                var indexOctant = this.getOctantIndexFromPosition(octantX, octantY, octantZ);
                var indexOctantInverse = this.getOctantIndexFromPosition(-octantX, -octantY, -octantZ);
                // properties
                var overlap = this.overlap;
                var radius = this.radius;
                // radius of parent comes from reversing overlap of this, unless overlap percent is 0
                var radiusParent = this.tree.overlapPct > 0
                    ? overlap / (0.5 * this.tree.overlapPct * (1 + this.tree.overlapPct))
                    : radius * 2;
                var overlapParent = radiusParent * this.tree.overlapPct;
                // parent offset is difference between radius + overlap of parent and child
                var radiusOffset = (radiusParent + overlapParent) - (radius + overlap);
                var position = new three_1.Vector3(indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset);
                position.add(this.position);
                // parent
                var parent_1 = new OctreeNode({
                    tree: this.tree,
                    position: position,
                    radius: radiusParent
                });
                // set self as node of parent
                parent_1.addNode(this, indexOctantInverse);
                // set parent as root
                this.tree.setRoot(parent_1);
                // add all expand objects to parent
                for (var i = 0, l = objectsExpand.length; i < l; i++) {
                    this.tree.root.addObject(objectsExpand[i]);
                }
            }
            // if all objects, set remaining as new objects
            if (objects === this.objects) {
                this.objects = objectsRemaining;
            }
        }
        else {
            objectsRemaining = objects;
        }
        return objectsRemaining;
    };
    OctreeNode.prototype.shrink = function () {
        // merge check
        this.checkMerge();
        // contract check
        this.tree.root.checkContract();
    };
    OctreeNode.prototype.checkMerge = function () {
        var nodeParent = this;
        var nodeMerge;
        // traverse up tree as long as node + entire subtree's object count is under minimum
        while (nodeParent.parent instanceof OctreeNode && nodeParent.getObjectsCountEnd() < this.tree.objectsThreshold) {
            nodeMerge = nodeParent;
            nodeParent = nodeParent.parent;
        }
        // if parent node is not this, merge entire subtree into merge node
        if (nodeParent !== this) {
            nodeParent.merge(nodeMerge);
        }
    };
    OctreeNode.prototype.merge = function (nodes) {
        // handle nodes
        nodes = nodes ? (Array.isArray(nodes) ? nodes : [nodes]) : [];
        for (var i = 0, l = nodes.length; i < l; i++) {
            var node = nodes[i];
            // gather node + all subtree objects
            this.addObjectWithoutCheck(node.getObjectsEnd());
            // reset node + entire subtree
            node.reset(true, true);
            // remove node
            this.removeNode(node.indexOctant);
        }
        // merge check
        this.checkMerge();
    };
    OctreeNode.prototype.checkContract = function () {
        // find node with highest object count
        if (this.nodesIndices.length > 0) {
            var nodeHeaviest = void 0;
            var nodeHeaviestObjectsCount = 0;
            var outsideHeaviestObjectsCount = this.objects.length;
            for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
                var node = this.nodesByIndex[this.nodesIndices[i]];
                var nodeObjectsCount = node.getObjectsCountEnd();
                outsideHeaviestObjectsCount += nodeObjectsCount;
                if (!(nodeHeaviest && nodeHeaviest instanceof OctreeNode) || nodeObjectsCount > nodeHeaviestObjectsCount) {
                    nodeHeaviest = node;
                    nodeHeaviestObjectsCount = nodeObjectsCount;
                }
            }
            // subtract heaviest count from outside count
            outsideHeaviestObjectsCount -= nodeHeaviestObjectsCount;
            // if should contract
            if (outsideHeaviestObjectsCount < this.tree.objectsThreshold && nodeHeaviest instanceof OctreeNode) {
                this.contract(nodeHeaviest);
            }
        }
    };
    OctreeNode.prototype.contract = function (nodeRoot) {
        // handle all nodes
        for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
            var node = this.nodesByIndex[this.nodesIndices[i]];
            // if node is not new root
            if (node !== nodeRoot) {
                // add node + all subtree objects to root
                nodeRoot.addObjectWithoutCheck(node.getObjectsEnd());
                // reset node + entire subtree
                node.reset(true, true);
            }
        }
        // ad own objects to root
        nodeRoot.addObjectWithoutCheck(this.objects);
        // reset self
        this.reset(false, true);
        // set new root
        this.tree.setRoot(nodeRoot);
        // contract check on new root
        nodeRoot.checkContract();
    };
    OctreeNode.prototype.getOctantIndex = function (objectData) {
        var radiusObj;
        var positionObj;
        // handle type
        if (objectData instanceof OctreeObjectData_1.OctreeObjectData) {
            radiusObj = objectData.radius;
            positionObj = objectData.position;
            // update object data position last
            objectData.positionLast.copy(positionObj);
        }
        else if (objectData instanceof OctreeNode) {
            positionObj = objectData.position;
            radiusObj = 0;
        }
        // find delta and distance
        var deltaX = positionObj.x - this.position.x;
        var deltaY = positionObj.y - this.position.y;
        var deltaZ = positionObj.z - this.position.z;
        var distX = Math.abs(deltaX);
        var distY = Math.abs(deltaX);
        var distZ = Math.abs(deltaX);
        var distance = Math.max(distX, distY, distZ);
        var indexOctant = 0;
        // if outside, use bitwise flags to indicate on which sides object is outside of
        if (distance + radiusObj > this.radiusOverlap) {
            // x
            if (distX + radiusObj > this.radiusOverlap) {
                indexOctant = indexOctant ^ (deltaX > 0 ? this.tree.FLAG_POS_X : this.tree.FLAG_NEG_X);
            }
            // y
            if (distY + radiusObj > this.radiusOverlap) {
                indexOctant = indexOctant ^ (deltaY > 0 ? this.tree.FLAG_POS_Y : this.tree.FLAG_NEG_Y);
            }
            // z
            if (distZ + radiusObj > this.radiusOverlap) {
                indexOctant = indexOctant ^ (deltaZ > 0 ? this.tree.FLAG_POS_Z : this.tree.FLAG_NEG_Z);
            }
            objectData.indexOctant = -indexOctant - this.tree.INDEX_OUTSIDE_OFFSET;
            return objectData.indexOctant;
        }
        // return octant index from delta xyz
        if (deltaX - radiusObj > -this.overlap) {
            // x right
            indexOctant = indexOctant | 1;
        }
        else if (!(deltaX + radiusObj < this.overlap)) {
            // x left
            objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
            return objectData.indexOctant;
        }
        if (deltaY - radiusObj > -this.overlap) {
            // y right
            indexOctant = indexOctant | 2;
        }
        else if (!(deltaY + radiusObj < this.overlap)) {
            // y left
            objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
            return objectData.indexOctant;
        }
        if (deltaZ - radiusObj > -this.overlap) {
            // z right
            indexOctant = indexOctant | 4;
        }
        else if (!(deltaZ + radiusObj < this.overlap)) {
            // z left
            objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
            return objectData.indexOctant;
        }
        objectData.indexOctant = indexOctant;
        return objectData.indexOctant;
    };
    OctreeNode.prototype.getOctantIndexFromPosition = function (x, y, z) {
        var indexOctant = 0;
        if (x > 0) {
            indexOctant = indexOctant | 1;
        }
        if (y > 0) {
            indexOctant = indexOctant | 2;
        }
        if (z > 0) {
            indexOctant = indexOctant | 4;
        }
        return indexOctant;
    };
    OctreeNode.prototype.search = function (position, radius, objects, direction, directionPct) {
        var intersects = false;
        // test intersects by parameters
        if (direction) {
            intersects = this.intersectRay(position, direction, radius, directionPct);
        }
        else {
            intersects = this.intersectSphere(position, radius);
        }
        // if intersects
        if (intersects === true) {
            // gather objects
            objects = objects.concat(this.objects);
            // search subtree
            for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
                var node = this.nodesByIndex[this.nodesIndices[i]];
                objects = node.search(position, radius, objects, direction);
            }
        }
        return objects;
    };
    OctreeNode.prototype.intersectSphere = function (position, radius) {
        var distance = radius * radius;
        var px = position.x;
        var py = position.y;
        var pz = position.z;
        if (px < this.left) {
            distance -= Math.pow(px - this.left, 2);
        }
        else if (px > this.right) {
            distance -= Math.pow(px - this.right, 2);
        }
        if (py < this.bottom) {
            distance -= Math.pow(py - this.bottom, 2);
        }
        else if (py > this.top) {
            distance -= Math.pow(py - this.top, 2);
        }
        if (pz < this.back) {
            distance -= Math.pow(pz - this.back, 2);
        }
        else if (pz > this.back) {
            distance -= Math.pow(pz - this.back, 2);
        }
        return distance >= 0;
    };
    OctreeNode.prototype.intersectRay = function (origin, direction, distance, directionPct) {
        if (typeof directionPct === 'undefined') {
            directionPct = new three_1.Vector3(1, 1, 1).divide(direction);
        }
        var t1 = (this.left - origin.x) * directionPct.x;
        var t2 = (this.right - origin.x) * directionPct.x;
        var t3 = (this.bottom - origin.y) * directionPct.y;
        var t4 = (this.top - origin.y) * directionPct.y;
        var t5 = (this.back - origin.z) * directionPct.y;
        var t6 = (this.front - origin.z) * directionPct.y;
        var tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
        // ray would intersect in reverse direction, i.e. this is behind ray
        if (tmax < 0) {
            return false;
        }
        var tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
        // if tmin > tmax or tmin > ray distance, ray doesn't intersect AABB
        return !(tmin > tmax || tmin > distance);
    };
    OctreeNode.prototype.getDepthEnd = function (depth) {
        if (this.nodesIndices.length > 0) {
            for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
                var node = this.nodesByIndex[this.nodesIndices[i]];
                depth = node.getDepthEnd(depth);
            }
        }
        else {
            depth = !depth || this.depth > depth ? this.depth : depth;
        }
        return depth;
    };
    OctreeNode.prototype.getNodeCountEnd = function () {
        return this.tree.root.getNodeCountRecursive() + 1;
    };
    OctreeNode.prototype.getNodeCountRecursive = function () {
        var count = this.nodesIndices.length;
        for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
            count += this.nodesByIndex[this.nodesIndices[i]].getNodeCountRecursive();
        }
        return count;
    };
    OctreeNode.prototype.getObjectsEnd = function (objects) {
        objects = (objects || []).concat(this.objects);
        for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
            var node = this.nodesByIndex[this.nodesIndices[i]];
            objects = node.getObjectsEnd(objects);
        }
        return objects;
    };
    OctreeNode.prototype.getObjectsCountEnd = function () {
        var count = this.objects.length;
        for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
            count += this.nodesByIndex[this.nodesIndices[i]].getObjectsCountEnd();
        }
        return count;
    };
    OctreeNode.prototype.getObjectsCountStart = function () {
        var count = this.objects.length;
        var parent = this.parent;
        while (parent instanceof OctreeNode) {
            count += parent.objects.length;
            parent = parent.parent;
        }
        return count;
    };
    OctreeNode.prototype.toConsole = function (space) {
        var spaceAddition = '   ';
        space = typeof space === 'string' ? space : spaceAddition;
        console.log(this.parent ? space + ' octree NODE > ' : ' octree ROOT > ', this, ' // id: ', this.id, ' // indexOctant: ', this.indexOctant, '' +
            ' // position: ', this.position.toArray().join(' '), '' +
            ' // radius: ', this.radius, ' // depth: ', this.depth);
        console.log(this.parent ? space + ' ' : ' ', '+ objects ( ', this.objects.length, ' ) ', this.objects);
        console.log(this.parent ? space + ' ' : ' ', '+ children ( ', this.nodesIndices.length, ' ) ', this.nodesIndices, this.nodesByIndex);
        for (var i = 0, l = this.nodesIndices.length; i < l; i++) {
            var node = this.nodesByIndex[this.nodesIndices[i]];
            node.toConsole(space + spaceAddition);
        }
    };
    return OctreeNode;
}());
exports.OctreeNode = OctreeNode;
