import { Mesh, Vector3 } from 'three';
import { Octree, OctreeNodeParameters, OctreeObjectData, RemoveData } from './internal';
export declare class OctreeNode {

    tree: Octree;
    parent: OctreeNode;
    id: number;
    position: Vector3;
    radius: number;
    indexOctant: number;
    depth: number;
    overlap: number;
    radiusOverlap: number;
    objects: OctreeObjectData[];
    nodesIndices: number[];
    nodesByIndex: {
        [key: number]: OctreeNode;
    };
    left: number;
    right: number;
    bottom: number;
    top: number;
    back: number;
    front: number;
    visual: Mesh;
    constructor( parameters?: OctreeNodeParameters );
    setParent( parent: OctreeNode ): void;
    updateProperties(): void;
    reset( cascade?: boolean, removeVisual?: boolean ): void;
    addNode( node: OctreeNode, indexOctant: number ): void;
    removeNode( indexOctant: number ): void;
    addObject( object: OctreeObjectData ): void;
    addObjectWithoutCheck( objects: OctreeObjectData[] ): void;
    removeObject( object: Mesh | OctreeObjectData ): OctreeObjectData[];
    removeObjectRecursive( object: Mesh | OctreeObjectData, removeData: RemoveData ): RemoveData;
    checkGrow(): void;
    grow(): void;
    split( objects: OctreeObjectData[], octants: number[] ): OctreeObjectData[];
    branch( indexOctant: number ): OctreeNode;
    expand( objects: OctreeObjectData[], octants: number[] ): OctreeObjectData[];
    shrink(): void;
    checkMerge(): void;
    merge( nodes?: OctreeNode | OctreeNode[] ): void;
    checkContract(): void;
    contract( nodeRoot: OctreeNode ): void;
    getOctantIndex( objectData: OctreeNode | OctreeObjectData ): number;
    getOctantIndexFromPosition( x: number, y: number, z: number ): number;
    search( position: Vector3, radius: number, objects: OctreeObjectData[], direction: Vector3, directionPct?: Vector3 ): OctreeObjectData[];
    intersectSphere( position: Vector3, radius: number ): boolean;
    intersectRay( origin: Vector3, direction: Vector3, distance: number, directionPct?: Vector3 ): boolean;
    getDepthEnd( depth?: number ): number;
    getNodeCountEnd(): number;
    getNodeCountRecursive(): number;
    getObjectsEnd( objects?: OctreeObjectData[] ): OctreeObjectData[];
    getObjectsCountEnd(): number;
    getObjectsCountStart(): number;
    toConsole( space?: string ): void;

}
