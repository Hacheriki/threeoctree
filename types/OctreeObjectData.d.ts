import { Face3, Mesh, Vector3 } from 'three';
import { OctreeNode } from './OctreeNode';
export declare class OctreeObjectData {
    node: OctreeNode;
    object: Mesh;
    faces: Face3;
    vertices: Vector3;
    useFaces: boolean;
    useVertices: boolean;
    radius: number;
    position: Vector3;
    positionLast: Vector3;
    indexOctant?: number;
    constructor(object: Mesh, part?: Face3 | Vector3);
    update(): void;
    getFace3BoundingSphere(object: Mesh, face: Face3): {
        center: Vector3;
        radius: number;
    };
}
