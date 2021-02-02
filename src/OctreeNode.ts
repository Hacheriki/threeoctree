import { Mesh, Vector3 } from 'three';
import { OctreeObjectData } from './OctreeObjectData';
import { OctreeNodeParameters, RemoveData } from './interfaces';
import { Octree } from './Octree';

export class OctreeNode {

    tree: Octree;
    parent: OctreeNode;
    id: number;

    position: Vector3;
    radius: number;
    indexOctant: number;
    depth: number;
    overlap: number;
    radiusOverlap: number;

    objects: OctreeObjectData[] = [];
    nodesIndices: number[] = [];
    nodesByIndex: {[key: number]: OctreeNode} = {};

    left: number;
    right: number;
    bottom: number;
    top: number;
    back: number;
    front: number;

    visual: Mesh;

    constructor(parameters: OctreeNodeParameters = {}) {

        // store or create tree

        if (parameters.tree instanceof Octree) {

            this.tree = parameters.tree;

        } else if (!(parameters.parent instanceof OctreeNode)) {

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

    setParent(parent: OctreeNode) {

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

        } else {

            this.depth = 0;

        }

        // cascade

        for ( let i = 0, l = this.nodesIndices.length; i < l; i++ ) {
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

        for ( let i = 0, l = nodesIndices.length; i < l; i++ ) {

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

    addNode(node: OctreeNode, indexOctant: number) {

        node.indexOctant = indexOctant;

        if (this.nodesIndices.indexOf(indexOctant) === -1) {
            this.nodesIndices.push(indexOctant);
        }

        this.nodesByIndex[indexOctant] = node;

        if (node.parent !== this) {
            node.setParent(this);
        }

    }

    removeNode(indexOctant: number) {

        const index = this.nodesIndices.indexOf(indexOctant);

        this.nodesIndices.splice(index, 1);

        const node = this.nodesByIndex[indexOctant];

        delete this.nodesByIndex[indexOctant];

        if (node.parent === this) {
            node.setParent(undefined);
        }

    }

    addObject(object: OctreeObjectData) {

        // get object octant index
        const indexOctant = this.getOctantIndex(object);

        if (indexOctant > -1 && this.nodesIndices.length > 0) {

            // if object fully contained by an octant, add to subtree
            const node = this.branch(indexOctant);
            node.addObject(object);

        } else if (indexOctant < -1 && this.parent instanceof OctreeNode) {

            // if object lies outside bounds, add to parent node
            this.parent.addObject(object);

        } else {

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

    addObjectWithoutCheck(objects: OctreeObjectData[]) {

        for (let i = 0, l = objects.length; i < l; i++) {
            const object = objects[i];
            this.objects.push(object);
            object.node = this;
        }

    }

    removeObject(object: Mesh | OctreeObjectData): OctreeObjectData[] {

        // cascade through tree to find and remove object
        const {nodesRemovedFrom, objectsDataRemoved} = this.removeObjectRecursive(object, {
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

    removeObjectRecursive(object: Mesh | OctreeObjectData, removeData: RemoveData): RemoveData {

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

        } else {

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

        const objectsExpand: OctreeObjectData[] = [];
        const objectsExpandOctants: number[] = [];
        const objectsSplit: OctreeObjectData[] = [];
        const objectsSplitOctants: number[] = [];
        let objectsRemaining: OctreeObjectData[] = [];

        // for each object
        for (let i = 0, l = this.objects.length; i < l; i++) {

            const object = this.objects[i];

            // get object octant index
            const indexOctant = this.getOctantIndex(object);

            if (indexOctant > -1) {

                // if lies within octant
                objectsSplit.push(object);
                objectsSplitOctants.push(indexOctant);

            } else if (indexOctant < -1) {

                // lies outside radius
                objectsExpand.push(object);
                objectsExpandOctants.push(indexOctant);

            } else {

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

    split(objects: OctreeObjectData[], octants: number[]): OctreeObjectData[] {

        let objectsRemaining: OctreeObjectData[];

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
                } else {
                    objectsRemaining.push(object);
                }
            }

            // if all objects, set remaining as new objects
            if (objects === this.objects) {
                this.objects = objectsRemaining;
            }

        } else {

            objectsRemaining = this.objects;

        }

        return objectsRemaining;

    }

    branch(indexOctant: number): OctreeNode {

        // node exists
        if (this.nodesByIndex[indexOctant] instanceof OctreeNode) {

            return this.nodesByIndex[indexOctant];

        } else {

            // properties
            const radius = this.radiusOverlap * 0.5;
            const overlap = radius * this.tree.overlapPct;
            const radiusOffset = radius - overlap;
            const offset = new Vector3(
                indexOctant & 1 ? radiusOffset : -radiusOffset,
                indexOctant & 2 ? radiusOffset : -radiusOffset,
                indexOctant & 4 ? radiusOffset : -radiusOffset);
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

    expand(objects: OctreeObjectData[], octants: number[]): OctreeObjectData[] {

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
                    } else if (flagOutside & this.tree.FLAG_NEG_X) {
                        iom[this.tree.INDEX_OUTSIDE_NEG_X].count++;
                    }

                    // y
                    if (flagOutside & this.tree.FLAG_POS_Y) {
                        iom[this.tree.INDEX_OUTSIDE_POS_Y].count++;
                    } else if (flagOutside & this.tree.FLAG_NEG_Y) {
                        iom[this.tree.INDEX_OUTSIDE_NEG_Y].count++;
                    }

                    // z
                    if (flagOutside & this.tree.FLAG_POS_Z) {
                        iom[this.tree.INDEX_OUTSIDE_POS_Z].count++;
                    } else if (flagOutside & this.tree.FLAG_NEG_Z) {
                        iom[this.tree.INDEX_OUTSIDE_NEG_Z].count++;
                    }

                    // store in expand list
                    objectsExpand.push(object);

                } else {

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
                const position = new Vector3(
                    indexOctant & 1 ? radiusOffset : -radiusOffset,
                    indexOctant & 2 ? radiusOffset : -radiusOffset,
                    indexOctant & 4 ? radiusOffset : -radiusOffset);
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

        } else {

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

        let nodeParent: OctreeNode = this;
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

    merge(nodes?: OctreeNode | OctreeNode[]) {

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

    contract(nodeRoot: OctreeNode) {

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

    getOctantIndex(objectData: OctreeNode | OctreeObjectData): number {

        let radiusObj;
        let positionObj;

        // handle type

        if (objectData instanceof OctreeObjectData) {

            radiusObj = objectData.radius;
            positionObj = objectData.position;

            // update object data position last
            objectData.positionLast.copy(positionObj);

        } else if (objectData instanceof OctreeNode) {

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
        } else if (!(deltaX + radiusObj < this.overlap)) {
            // x left
            objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
            return objectData.indexOctant;
        }

        if (deltaY - radiusObj > -this.overlap) {
            // y right
            indexOctant = indexOctant | 2;
        } else if (!(deltaY + radiusObj < this.overlap)) {
            // y left
            objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
            return objectData.indexOctant;
        }

        if (deltaZ - radiusObj > -this.overlap) {
            // z right
            indexOctant = indexOctant | 4;
        } else if (!(deltaZ + radiusObj < this.overlap)) {
            // z left
            objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
            return objectData.indexOctant;
        }

        objectData.indexOctant = indexOctant;
        return objectData.indexOctant;

    }

    getOctantIndexFromPosition(x: number, y: number, z: number): number {

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

    search(position: Vector3, radius: number, objects: OctreeObjectData[], direction: Vector3, directionPct?: Vector3): OctreeObjectData[] {

        let intersects = false;

        // test intersects by parameters
        if (direction) {
            intersects = this.intersectRay(position, direction, radius, directionPct);
        } else {
            intersects = this.intersectSphere(position, radius);
        }

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

    intersectSphere(position: Vector3, radius: number): boolean {

        let distance = radius * radius;
        const px = position.x;
        const py = position.y;
        const pz = position.z;

        if (px < this.left) {
            distance -= Math.pow(px - this.left, 2);
        } else if (px > this.right) {
            distance -= Math.pow(px - this.right, 2);
        }

        if (py < this.bottom) {
            distance -= Math.pow(py - this.bottom, 2);
        } else if (py > this.top) {
            distance -= Math.pow(py - this.top, 2);
        }

        if (pz < this.back) {
            distance -= Math.pow(pz - this.back, 2);
        } else if (pz > this.front) {
            distance -= Math.pow(pz - this.front, 2);
        }

        return distance >= 0;

    }

    intersectRay(origin: Vector3, direction: Vector3, distance: number, directionPct?: Vector3): boolean {

        if (typeof directionPct === 'undefined') {
            directionPct = new Vector3(1, 1, 1).divide(direction);
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

    getDepthEnd(depth?: number): number {

        if (this.nodesIndices.length > 0) {

            for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
                const node = this.nodesByIndex[this.nodesIndices[i]];
                depth = node.getDepthEnd(depth);
            }

        } else {

            depth = !depth || this.depth > depth ? this.depth : depth;

        }

        return depth;

    }
    getNodeCountEnd(): number {

        return this.tree.root.getNodeCountRecursive() + 1;

    }

    getNodeCountRecursive(): number {

        let count = this.nodesIndices.length;

        for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
            count += this.nodesByIndex[this.nodesIndices[i]].getNodeCountRecursive();
        }

        return count;

    }

    getObjectsEnd(objects?: OctreeObjectData[]): OctreeObjectData[] {

        objects = (objects || []).concat(this.objects);

        for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
            const node = this.nodesByIndex[this.nodesIndices[i]];
            objects = node.getObjectsEnd(objects);
        }

        return objects;

    }

    getObjectsCountEnd(): number {

        let count = this.objects.length;

        for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
            count += this.nodesByIndex[this.nodesIndices[i]].getObjectsCountEnd();
        }

        return count;

    }

    getObjectsCountStart(): number {

        let count = this.objects.length;
        let parent = this.parent;

        while (parent instanceof OctreeNode) {
            count += parent.objects.length;
            parent = parent.parent;
        }

        return count;

    }

    toConsole(space?: string) {

        const spaceAddition = '   ';

        space = typeof space === 'string' ? space : spaceAddition;

        console.log(this.parent ? space + ' octree NODE > ' : ' octree ROOT > ', this,
            ' // id: ', this.id,
            ' // indexOctant: ', this.indexOctant, '' +
            ' // position: ', this.position.toArray().join(' '), '' +
            ' // radius: ', this.radius,
            ' // depth: ', this.depth);
        console.log(this.parent ? space + ' ' : ' ',
            '+ objects ( ', this.objects.length, ' ) ', this.objects);
        console.log(this.parent ? space + ' ' : ' ',
            '+ children ( ', this.nodesIndices.length, ' ) ', this.nodesIndices, this.nodesByIndex);

        for (let i = 0, l = this.nodesIndices.length; i < l; i++) {
            const node = this.nodesByIndex[this.nodesIndices[i]];
            node.toConsole(space + spaceAddition);
        }

    }

}
