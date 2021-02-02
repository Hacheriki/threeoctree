import { Face, Mesh, Vector3 } from 'three';
import { OctreeNode } from './OctreeNode';
export declare class OctreeObjectData {
    node: OctreeNode;
    object: Mesh;
    faces: Face;
    vertices: Vector3;
    useFaces: boolean;
    useVertices: boolean;
    radius: number;
    position: Vector3;
    positionLast: Vector3;
    indexOctant?: number;
    constructor(object: Mesh, part?: Face | Vector3);
    update(): void;
    getFace3BoundingSphere(object: Mesh, face: Face): {
        center: Vector3;
        radius: number;
    };
}
