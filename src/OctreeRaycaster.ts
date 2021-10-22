import { Intersection, Mesh, Object3D, Raycaster, Vector3 } from 'three';
import { OctreeObjectData, ResultData } from './internal';

const _vA = new Vector3();
const _vB = new Vector3();
const _vC = new Vector3();
const _intersectionPoint = new Vector3();
const _intersectionPointWorld = new Vector3();

/**
 * Raycaster extended by methods to raycast Octree search results.
 */

export class OctreeRaycaster extends Raycaster {

    /**
   * Checks all intersection between the ray and the octree object with or without the descendants.
   * Intersections are returned sorted by distance, closest first.
   * @param object - The octree object to check for intersection with the ray.
   * @param recursive - If true, it also checks all descendants. Otherwise it only checks intersection with the object. Default is true.
   * @param intersects - (optional) target to set the result. Otherwise a new Array is instantiated.
   */

    intersectOctreeObject<T extends Mesh>( object: OctreeObjectData | ResultData | Object3D, recursive = true, intersects: Intersection<T>[] = [] ): Intersection<T>[] {

        if ( object instanceof Object3D ) {

            // intersect normal object

            intersects.push( ...this.intersectObject<T>( object, recursive ) );

        } else if ( object.object instanceof Mesh ) {

            const mesh = object.object;
            const attr = mesh.geometry.getAttribute( 'position' );

            if ( Array.isArray( object.faces ) && object.faces.length > 0 ) {

                // raycast triangles

                for ( const face of object.faces ) {

                    _vA.fromBufferAttribute( attr, face.a );
                    _vB.fromBufferAttribute( attr, face.b );
                    _vC.fromBufferAttribute( attr, face.c );

                    // TODO: set backface culling according to material.side

                    let intersect = this.ray.intersectTriangle( _vA, _vB, _vC, true, _intersectionPoint );

                    if ( intersect === null ) continue;

                    _intersectionPointWorld.copy( _intersectionPoint );
                    _intersectionPointWorld.applyMatrix4( mesh.matrixWorld );

                    const distance = this.ray.origin.distanceTo( _intersectionPointWorld );

                    if ( distance < this.near || distance > this.far ) continue;

                    intersects.push( {
                        distance,
                        point: _intersectionPointWorld.clone(),
                        object: mesh as T,
                        face
                    } );
                    break;

                }

            } else {

                // intersect

                intersects.push( ...this.intersectObject<T>( mesh, recursive ) );

            }

        } else {

            console.warn( 'OctreeObjectData or ResultData is missing a mesh instance!' );

        }

        return intersects;

    }

    /**
   * Checks all intersection between the ray and the octree objects with or without the descendants.
   * Intersections are returned sorted by distance, closest first.
   * @param objects - The octree objects to check for intersection with the ray.
   * @param recursive - If true, it also checks all descendants. Otherwise it only checks intersection with the object. Default is true.
   * @param intersects - (optional) target to set the result. Otherwise a new Array is instantiated.
   */

    intersectOctreeObjects<T extends Mesh>( objects: ( OctreeObjectData | ResultData | Object3D )[], recursive = true, intersects: Intersection<T>[] = [] ): Intersection<T>[] {

        for ( let i = 0, l = objects.length; i < l; i ++ ) {

            intersects.push( ...this.intersectOctreeObject<T>( objects[ i ], recursive ) );

        }

        intersects.sort( ( a, b ) => a.distance - b.distance );

        return intersects;

    }

}
