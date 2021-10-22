import { Intersection, Mesh, Object3D, Raycaster } from 'three';
import { OctreeObjectData, ResultData } from './internal';

/**
 * Raycaster extended by methods to raycast Octree search results.
 */

export declare class OctreeRaycaster extends Raycaster {

    /**
   * Checks all intersection between the ray and the octree object with or without the descendants.
   * Intersections are returned sorted by distance, closest first.
   * @param object - The octree object to check for intersection with the ray.
   * @param recursive - If true, it also checks all descendants. Otherwise it only checks intersection with the object. Default is true.
   * @param intersects - (optional) target to set the result. Otherwise a new Array is instantiated.
   */

    intersectOctreeObject<T extends Mesh>( object: OctreeObjectData | ResultData | Object3D, recursive?: boolean, intersects?: Intersection<T>[] ): Intersection<T>[];

    /**
   * Checks all intersection between the ray and the octree objects with or without the descendants.
   * Intersections are returned sorted by distance, closest first.
   * @param objects - The octree objects to check for intersection with the ray.
   * @param recursive - If true, it also checks all descendants. Otherwise it only checks intersection with the object. Default is true.
   * @param intersects - (optional) target to set the result. Otherwise a new Array is instantiated.
   */

    intersectOctreeObjects<T extends Mesh>( objects: ( OctreeObjectData | ResultData | Object3D )[], recursive?: boolean, intersects?: Intersection<T>[] ): Intersection<T>[];

}
