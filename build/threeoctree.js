(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE = global.THREE || {}, global.THREE));
})(this, (function (exports, three) { 'use strict';

    function isNumber(n) {
        return !isNaN(n) && isFinite(n);
    }
    function indexOfPropertyWithValue(array, property, value) {
        for (let i = 0, il = array.length; i < il; i++) {
            if (array[i][property] === value) {
                return i;
            }
        }
        return -1;
    }

    class OctreeObjectData {
        constructor(object, part) {
            this.useFaces = false;
            this.useVertices = false;
            this.object = object;
            // handle part by type
            if (part instanceof three.Vector3) {
                this.vertices = part;
                this.useVertices = true;
            }
            else if (part) {
                this.faces = part;
                this.useFaces = true;
            }
            this.radius = 0;
            this.position = new three.Vector3();
            // initial update
            this.update();
            this.positionLast = this.position.clone();
        }
        update() {
            if (this.faces) {
                const { center, radius } = this.getFace3BoundingSphere(this.object, this.faces);
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
        }
        getFace3BoundingSphere(object, face) {
            let va;
            let vb;
            let vc;
            const position = object.geometry.getAttribute('position');
            va = new three.Vector3().fromBufferAttribute(position, face.a);
            vb = new three.Vector3().fromBufferAttribute(position, face.b);
            vc = new three.Vector3().fromBufferAttribute(position, face.c);
            const utilVec3 = new three.Vector3();
            const center = new three.Vector3().addVectors(va, vb).add(vc).divideScalar(3);
            const radius = Math.max(utilVec3.subVectors(center, va).length(), utilVec3.subVectors(center, vb).length(), utilVec3.subVectors(center, vc).length());
            return { center, radius };
        }
    }

    class OctreeNode {
        constructor(parameters = {}) {
            // store or create tree
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
            this.position = parameters.position instanceof three.Vector3 ? parameters.position : new three.Vector3();
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
                this.visual = new three.Mesh(this.tree.visualGeometry, this.tree.visualMaterial);
                this.visual.scale.set(this.radiusOverlap * 2, this.radiusOverlap * 2, this.radiusOverlap * 2);
                this.visual.position.copy(this.position);
                this.tree.scene.add(this.visual);
            }
        }
        setParent(parent) {
            // store new parent
            if (parent !== this && this.parent !== parent) {
                this.parent = parent;
                // update properties
                this.updateProperties();
            }
        }
        updateProperties() {
            // properties
            if (this.parent instanceof OctreeNode) {
                this.tree = this.parent.tree;
                this.depth = this.parent.depth + 1;
            }
            else {
                this.depth = 0;
            }
            // cascade
            for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                this.nodesByIndex[this.nodesIndices[i]].updateProperties();
            }
        }
        reset(cascade = false, removeVisual = false) {
            const nodesIndices = this.nodesIndices || [];
            const nodesByIndex = this.nodesByIndex;
            this.objects = [];
            this.nodesIndices = [];
            this.nodesByIndex = {};
            // unset parent in nodes
            for (let i = 0, l = nodesIndices.length; i < l; i++) {
                const node = nodesByIndex[nodesIndices[i]];
                node.setParent(undefined);
                if (cascade === true) {
                    node.reset(cascade, removeVisual);
                }
            }
            // visual
            if (removeVisual === true && this.visual && this.visual.parent) {
                this.visual.parent.remove(this.visual);
            }
        }
        addNode(node, indexOctant) {
            node.indexOctant = indexOctant;
            if (this.nodesIndices.indexOf(indexOctant) === -1) {
                this.nodesIndices.push(indexOctant);
            }
            this.nodesByIndex[indexOctant] = node;
            if (node.parent !== this) {
                node.setParent(this);
            }
        }
        removeNode(indexOctant) {
            const index = this.nodesIndices.indexOf(indexOctant);
            this.nodesIndices.splice(index, 1);
            const node = this.nodesByIndex[indexOctant];
            delete this.nodesByIndex[indexOctant];
            if (node.parent === this) {
                node.setParent(undefined);
            }
        }
        addObject(object) {
            // get object octant index
            const indexOctant = this.getOctantIndex(object);
            if (indexOctant > -1 && this.nodesIndices.length > 0) {
                // if object fully contained by an octant, add to subtree
                const node = this.branch(indexOctant);
                node.addObject(object);
            }
            else if (indexOctant < -1 && this.parent instanceof OctreeNode) {
                // if object lies outside bounds, add to parent node
                this.parent.addObject(object);
            }
            else {
                // add to this objects list
                const index = this.objects.indexOf(object);
                if (index === -1) {
                    this.objects.push(object);
                }
                // node reference
                object.node = this;
                // check if need to expand, split, or both
                this.checkGrow();
            }
        }
        addObjectWithoutCheck(objects) {
            for (let i = 0, l = objects.length; i < l; i++) {
                const object = objects[i];
                this.objects.push(object);
                object.node = this;
            }
        }
        removeObject(object) {
            // cascade through tree to find and remove object
            const { nodesRemovedFrom, objectsDataRemoved } = this.removeObjectRecursive(object, {
                searchComplete: false,
                nodesRemovedFrom: [],
                objectsDataRemoved: []
            });
            // if object removed, try to shrink the nodes it was removed from
            if (nodesRemovedFrom.length > 0) {
                for (let i = 0, l = nodesRemovedFrom.length; i < l; i++) {
                    nodesRemovedFrom[i].shrink();
                }
            }
            return objectsDataRemoved;
        }
        removeObjectRecursive(object, removeData) {
            let objectRemoved = false;
            // find index of object in objects list
            if (object instanceof OctreeObjectData) {
                // search and remove object data (fast)
                // remove from this objects list
                const index = this.objects.indexOf(object);
                if (index !== -1) {
                    this.objects.splice(index, 1);
                    object.node = undefined;
                    removeData.objectsDataRemoved.push(object);
                    removeData.searchComplete = objectRemoved = true;
                }
            }
            else {
                // search and remove object data (slow)
                for (let i = this.objects.length - 1; i > -1; i--) {
                    const objectData = this.objects[i];
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
                for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                    const node = this.nodesByIndex[this.nodesIndices[i]];
                    // try removing object from node
                    removeData = node.removeObjectRecursive(object, removeData);
                    if (removeData.searchComplete) {
                        break;
                    }
                }
            }
            return removeData;
        }
        checkGrow() {
            // if object count above max
            if (this.objects.length > this.tree.objectsThreshold && this.tree.objectsThreshold > 0) {
                this.grow();
            }
        }
        grow() {
            const objectsExpand = [];
            const objectsExpandOctants = [];
            const objectsSplit = [];
            const objectsSplitOctants = [];
            let objectsRemaining = [];
            // for each object
            for (let i = 0, l = this.objects.length; i < l; i++) {
                const object = this.objects[i];
                // get object octant index
                const indexOctant = this.getOctantIndex(object);
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
        }
        split(objects, octants) {
            let objectsRemaining;
            // if not at max depth
            if (this.depth < this.tree.depthMax) {
                objects = objects || this.objects;
                octants = octants || [];
                objectsRemaining = [];
                // for each object
                for (let i = 0, l = objects.length; i < l; i++) {
                    const object = objects[i];
                    // get object octant index
                    const indexOctant = octants[i];
                    // if object contained by octant, branch this tree
                    if (indexOctant > -1) {
                        const node = this.branch(indexOctant);
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
        }
        branch(indexOctant) {
            // node exists
            if (this.nodesByIndex[indexOctant] instanceof OctreeNode) {
                return this.nodesByIndex[indexOctant];
            }
            else {
                // properties
                const radius = this.radiusOverlap * 0.5;
                const overlap = radius * this.tree.overlapPct;
                const radiusOffset = radius - overlap;
                const offset = new three.Vector3(indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset);
                const position = offset.add(this.position);
                // node
                const node = new OctreeNode({
                    tree: this.tree,
                    parent: this,
                    position,
                    radius,
                    indexOctant
                });
                // store
                this.addNode(node, indexOctant);
                return node;
            }
        }
        expand(objects, octants) {
            const iom = this.tree.INDEX_OUTSIDE_MAP;
            let objectsRemaining;
            // handle max depth down tree
            if (this.tree.root.getDepthEnd() < this.tree.depthMax) {
                objects = objects || this.objects;
                octants = octants || [];
                objectsRemaining = [];
                const objectsExpand = [];
                // reset counts
                for (let i = 0, l = iom.length; i < l; i++) {
                    iom[i].count = 0;
                }
                // for all outside objects, find outside octants containing most objects
                for (let i = 0, l = objects.length; i < l; i++) {
                    const object = objects[i];
                    // get object octant index
                    const indexOctant = octants[i];
                    // if object outside this, include in calculations
                    if (indexOctant < -1) {
                        // convert octant index to outside flags
                        const flagOutside = -indexOctant - this.tree.INDEX_OUTSIDE_OFFSET;
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
                    const indexOutsideCounts = iom.slice(0);
                    // sort outside index count so highest is first
                    indexOutsideCounts.sort((a, b) => b.count - a.count);
                    // get highest outside indices
                    // first is first
                    const infoIndexOutside1 = indexOutsideCounts[0];
                    const indexOutsideBitwise1 = infoIndexOutside1.index | 1;
                    // second is (one of next two bitwise OR 1) that is not opposite of (first bitwise OR 1)
                    let infoPotential1 = indexOutsideCounts[1];
                    let infoPotential2 = indexOutsideCounts[2];
                    const infoIndexOutside2 = (infoPotential1.index | 1) !== indexOutsideBitwise1 ? infoPotential1 : infoPotential2;
                    const indexOutsideBitwise2 = infoIndexOutside2.index | 1;
                    // third is (one of next three bitwise OR 1) that is not opposite of (first or second bitwise OR 1)
                    infoPotential1 = indexOutsideCounts[2];
                    infoPotential2 = indexOutsideCounts[3];
                    const infoPotential3 = indexOutsideCounts[4];
                    const indexPotentialBitwise1 = infoPotential1.index | 1;
                    const indexPotentialBitwise2 = infoPotential2.index | 1;
                    const infoIndexOutside3 = indexPotentialBitwise1 !== indexOutsideBitwise1
                        && indexPotentialBitwise1 !== indexOutsideBitwise2 ? infoPotential1 :
                        indexPotentialBitwise2 !== indexOutsideBitwise1
                            && indexPotentialBitwise2 !== indexOutsideBitwise2 ? infoPotential2 : infoPotential3;
                    // get this octant normal based on outside octant indices
                    const octantX = infoIndexOutside1.x + infoIndexOutside2.x + infoIndexOutside3.x;
                    const octantY = infoIndexOutside1.y + infoIndexOutside2.y + infoIndexOutside3.y;
                    const octantZ = infoIndexOutside1.z + infoIndexOutside2.z + infoIndexOutside3.z;
                    // get this octant indices based on octant normal
                    const indexOctant = this.getOctantIndexFromPosition(octantX, octantY, octantZ);
                    const indexOctantInverse = this.getOctantIndexFromPosition(-octantX, -octantY, -octantZ);
                    // properties
                    const overlap = this.overlap;
                    const radius = this.radius;
                    // radius of parent comes from reversing overlap of this, unless overlap percent is 0
                    const radiusParent = this.tree.overlapPct > 0
                        ? overlap / (0.5 * this.tree.overlapPct * (1 + this.tree.overlapPct))
                        : radius * 2;
                    const overlapParent = radiusParent * this.tree.overlapPct;
                    // parent offset is difference between radius + overlap of parent and child
                    const radiusOffset = (radiusParent + overlapParent) - (radius + overlap);
                    const position = new three.Vector3(indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset);
                    position.add(this.position);
                    // parent
                    const parent = new OctreeNode({
                        tree: this.tree,
                        position,
                        radius: radiusParent
                    });
                    // set self as node of parent
                    parent.addNode(this, indexOctantInverse);
                    // set parent as root
                    this.tree.setRoot(parent);
                    // add all expand objects to parent
                    for (let i = 0, l = objectsExpand.length; i < l; i++) {
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
        }
        shrink() {
            // merge check
            this.checkMerge();
            // contract check
            this.tree.root.checkContract();
        }
        checkMerge() {
            let nodeParent = this;
            let nodeMerge;
            // traverse up tree as long as node + entire subtree's object count is under minimum
            while (nodeParent.parent instanceof OctreeNode && nodeParent.getObjectsCountEnd() < this.tree.objectsThreshold) {
                nodeMerge = nodeParent;
                nodeParent = nodeParent.parent;
            }
            // if parent node is not this, merge entire subtree into merge node
            if (nodeParent !== this) {
                nodeParent.merge(nodeMerge);
            }
        }
        merge(nodes) {
            // handle nodes
            nodes = nodes ? (Array.isArray(nodes) ? nodes : [nodes]) : [];
            for (let i = 0, l = nodes.length; i < l; i++) {
                const node = nodes[i];
                // gather node + all subtree objects
                this.addObjectWithoutCheck(node.getObjectsEnd());
                // reset node + entire subtree
                node.reset(true, true);
                // remove node
                this.removeNode(node.indexOctant);
            }
            // merge check
            this.checkMerge();
        }
        checkContract() {
            // find node with highest object count
            if (this.nodesIndices.length > 0) {
                let nodeHeaviest;
                let nodeHeaviestObjectsCount = 0;
                let outsideHeaviestObjectsCount = this.objects.length;
                for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                    const node = this.nodesByIndex[this.nodesIndices[i]];
                    const nodeObjectsCount = node.getObjectsCountEnd();
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
        }
        contract(nodeRoot) {
            // handle all nodes
            for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                const node = this.nodesByIndex[this.nodesIndices[i]];
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
        }
        getOctantIndex(objectData) {
            let radiusObj;
            let positionObj;
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
            const deltaX = positionObj.x - this.position.x;
            const deltaY = positionObj.y - this.position.y;
            const deltaZ = positionObj.z - this.position.z;
            const distX = Math.abs(deltaX);
            const distY = Math.abs(deltaY);
            const distZ = Math.abs(deltaZ);
            const distance = Math.max(distX, distY, distZ);
            let indexOctant = 0;
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
        }
        getOctantIndexFromPosition(x, y, z) {
            let indexOctant = 0;
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
        }
        search(position, radius, objects, direction, directionPct) {
            // test intersects by parameters
            const intersects = direction
                ? this.intersectRay(position, direction, radius, directionPct)
                : this.intersectSphere(position, radius);
            // if intersects
            if (intersects === true) {
                // gather objects
                objects = objects.concat(this.objects);
                // search subtree
                for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                    const node = this.nodesByIndex[this.nodesIndices[i]];
                    objects = node.search(position, radius, objects, direction);
                }
            }
            return objects;
        }
        intersectSphere(position, radius) {
            let distance = radius * radius;
            const px = position.x;
            const py = position.y;
            const pz = position.z;
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
        }
        intersectRay(origin, direction, distance, directionPct) {
            if (typeof directionPct === 'undefined') {
                directionPct = new three.Vector3(1, 1, 1).divide(direction);
            }
            const t1 = (this.left - origin.x) * directionPct.x;
            const t2 = (this.right - origin.x) * directionPct.x;
            const t3 = (this.bottom - origin.y) * directionPct.y;
            const t4 = (this.top - origin.y) * directionPct.y;
            const t5 = (this.back - origin.z) * directionPct.z;
            const t6 = (this.front - origin.z) * directionPct.z;
            const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
            // ray would intersect in reverse direction, i.e. this is behind ray
            if (tmax < 0) {
                return false;
            }
            const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
            // if tmin > tmax or tmin > ray distance, ray doesn't intersect AABB
            return !(tmin > tmax || tmin > distance);
        }
        getDepthEnd(depth) {
            if (this.nodesIndices.length > 0) {
                for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                    const node = this.nodesByIndex[this.nodesIndices[i]];
                    depth = node.getDepthEnd(depth);
                }
            }
            else {
                depth = !depth || this.depth > depth ? this.depth : depth;
            }
            return depth;
        }
        getNodeCountEnd() {
            return this.tree.root.getNodeCountRecursive() + 1;
        }
        getNodeCountRecursive() {
            let count = this.nodesIndices.length;
            for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                count += this.nodesByIndex[this.nodesIndices[i]].getNodeCountRecursive();
            }
            return count;
        }
        getObjectsEnd(objects) {
            objects = (objects || []).concat(this.objects);
            for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                const node = this.nodesByIndex[this.nodesIndices[i]];
                objects = node.getObjectsEnd(objects);
            }
            return objects;
        }
        getObjectsCountEnd() {
            let count = this.objects.length;
            for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                count += this.nodesByIndex[this.nodesIndices[i]].getObjectsCountEnd();
            }
            return count;
        }
        getObjectsCountStart() {
            let count = this.objects.length;
            let parent = this.parent;
            while (parent instanceof OctreeNode) {
                count += parent.objects.length;
                parent = parent.parent;
            }
            return count;
        }
        toConsole(space) {
            const spaceAddition = '   ';
            space = typeof space === 'string' ? space : spaceAddition;
            console.log(this.parent ? space + ' octree NODE > ' : ' octree ROOT > ', this, ' // id: ', this.id, ' // indexOctant: ', this.indexOctant, '' +
                ' // position: ', this.position.toArray().join(' '), '' +
                ' // radius: ', this.radius, ' // depth: ', this.depth);
            console.log(this.parent ? space + ' ' : ' ', '+ objects ( ', this.objects.length, ' ) ', this.objects);
            console.log(this.parent ? space + ' ' : ' ', '+ children ( ', this.nodesIndices.length, ' ) ', this.nodesIndices, this.nodesByIndex);
            for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                const node = this.nodesByIndex[this.nodesIndices[i]];
                node.toConsole(space + spaceAddition);
            }
        }
    }

    class Octree {
        constructor(parameters = {}) {
            // static properties ( modification is not recommended )
            this.nodeCount = 0;
            this.INDEX_INSIDE_CROSS = -1;
            this.INDEX_OUTSIDE_OFFSET = 2;
            this.INDEX_OUTSIDE_MAP = [];
            this.utilVec31Search = new three.Vector3();
            this.utilVec32Search = new three.Vector3();
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
                this.visualGeometry = new three.BoxGeometry(1, 1, 1);
                this.visualMaterial = new three.MeshBasicMaterial({
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
        /**
         * When `octree.add( object )` is called and `octree.undeferred !== true`,
         * insertion for that object is deferred until the octree is updated.
         * Update octree to insert all deferred objects after render cycle to make sure object matrices are up to date.
         */
        update() {
            // add any deferred objects that were waiting for render cycle
            if (this.objectsDeferred.length > 0) {
                for (let i = 0, il = this.objectsDeferred.length; i < il; i++) {
                    const { object, options } = this.objectsDeferred[i];
                    this.addDeferred(object, options);
                }
                this.objectsDeferred.length = 0;
            }
        }
        /**
         * Add mesh as single octree object.
         */
        add(object, options) {
            if (this.undeferred) {
                // add immediately
                this.updateObject(object);
                this.addDeferred(object, options);
            }
            else {
                // defer add until update called
                this.objectsDeferred.push({ object, options });
            }
        }
        addDeferred(object, options) {
            // ensure object is not object data
            if (object instanceof OctreeObjectData) {
                object = object.object;
            }
            // check uuid to avoid duplicates
            if (!object.uuid) {
                object.uuid = three.MathUtils.generateUUID();
            }
            if (!this.objectsMap[object.uuid]) {
                // store
                this.objects.push(object);
                this.objectsMap[object.uuid] = object;
                // check options
                let useFaces = false;
                let useVertices = false;
                if (options) {
                    useFaces = options.useFaces;
                    useVertices = options.useVertices;
                }
                if (useVertices === true) {
                    // TODO: support InterleavedBuffer/InterleavedBufferAttribute?
                    if (object.geometry instanceof three.BufferGeometry && object.geometry.attributes.position instanceof three.BufferAttribute) {
                        const position = object.geometry.attributes.position;
                        for (let i = 0, l = position.count; i < l; i++) {
                            this.addObjectData(object, new three.Vector3().fromBufferAttribute(position, i));
                        }
                    }
                }
                else if (useFaces === true) {
                    const position = object.geometry.attributes.position;
                    const index = object.geometry.index;
                    // TODO: support face/vertex normals and colors?
                    // TODO: support materialIndex for multiple materials https://github.com/mrdoob/three.js/blob/master/src/objects/Mesh.js#L165-L193
                    if (index) {
                        // indexed triangles
                        for (let i = 0, l = index.count; i < l; i += 3) {
                            this.addObjectData(object, {
                                a: i, b: i + 1, c: i + 2,
                                normal: new three.Vector3(), materialIndex: 0
                            });
                        }
                    }
                    else {
                        // every 3 vertices are one triangle
                        for (let i = 0, l = position.count; i < l; i += 3) {
                            this.addObjectData(object, {
                                a: i, b: i + 1, c: i + 2,
                                normal: new three.Vector3(), materialIndex: 0
                            });
                        }
                    }
                }
                else {
                    this.addObjectData(object);
                }
            }
        }
        addObjectData(object, part) {
            const objectData = new OctreeObjectData(object, part);
            // add to tree objects data list
            this.objectsData.push(objectData);
            // add to nodes
            this.root.addObject(objectData);
        }
        /**
         * Remove all octree objects associated with the mesh.
         */
        remove(object) {
            // ensure object is not object data for index search
            if (object instanceof OctreeObjectData) {
                object = object.object;
            }
            // check uuid
            if (this.objectsMap[object.uuid]) {
                this.objectsMap[object.uuid] = undefined;
                // check and remove from objects, nodes, and data lists
                const index = this.objects.indexOf(object);
                if (index !== -1) {
                    this.objects.splice(index, 1);
                    // remove from nodes
                    const objectsDataRemoved = this.root.removeObject(object);
                    // remove from objects data list
                    for (let i = 0, l = objectsDataRemoved.length; i < l; i++) {
                        const objectData = objectsDataRemoved[i];
                        const indexData = this.objectsData.indexOf(objectData);
                        if (indexData !== -1) {
                            this.objectsData.splice(indexData, 1);
                        }
                    }
                }
            }
            else if (this.objectsDeferred.length > 0) {
                // check and remove from deferred
                const index = indexOfPropertyWithValue(this.objectsDeferred, 'object', object);
                if (index !== -1) {
                    this.objectsDeferred.splice(index, 1);
                }
            }
        }
        extend(octree) {
            if (octree instanceof Octree) {
                // for each object data
                const objectsData = octree.objectsData;
                for (let i = 0, l = objectsData.length; i < l; i++) {
                    const objectData = objectsData[i];
                    this.add(objectData, { useFaces: objectData.useFaces, useVertices: objectData.useVertices });
                }
            }
        }
        /**
         * Rebuild octree to account for moving objects within the tree.
         */
        rebuild() {
            const objectsUpdate = [];
            // check all object data for changes in position
            // assumes all object matrices are up to date
            for (let i = 0, l = this.objectsData.length; i < l; i++) {
                const objectData = this.objectsData[i];
                const node = objectData.node;
                // update object
                objectData.update();
                // if position has changed since last organization of object in tree
                if (node instanceof OctreeNode && !objectData.positionLast.equals(objectData.position)) {
                    // get octant index of object within current node
                    const indexOctantLast = objectData.indexOctant;
                    const indexOctant = node.getOctantIndex(objectData);
                    // if object octant index has changed
                    if (indexOctant !== indexOctantLast) {
                        // add to update list
                        objectsUpdate.push(objectData);
                    }
                }
            }
            // update changed objects
            for (let i = 0, l = objectsUpdate.length; i < l; i++) {
                const objectData = objectsUpdate[i];
                // remove object from current node
                objectData.node.removeObject(objectData);
                // add object to tree root
                this.root.addObject(objectData);
            }
        }
        updateObject(object) {
            if (object instanceof OctreeObjectData) {
                object = object.object;
            }
            // search all parents between object and root for world matrix update
            const parentCascade = [object];
            let parent = object.parent;
            let parentUpdate;
            while (parent) {
                parentCascade.push(parent);
                parent = parent.parent;
            }
            for (let i = 0, l = parentCascade.length; i < l; i++) {
                parent = parentCascade[i];
                if (parent.matrixWorldNeedsUpdate) {
                    parentUpdate = parent;
                }
            }
            // update world matrix starting at uppermost parent that needs update
            if (typeof parentUpdate !== 'undefined') {
                parentUpdate.updateMatrixWorld();
            }
        }
        search(position, radius, organizeByObject, direction) {
            let directionPct;
            // add root objects
            let objects = [].concat(this.root.objects);
            // ensure radius (i.e. distance of ray) is a number
            if (!(radius > 0)) {
                radius = Number.MAX_VALUE;
            }
            // if direction passed, normalize and find pct
            if (direction instanceof three.Vector3) {
                direction = direction.clone().normalize();
                directionPct = new three.Vector3(1, 1, 1).divide(direction);
            }
            // search each node of root
            for (let i = 0, l = this.root.nodesIndices.length; i < l; i++) {
                const node = this.root.nodesByIndex[this.root.nodesIndices[i]];
                objects = node.search(position, radius, objects, direction, directionPct);
            }
            // if should organize results by object
            if (organizeByObject === true) {
                const results = [];
                const resultsObjectsIndices = [];
                let resultData;
                // for each object data found
                for (let i = 0, l = objects.length; i < l; i++) {
                    const objectData = objects[i];
                    const object = objectData.object;
                    const resultObjectIndex = resultsObjectsIndices.indexOf(object);
                    // if needed, create new result data
                    if (resultObjectIndex === -1) {
                        resultData = {
                            object,
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
        }
        findClosestVertex(position, radius) {
            const search = this.search(position, radius, true);
            if (!search[0]) {
                return null;
            }
            const object = search[0].object;
            const vertices = search[0].vertices;
            if (vertices.length === 0) {
                return null;
            }
            let distance;
            let vertex = null;
            const localPosition = object.worldToLocal(position.clone());
            for (let i = 0, l = vertices.length; i < l; i++) {
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
        }
        setRoot(root) {
            if (root instanceof OctreeNode) {
                // store new root
                this.root = root;
                // update properties
                this.root.updateProperties();
            }
        }
        getDepthEnd() {
            return this.root.getDepthEnd();
        }
        getNodeCountEnd() {
            return this.root.getNodeCountEnd();
        }
        getObjectCountEnd() {
            return this.root.getObjectsCountEnd();
        }
        toConsole() {
            this.root.toConsole();
        }
    }

    const _vA = new three.Vector3();
    const _vB = new three.Vector3();
    const _vC = new three.Vector3();
    const _intersectionPoint = new three.Vector3();
    const _intersectionPointWorld = new three.Vector3();
    /**
     * Raycaster extended by methods to raycast Octree search results.
     */
    class OctreeRaycaster extends three.Raycaster {
        /**
       * Checks all intersection between the ray and the octree object with or without the descendants.
       * Intersections are returned sorted by distance, closest first.
       * @param object - The octree object to check for intersection with the ray.
       * @param recursive - If true, it also checks all descendants. Otherwise it only checks intersection with the object. Default is true.
       * @param intersects - (optional) target to set the result. Otherwise a new Array is instantiated.
       */
        intersectOctreeObject(object, recursive = true, intersects = []) {
            if (object instanceof three.Object3D) {
                // intersect normal object
                intersects.push(...this.intersectObject(object, recursive));
            }
            else if (object.object instanceof three.Mesh) {
                const mesh = object.object;
                const attr = mesh.geometry.getAttribute('position');
                if (Array.isArray(object.faces) && object.faces.length > 0) {
                    // raycast triangles
                    for (const face of object.faces) {
                        _vA.fromBufferAttribute(attr, face.a);
                        _vB.fromBufferAttribute(attr, face.b);
                        _vC.fromBufferAttribute(attr, face.c);
                        // TODO: set backface culling according to material.side
                        let intersect = this.ray.intersectTriangle(_vA, _vB, _vC, true, _intersectionPoint);
                        if (intersect === null)
                            continue;
                        _intersectionPointWorld.copy(_intersectionPoint);
                        _intersectionPointWorld.applyMatrix4(mesh.matrixWorld);
                        const distance = this.ray.origin.distanceTo(_intersectionPointWorld);
                        if (distance < this.near || distance > this.far)
                            continue;
                        intersects.push({
                            distance,
                            point: _intersectionPointWorld.clone(),
                            object: mesh,
                            face
                        });
                        break;
                    }
                }
                else {
                    // intersect
                    intersects.push(...this.intersectObject(mesh, recursive));
                }
            }
            else {
                console.warn('OctreeObjectData or ResultData is missing a mesh instance!');
            }
            return intersects;
        }
        /**
       * Checks all intersection between the ray and the octree objects with or without the descendants.
       * Intersections are returned sorted by distance, closest first.
       * @param objects - The octree objects to check for intersection with the ray.
       * @param recursive - If true, it also checks all descendants. Otherwise it only checks intersection with the object. Default is true.
       * @param intersects - (optional) target to set the result. Otherwise a new Array is instantiated.
       */
        intersectOctreeObjects(objects, recursive = true, intersects = []) {
            for (let i = 0, l = objects.length; i < l; i++) {
                intersects.push(...this.intersectOctreeObject(objects[i], recursive));
            }
            intersects.sort((a, b) => a.distance - b.distance);
            return intersects;
        }
    }

    exports.Octree = Octree;
    exports.OctreeRaycaster = OctreeRaycaster;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
