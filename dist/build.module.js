import { Vector3, Mesh, BufferGeometry, MathUtils, BufferAttribute, BoxBufferGeometry, MeshBasicMaterial } from 'three';

var OctreeObjectData = /** @class */ (function () {
    function OctreeObjectData(object, part) {
        this.useFaces = false;
        this.useVertices = false;
        this.object = object;
        // handle part by type
        if (part instanceof Vector3) {
            this.vertices = part;
            this.useVertices = true;
        }
        else if (part) {
            this.faces = part;
            this.useFaces = true;
        }
        this.radius = 0;
        this.position = new Vector3();
        // initial update
        this.update();
        this.positionLast = this.position.clone();
    }
    OctreeObjectData.prototype.update = function () {
        if (this.faces) {
            var _a = this.getFace3BoundingSphere(this.object, this.faces), center = _a.center, radius = _a.radius;
            this.radius = radius;
            this.position.copy(center).applyMatrix4(this.object.matrixWorld);
        }
        else if (this.vertices) {
            if (!this.object.geometry.boundingSphere) {
                this.object.geometry.computeBoundingSphere();
            }
            this.radius = this.object.geometry.boundingSphere.radius;
            this.position.copy(this.vertices).applyMatrix4(this.object.matrixWorld);
        }
        else {
            if (!this.object.geometry.boundingSphere) {
                this.object.geometry.computeBoundingSphere();
            }
            this.radius = this.object.geometry.boundingSphere.radius;
            this.position.copy(this.object.geometry.boundingSphere.center).applyMatrix4(this.object.matrixWorld);
        }
        this.radius = this.radius * Math.max(this.object.scale.x, this.object.scale.y, this.object.scale.z);
    };
    OctreeObjectData.prototype.getFace3BoundingSphere = function (object, face) {
        var va;
        var vb;
        var vc;
        var position = object.geometry.attributes.position;
        va = new Vector3().fromBufferAttribute(position, face.a);
        vb = new Vector3().fromBufferAttribute(position, face.b);
        vc = new Vector3().fromBufferAttribute(position, face.c);
        // const indexA = face.a * position.itemSize;
        // va = new Vector3(position.array[indexA], position.array[indexA + 1], position.array[indexA + 2]);
        // const indexB = face.b * position.itemSize;
        // vb = new Vector3(position.array[indexB], position.array[indexB + 1], position.array[indexB + 2]);
        // const indexC = face.c * position.itemSize;
        // va = new Vector3(position.array[indexC], position.array[indexC + 1], position.array[indexC + 2]);
        var utilVec3 = new Vector3();
        var center = new Vector3().addVectors(va, vb).add(vc).divideScalar(3);
        var radius = Math.max(utilVec3.subVectors(center, va).length(), utilVec3.subVectors(center, vb).length(), utilVec3.subVectors(center, vc).length());
        return { center: center, radius: radius };
    };
    return OctreeObjectData;
}());

