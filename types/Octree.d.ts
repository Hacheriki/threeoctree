import { BoxBufferGeometry, Face, Mesh, MeshBasicMaterial, Object3D, Scene, Vector3 } from 'three';
import { ObjectOptions, OctreeNode, OctreeObjectData, OctreeParameters, ResultData } from './internal';
export declare class Octree {

    nodeCount: number;
    INDEX_INSIDE_CROSS: number;
    INDEX_OUTSIDE_OFFSET: number;
    INDEX_OUTSIDE_POS_X: number;
    INDEX_OUTSIDE_NEG_X: number;
    INDEX_OUTSIDE_POS_Y: number;
    INDEX_OUTSIDE_NEG_Y: number;
    INDEX_OUTSIDE_POS_Z: number;
    INDEX_OUTSIDE_NEG_Z: number;
    INDEX_OUTSIDE_MAP: {
        index: number;
        count: number;
        x: number;
        y: number;
        z: number;
    }[];
    FLAG_POS_X: number;
    FLAG_NEG_X: number;
    FLAG_POS_Y: number;
    FLAG_NEG_Y: number;
    FLAG_POS_Z: number;
    FLAG_NEG_Z: number;
    utilVec31Search: Vector3;
    utilVec32Search: Vector3;
    scene: Scene;
    visualGeometry: BoxBufferGeometry;
    visualMaterial: MeshBasicMaterial;
    objects: Mesh[];
    objectsMap: {
        [key: string]: Mesh;
    };
    objectsData: OctreeObjectData[];
    objectsDeferred: {
        object: Mesh | OctreeObjectData;
        options: ObjectOptions;
    }[];
    depthMax: number;
    objectsThreshold: number;
    overlapPct: number;
    undeferred: boolean;
    root: OctreeNode;
    constructor( parameters?: OctreeParameters );

    /**
     * When `octree.add( object )` is called and `octree.undeferred !== true`,
     * insertion for that object is deferred until the octree is updated.
     * Update octree to insert all deferred objects after render cycle to make sure object matrices are up to date.
     */

    update(): void;

    /**
     * Add mesh as single octree object.
     */

    add( object: Mesh | OctreeObjectData, options?: ObjectOptions ): void;
    addDeferred( object: Mesh | OctreeObjectData, options?: ObjectOptions ): void;
    addObjectData( object: Mesh, part?: Face | Vector3 ): void;

    /**
     * Remove all octree objects associated with the mesh.
     */

    remove( object: Mesh | OctreeObjectData ): void;
    extend( octree: Octree ): void;

    /**
     * Rebuild octree to account for moving objects within the tree.
     */

    rebuild(): void;
    updateObject( object: Object3D | OctreeObjectData ): void;

    /**
     * Search octree at a position in all directions for radius distance.
     * @param position - Search position
     * @param radius - Radius distance
     * @param organizeByObject - Organize results by object (i.e. all faces/vertices belonging to mesh in one list vs a result for each vertex)
     */

    search( position: Vector3, radius: number, organizeByObject?: boolean ): OctreeObjectData[] | ResultData[];

    /**
     * Search octree using a ray.
     * @param origin - Origin of ray
     * @param far - Maximum distance
     * @param organizeByObject - Organize results by object (i.e. all faces/vertices belonging to mesh in one list vs a result for each vertex)
     * @param direction - Direction of ray
     */

    search( origin: Vector3, far: number, organizeByObject: boolean, direction: Vector3 ): OctreeObjectData[] | ResultData[];
    findClosestVertex( position: Vector3, radius: number ): Vector3;
    setRoot( root: OctreeNode ): void;
    getDepthEnd(): number;
    getNodeCountEnd(): number;
    getObjectCountEnd(): number;
    toConsole(): void;

}
