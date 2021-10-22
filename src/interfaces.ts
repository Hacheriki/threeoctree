import { Face, Mesh, Scene, Vector3 } from 'three';
import { Octree, OctreeNode, OctreeObjectData } from './internal';

/**
 * Optional parameters for initialization.
 */

export interface OctreeParameters<T extends Mesh = Mesh> {

    /**
     * Pass scene only if you wish to visualize the octree.
     */

    scene?: Scene | undefined;

    /**
     * Maximum depth of tree.
     * @default Infinity
     */

    depthMax?: number | undefined;

    /**
     * Max number of objects before nodes split or merge.
     * @default 8
     */

    objectsThreshold?: number | undefined;

    /**
     * Percent between 0 and 1 that nodes will overlap each other.
     * This helps to sort objects that overlap nodes.
     * @default 0.15
     */

    overlapPct?: number | undefined;

    /**
     * If true, objects are inserted immediately instead of being deferred until next `octree.update()` call.
     * This may decrease performance as it forces a matrix update.
     * @default false
     */

    undeferred?: boolean | undefined;
    tree?: Octree<T> | undefined;
    root?: OctreeNode<T> | undefined;
    INDEX_OUTSIDE_POS_X?: number | undefined;
    INDEX_OUTSIDE_NEG_X?: number | undefined;
    INDEX_OUTSIDE_POS_Y?: number | undefined;
    INDEX_OUTSIDE_NEG_Y?: number | undefined;
    INDEX_OUTSIDE_POS_Z?: number | undefined;
    INDEX_OUTSIDE_NEG_Z?: number | undefined;
}

export interface OctreeNodeParameters<T extends Mesh> extends OctreeParameters<T> {
    parent?: OctreeNode<T> | undefined;
    position?: Vector3 | undefined;
    radius?: number | undefined;
    indexOctant?: number | undefined;
}

/**
 * Options for adding a mesh to the octree.
 * Note that only vertices OR faces can be used, and `useVertices` overrides `useFaces`.
 */

export interface ObjectOptions {

    /**
     * If true, add mesh's faces as octree objects.
     */

    useFaces?: boolean | undefined;

    /**
     * If true, add mesh's vertices as octree objects.
     */

    useVertices?: boolean | undefined;
}

export interface GenericObject {
    id: string | number;
    uuid?: string;
    radius: number;
    x: number;
    y: number;
    z: number;
}

export interface ResultData<T extends Mesh = Mesh> {
    object: T;
    faces: Face[];
    vertices: Vector3[];
}

export interface RemoveData<T extends Mesh> {
    searchComplete: boolean;
    nodesRemovedFrom: OctreeNode<T>[];
    objectsDataRemoved: OctreeObjectData<T>[];
}
