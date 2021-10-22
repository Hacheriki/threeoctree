import { Face, Mesh, Vector3 } from 'three';
import { OctreeNode } from './internal';
export declare class OctreeObjectData<T extends Mesh = Mesh> {

    node: OctreeNode<T>;
    object: T;
    faces: Face;
    vertices: Vector3;
    useFaces: boolean;
    useVertices: boolean;
    radius: number;
    position: Vector3;
    positionLast: Vector3;
    indexOctant?: number;
    constructor( object: T, part?: Face | Vector3 );
    update(): void;
    getFace3BoundingSphere( object: T, face: Face ): {
        center: Vector3;
        radius: number;
    };

}
