import { Face, Mesh, Scene, Vector3 } from 'three';
import { OctreeNode } from './OctreeNode';
import { Octree } from './Octree';
import { OctreeObjectData } from './OctreeObjectData';

export interface OctreeParameters {
    tree?: Octree;
    scene?: Scene;
    depthMax?: number;
    objectsThreshold?: number;
    overlapPct?: number;
    undeferred?: boolean;
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

export interface ObjectOptions {
    useFaces?: boolean;
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
