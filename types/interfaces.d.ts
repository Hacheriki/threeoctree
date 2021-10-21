import { Face, Mesh, Scene, Vector3 } from 'three';
import { Octree, OctreeNode, OctreeObjectData } from './internal';

/**
 * Optional parameters for initialization.
 */

export interface OctreeParameters {

    /**
     * Pass scene only if you wish to visualize the octree.
     */

    scene?: Scene;

    /**
     * Maximum depth of tree.
     * @default Infinity
     */

    depthMax?: number;

    /**
     * Max number of objects before nodes split or merge.
     * @default 8
     */

    objectsThreshold?: number;

    /**
     * Percent between 0 and 1 that nodes will overlap each other.
     * This helps to sort objects that overlap nodes.
     * @default 0.15
     */

    overlapPct?: number;

    /**
     * If true, objects are inserted immediately instead of being deferred until next `octree.update()` call.
     * This may decrease performance as it forces a matrix update.
     * @default false
     */

    undeferred?: boolean;
    tree?: Octree;
    root?: OctreeNode;
    INDEX_OUTSIDE_POS_X?: number;
    INDEX_OUTSIDE_NEG_X?: number;
    INDEX_OUTSIDE_POS_Y?: number;
    INDEX_OUTSIDE_NEG_Y?: number;
    INDEX_OUTSIDE_POS_Z?: number;
    INDEX_OUTSIDE_NEG_Z?: number;
}
export interface OctreeNodeParameters extends OctreeParameters {
    parent?: OctreeNode;
    position?: Vector3;
    radius?: number;
    indexOctant?: number;
}

/**
 * Options for adding a mesh to the octree.
 * Note that only vertices OR faces can be used, and `useVertices` overrides `useFaces`.
 */

export interface ObjectOptions {

    /**
     * If true, add mesh's faces as octree objects.
     */

    useFaces?: boolean;

    /**
     * If true, add mesh's vertices as octree objects.
     */

    useVertices?: boolean;
}
export interface GenericObject {
    id: string | number;
    uuid?: string;
    radius: number;
    x: number;
    y: number;
    z: number;
}
export interface ResultData {
    object: Mesh;
    faces: Face[];
    vertices: Vector3[];
}
export interface RemoveData {
    searchComplete: boolean;
    nodesRemovedFrom: OctreeNode[];
    objectsDataRemoved: OctreeObjectData[];
}
