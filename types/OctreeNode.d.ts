import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { Octree, OctreeNodeParameters, OctreeObjectData, RemoveData } from './internal';
export declare class OctreeNode<T extends Mesh = Mesh> {

    tree: Octree<T>;
    parent: OctreeNode<T>;
    id: number;
    position: Vector3;
    radius: number;
    indexOctant: number;
    depth: number;
    overlap: number;
    radiusOverlap: number;
    objects: OctreeObjectData<T>[];
    nodesIndices: number[];
    nodesByIndex: {
        [key: number]: OctreeNode<T>;
    };
    left: number;
    right: number;
    bottom: number;
    top: number;
    back: number;
    front: number;
    visual: Mesh<BoxGeometry, MeshBasicMaterial>;
    constructor( parameters?: OctreeNodeParameters<T> );
    setParent( parent: OctreeNode<T> ): void;
    updateProperties(): void;
    reset( cascade?: boolean, removeVisual?: boolean ): void;
    addNode( node: OctreeNode<T>, indexOctant: number ): void;
    removeNode( indexOctant: number ): void;
    addObject( object: OctreeObjectData<T> ): void;
    addObjectWithoutCheck( objects: OctreeObjectData<T>[] ): void;
    removeObject( object: T | OctreeObjectData<T> ): OctreeObjectData<T>[];
    removeObjectRecursive( object: T | OctreeObjectData<T>, removeData: RemoveData<T> ): RemoveData<T>;
    checkGrow(): void;
    grow(): void;
    split( objects: OctreeObjectData<T>[], octants: number[] ): OctreeObjectData<T>[];
    branch( indexOctant: number ): OctreeNode<T>;
    expand( objects: OctreeObjectData<T>[], octants: number[] ): OctreeObjectData<T>[];
    shrink(): void;
    checkMerge(): void;
    merge( nodes?: OctreeNode<T> | OctreeNode<T>[] ): void;
    checkContract(): void;
    contract( nodeRoot: OctreeNode<T> ): void;
    getOctantIndex( objectData: OctreeNode<T> | OctreeObjectData<T> ): number;
    getOctantIndexFromPosition( x: number, y: number, z: number ): number;
    search( position: Vector3, radius: number, objects: OctreeObjectData<T>[], direction: Vector3, directionPct?: Vector3 ): OctreeObjectData<T>[];
    intersectSphere( position: Vector3, radius: number ): boolean;
    intersectRay( origin: Vector3, direction: Vector3, distance: number, directionPct?: Vector3 ): boolean;
    getDepthEnd( depth?: number ): number;
    getNodeCountEnd(): number;
    getNodeCountRecursive(): number;
    getObjectsEnd( objects?: OctreeObjectData<T>[] ): OctreeObjectData<T>[];
    getObjectsCountEnd(): number;
    getObjectsCountStart(): number;
    toConsole( space?: string ): void;

}