var OctreeNode = /** @class */ (function () {
    function OctreeNode(parameters) {
        // store or create tree
        if (parameters === void 0) { parameters = {}; }
        this.objects = [];
        this.nodesIndices = [];
        this.nodesByIndex = {};
        if (parameters.tree instanceof Octree) {
            this.tree = parameters.tree;
        }
        else if (!(parameters.parent instanceof OctreeNode)) {
            parameters.root = this;
            this.tree = new Octree(parameters);
        }
        // basic properties
        this.id = this.tree.nodeCount++;
        this.position = parameters.position instanceof Vector3 ? parameters.position : new Vector3();
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
        this.right = this.position.x + this.radiusOverlap;
        this.bottom = this.position.y - this.radiusOverlap;
        this.top = this.position.y + this.radiusOverlap;
        this.back = this.position.z - this.radiusOverlap;
        this.front = this.position.z + this.radiusOverlap;
        // visual
        if (this.tree.scene) {
            this.visual = new Mesh(this.tree.visualGeometry, this.tree.visualMaterial);
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
        var nodesIndices = this.nodesIndices || [];
        var nodesByIndex = this.nodesByIndex;
        this.objects = [];
        this.nodesIndices = [];
        this.nodesByIndex = {};
        // unset parent in nodes
        for (var i = 0, l = nodesIndices.length; i < l; i++) {
            var node = nodesByIndex[nodesIndices[i]];
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
        if (object instanceof OctreeObjectData) {
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
            var offset = new Vector3(indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset);
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
                var position = new Vector3(indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset);
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
        if (objectData instanceof OctreeObjectData) {
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
        var distY = Math.abs(deltaY);
        var distZ = Math.abs(deltaZ);
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
        else if (pz > this.front) {
            distance -= Math.pow(pz - this.front, 2);
        }
        return distance >= 0;
    };
    OctreeNode.prototype.intersectRay = function (origin, direction, distance, directionPct) {
        if (typeof directionPct === 'undefined') {
            directionPct = new Vector3(1, 1, 1).divide(direction);
        }
        var t1 = (this.left - origin.x) * directionPct.x;
        var t2 = (this.right - origin.x) * directionPct.x;
        var t3 = (this.bottom - origin.y) * directionPct.y;
        var t4 = (this.top - origin.y) * directionPct.y;
        var t5 = (this.back - origin.z) * directionPct.z;
        var t6 = (this.front - origin.z) * directionPct.z;
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

function isNumber(n) {
    return !isNaN(n) && isFinite(n);
}
function indexOfPropertyWithValue(array, property, value) {
    for (var i = 0, il = array.length; i < il; i++) {
        if (array[i][property] === value) {
            return i;
        }
    }
    return -1;
}

var Octree = /** @class */ (function () {
    function Octree(parameters) {
        if (parameters === void 0) { parameters = {}; }
        // static properties ( modification is not recommended )
        this.nodeCount = 0;
        this.INDEX_INSIDE_CROSS = -1;
        this.INDEX_OUTSIDE_OFFSET = 2;
        this.INDEX_OUTSIDE_MAP = [];
        this.utilVec31Search = new Vector3();
        this.utilVec32Search = new Vector3();
        this.objects = [];
        this.objectsMap = {};
        this.objectsData = [];
        this.objectsDeferred = [];
        this.undeferred = false;
        parameters.tree = this;
        this.INDEX_OUTSIDE_POS_X = isNumber(parameters.INDEX_OUTSIDE_POS_X) ? parameters.INDEX_OUTSIDE_POS_X : 0;
        this.INDEX_OUTSIDE_NEG_X = isNumber(parameters.INDEX_OUTSIDE_NEG_X) ? parameters.INDEX_OUTSIDE_NEG_X : 1;
        this.INDEX_OUTSIDE_POS_Y = isNumber(parameters.INDEX_OUTSIDE_POS_Y) ? parameters.INDEX_OUTSIDE_POS_Y : 2;
        this.INDEX_OUTSIDE_NEG_Y = isNumber(parameters.INDEX_OUTSIDE_NEG_Y) ? parameters.INDEX_OUTSIDE_NEG_Y : 3;
        this.INDEX_OUTSIDE_POS_Z = isNumber(parameters.INDEX_OUTSIDE_POS_Z) ? parameters.INDEX_OUTSIDE_POS_Z : 4;
        this.INDEX_OUTSIDE_NEG_Z = isNumber(parameters.INDEX_OUTSIDE_NEG_Z) ? parameters.INDEX_OUTSIDE_NEG_Z : 5;
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_POS_X] = { index: this.INDEX_OUTSIDE_POS_X, count: 0, x: 1, y: 0, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_NEG_X] = { index: this.INDEX_OUTSIDE_NEG_X, count: 0, x: -1, y: 0, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_POS_Y] = { index: this.INDEX_OUTSIDE_POS_Y, count: 0, x: 0, y: 1, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_NEG_Y] = { index: this.INDEX_OUTSIDE_NEG_Y, count: 0, x: 0, y: -1, z: 0 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_POS_Z] = { index: this.INDEX_OUTSIDE_POS_Z, count: 0, x: 0, y: 0, z: 1 };
        this.INDEX_OUTSIDE_MAP[this.INDEX_OUTSIDE_NEG_Z] = { index: this.INDEX_OUTSIDE_NEG_Z, count: 0, x: 0, y: 0, z: -1 };
        this.FLAG_POS_X = 1 << (this.INDEX_OUTSIDE_POS_X + 1);
        this.FLAG_NEG_X = 1 << (this.INDEX_OUTSIDE_NEG_X + 1);
        this.FLAG_POS_Y = 1 << (this.INDEX_OUTSIDE_POS_Y + 1);
        this.FLAG_NEG_Y = 1 << (this.INDEX_OUTSIDE_NEG_Y + 1);
        this.FLAG_POS_Z = 1 << (this.INDEX_OUTSIDE_POS_Z + 1);
        this.FLAG_NEG_Z = 1 << (this.INDEX_OUTSIDE_NEG_Z + 1);
        // pass scene to see octree structure
        this.scene = parameters.scene;
        if (this.scene) {
            this.visualGeometry = new BoxBufferGeometry(1, 1, 1);
            this.visualMaterial = new MeshBasicMaterial({
                color: 0xff0066,
                wireframe: true,
                wireframeLinewidth: 1
            });
        }
        // properties
        this.depthMax = isNumber(parameters.depthMax) ? parameters.depthMax : Infinity;
        this.objectsThreshold = isNumber(parameters.objectsThreshold) ? parameters.objectsThreshold : 8;
        this.overlapPct = isNumber(parameters.overlapPct) ? parameters.overlapPct : 0.15;
        this.undeferred = parameters.undeferred || false;
        this.root = parameters.root instanceof OctreeNode ? parameters.root : new OctreeNode(parameters);
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
        if (object instanceof OctreeObjectData) {
            object = object.object;
        }
        if (!(object.geometry instanceof BufferGeometry)) {
            throw new Error('Unsupported geometry type: Use BufferGeometry!');
        }
        // check uuid to avoid duplicates
        if (!object.uuid) {
            object.uuid = MathUtils.generateUUID();
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
                if (object.geometry instanceof BufferGeometry && object.geometry.attributes.position instanceof BufferAttribute) {
                    var position = object.geometry.attributes.position;
                    for (var i = 0, l = position.count; i < l; i++) {
                        this.addObjectData(object, new Vector3().fromBufferAttribute(position, i));
                    }
                }
            }
            else if (useFaces === true) {
                var position = object.geometry.attributes.position;
                var index = object.geometry.index;
                // TODO: support face/vertex normals and colors?
                if (index) {
                    // indexed triangles
                    for (var i = 0, l = index.count; i < l; i += 3) {
                        this.addObjectData(object, {
                            a: i, b: i + 1, c: i + 2,
                            normal: new Vector3(), materialIndex: 0
                        });
                    }
                }
                else {
                    // every 3 vertices are one triangle
                    for (var i = 0, l = position.count; i < l; i += 3) {
                        this.addObjectData(object, {
                            a: i, b: i + 1, c: i + 2,
                            normal: new Vector3(), materialIndex: 0
                        });
                    }
                }
            }
            else {
                this.addObjectData(object);
            }
        }
    };
    Octree.prototype.addObjectData = function (object, part) {
        var objectData = new OctreeObjectData(object, part);
        // add to tree objects data list
        this.objectsData.push(objectData);
        // add to nodes
        this.root.addObject(objectData);
    };
    Octree.prototype.remove = function (object) {
        // ensure object is not object data for index search
        if (object instanceof OctreeObjectData) {
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
            var index = indexOfPropertyWithValue(this.objectsDeferred, 'object', object);
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
            if (node instanceof OctreeNode && !objectData.positionLast.equals(objectData.position)) {
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
        if (object instanceof OctreeObjectData) {
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
        if (direction instanceof Vector3) {
            direction = direction.clone().normalize();
            directionPct = new Vector3(1, 1, 1).divide(direction);
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
        if (root instanceof OctreeNode) {
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

export { Octree };
