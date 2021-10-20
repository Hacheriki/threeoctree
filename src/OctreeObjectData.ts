import {
    Face,
    Mesh,
    Vector3
} from 'three';
import { OctreeNode } from './internal';

export class OctreeObjectData {

    node: OctreeNode;
    object: Mesh;
    faces: Face;
    vertices: Vector3;
    useFaces = false;
    useVertices = false;
    radius: number;
    position: Vector3;
    positionLast: Vector3;
    indexOctant?: number;

    constructor( object: Mesh, part?: Face | Vector3 ) {

        this.object = object;

        // handle part by type

        if ( part instanceof Vector3 ) {

            this.vertices = part;
            this.useVertices = true;

        } else if ( part ) {

            this.faces = part;
            this.useFaces = true;

        }

        this.radius = 0;
        this.position = new Vector3();

        // initial update

        this.update();

        this.positionLast = this.position.clone();

    }

    update() {

        if ( this.faces ) {

            const { center, radius } = this.getFace3BoundingSphere( this.object, this.faces );

            this.radius = radius;
            this.position.copy( center ).applyMatrix4( this.object.matrixWorld );

        } else if ( this.vertices ) {

            if ( ! this.object.geometry.boundingSphere ) {

                this.object.geometry.computeBoundingSphere();

            }

            this.radius = this.object.geometry.boundingSphere.radius;
            this.position.copy( this.vertices ).applyMatrix4( this.object.matrixWorld );

        } else {

            if ( ! this.object.geometry.boundingSphere ) {

                this.object.geometry.computeBoundingSphere();

            }

            this.radius = this.object.geometry.boundingSphere.radius;
            this.position.copy( this.object.geometry.boundingSphere.center ).applyMatrix4( this.object.matrixWorld );

        }

        this.radius = this.radius * Math.max( this.object.scale.x, this.object.scale.y, this.object.scale.z );

    }

    getFace3BoundingSphere( object: Mesh, face: Face ): {center: Vector3, radius: number} {

        let va: Vector3;
        let vb: Vector3;
        let vc: Vector3;

        const position = object.geometry.getAttribute( 'position' );

        va = new Vector3().fromBufferAttribute( position, face.a );
        vb = new Vector3().fromBufferAttribute( position, face.b );
        vc = new Vector3().fromBufferAttribute( position, face.c );

        const utilVec3 = new Vector3();
        const center = new Vector3().addVectors( va, vb ).add( vc ).divideScalar( 3 );
        const radius = Math.max(
            utilVec3.subVectors( center, va ).length(),
            utilVec3.subVectors( center, vb ).length(),
            utilVec3.subVectors( center, vc ).length()
        );

        return { center, radius };

    }

}
