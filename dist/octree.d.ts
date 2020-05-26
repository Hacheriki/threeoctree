declare module "OctreeObjectData" {
    import { Face3, Mesh, Vector3 } from 'three';
    import { OctreeNode } from "OctreeNode";
    export class OctreeObjectData {
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
}
declare module "interfaces" {
    import { Face3, Mesh, Scene, Vector3 } from 'three';
    import { OctreeNode } from "OctreeNode";
    import { Octree } from "Octree";
    import { OctreeObjectData } from "OctreeObjectData";
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
        faces: Face3[];
        vertices: Vector3[];
    }
    export interface RemoveData {
        searchComplete: boolean;
        nodesRemovedFrom: OctreeNode[];
        objectsDataRemoved: OctreeObjectData[];
    }
}
declare module "OctreeNode" {
    import { OctreeObjectData } from "OctreeObjectData";
    import { OctreeNodeParameters, RemoveData } from "interfaces";
    import { Octree } from "Octree";
    import { Mesh, Vector3 } from 'three';
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
        constructor(parameters?: OctreeNodeParameters);
        setParent(parent: OctreeNode): void;
        updateProperties(): void;
        reset(cascade?: boolean, removeVisual?: boolean): void;
        addNode(node: OctreeNode, indexOctant: number): void;
        removeNode(indexOctant: number): void;
        addObject(object: OctreeObjectData): void;
        addObjectWithoutCheck(objects: OctreeObjectData[]): void;
        removeObject(object: Mesh | OctreeObjectData): OctreeObjectData[];
        removeObjectRecursive(object: Mesh | OctreeObjectData, removeData: RemoveData): RemoveData;
        checkGrow(): void;
        grow(): void;
        split(objects: OctreeObjectData[], octants: number[]): OctreeObjectData[];
        branch(indexOctant: number): OctreeNode;
        expand(objects: OctreeObjectData[], octants: number[]): OctreeObjectData[];
        shrink(): void;
        checkMerge(): void;
        merge(nodes?: OctreeNode | OctreeNode[]): void;
        checkContract(): void;
        contract(nodeRoot: OctreeNode): void;
        getOctantIndex(objectData: OctreeNode | OctreeObjectData): number;
        getOctantIndexFromPosition(x: number, y: number, z: number): number;
        search(position: Vector3, radius: number, objects: OctreeObjectData[], direction: Vector3, directionPct?: Vector3): OctreeObjectData[];
        intersectSphere(position: Vector3, radius: number): boolean;
        intersectRay(origin: Vector3, direction: Vector3, distance: number, directionPct?: Vector3): boolean;
        getDepthEnd(depth?: number): number;
        getNodeCountEnd(): number;
        getNodeCountRecursive(): number;
        getObjectsEnd(objects?: OctreeObjectData[]): OctreeObjectData[];
        getObjectsCountEnd(): number;
        getObjectsCountStart(): number;
        toConsole(space?: string): void;
    }
}
declare module "utils" {
    export function isNumber(n: any): boolean;
    export function indexOfPropertyWithValue(array: any, property: any, value: any): number;
}
declare module "Octree" {
    import { BoxBufferGeometry, Face3, Mesh, MeshBasicMaterial, Object3D, Scene, Vector3 } from 'three';
    import { OctreeNode } from "OctreeNode";
    import { OctreeObjectData } from "OctreeObjectData";
    import { ObjectOptions, OctreeParameters, ResultData } from "interfaces";
    export class Octree {
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
        constructor(parameters?: OctreeParameters);
        update(): void;
        add(object: Mesh | OctreeObjectData, options?: ObjectOptions): void;
        addDeferred(object: Mesh | OctreeObjectData, options?: ObjectOptions): void;
        addObjectData(object: Mesh, part?: Face3 | Vector3): void;
        remove(object: Mesh | OctreeObjectData): void;
        extend(octree: Octree): void;
        rebuild(): void;
        updateObject(object: Object3D | OctreeObjectData): void;
        search(position: Vector3, radius: number, organizeByObject?: boolean, direction?: Vector3): OctreeObjectData[] | ResultData[];
        findClosestVertex(position: Vector3, radius: number): Vector3;
        setRoot(root: OctreeNode): void;
        getDepthEnd(): number;
        getNodeCountEnd(): number;
        getObjectCountEnd(): number;
        toConsole(): void;
    }
}
declare module "index" {
    import { Octree } from "Octree";
    export { Octree };
}
