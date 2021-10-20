import {
    BoxBufferGeometry,
    BufferAttribute,
    BufferGeometry,
    Face,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    Scene,
    Vector3
} from 'three';
import {
    indexOfPropertyWithValue,
    isNumber,
    ObjectOptions,
    OctreeNode,
    OctreeObjectData,
    OctreeParameters,
    ResultData
} from './internal';

export class Octree {

    // static properties ( modification is not recommended )

    nodeCount = 0;

    INDEX_INSIDE_CROSS = - 1;
    INDEX_OUTSIDE_OFFSET = 2;

    INDEX_OUTSIDE_POS_X: number;
    INDEX_OUTSIDE_NEG_X: number;
    INDEX_OUTSIDE_POS_Y: number;
    INDEX_OUTSIDE_NEG_Y: number;
    INDEX_OUTSIDE_POS_Z: number;
    INDEX_OUTSIDE_NEG_Z: number;

    INDEX_OUTSIDE_MAP: {index: number, count: number, x: number, y: number, z: number}[] = [];

    FLAG_POS_X: number;
    FLAG_NEG_X: number;
    FLAG_POS_Y: number;
    FLAG_NEG_Y: number;
    FLAG_POS_Z: number;
    FLAG_NEG_Z: number;

    utilVec31Search = new Vector3();
    utilVec32Search = new Vector3();

    // properties

    scene: Scene;
    visualGeometry: BoxBufferGeometry;
    visualMaterial: MeshBasicMaterial;

    objects: Mesh[] = [];
    objectsMap: {[key: string]: Mesh} = {};
    objectsData: OctreeObjectData[] = [];
    objectsDeferred: {object: Mesh | OctreeObjectData, options: ObjectOptions}[] = [];

    depthMax: number;
    objectsThreshold: number;
    overlapPct: number;
    undeferred = false;

    root: OctreeNode;

    constructor( parameters: OctreeParameters = {} ) {

        parameters.tree = this;

        this.INDEX_OUTSIDE_POS_X = isNumber( parameters.INDEX_OUTSIDE_POS_X ) ? parameters.INDEX_OUTSIDE_POS_X : 0;
        this.INDEX_OUTSIDE_NEG_X = isNumber( parameters.INDEX_OUTSIDE_NEG_X ) ? parameters.INDEX_OUTSIDE_NEG_X : 1;
        this.INDEX_OUTSIDE_POS_Y = isNumber( parameters.INDEX_OUTSIDE_POS_Y ) ? parameters.INDEX_OUTSIDE_POS_Y : 2;
        this.INDEX_OUTSIDE_NEG_Y = isNumber( parameters.INDEX_OUTSIDE_NEG_Y ) ? parameters.INDEX_OUTSIDE_NEG_Y : 3;
        this.INDEX_OUTSIDE_POS_Z = isNumber( parameters.INDEX_OUTSIDE_POS_Z ) ? parameters.INDEX_OUTSIDE_POS_Z : 4;
        this.INDEX_OUTSIDE_NEG_Z = isNumber( parameters.INDEX_OUTSIDE_NEG_Z ) ? parameters.INDEX_OUTSIDE_NEG_Z : 5;

        this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_POS_X ] = { index: this.INDEX_OUTSIDE_POS_X, count: 0, x: 1, y: 0, z: 0 };
        this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_NEG_X ] = { index: this.INDEX_OUTSIDE_NEG_X, count: 0, x: - 1, y: 0, z: 0 };
        this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_POS_Y ] = { index: this.INDEX_OUTSIDE_POS_Y, count: 0, x: 0, y: 1, z: 0 };
        this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_NEG_Y ] = { index: this.INDEX_OUTSIDE_NEG_Y, count: 0, x: 0, y: - 1, z: 0 };
        this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_POS_Z ] = { index: this.INDEX_OUTSIDE_POS_Z, count: 0, x: 0, y: 0, z: 1 };
        this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_NEG_Z ] = { index: this.INDEX_OUTSIDE_NEG_Z, count: 0, x: 0, y: 0, z: - 1 };

        this.FLAG_POS_X = 1 << ( this.INDEX_OUTSIDE_POS_X + 1 );
        this.FLAG_NEG_X = 1 << ( this.INDEX_OUTSIDE_NEG_X + 1 );
        this.FLAG_POS_Y = 1 << ( this.INDEX_OUTSIDE_POS_Y + 1 );
        this.FLAG_NEG_Y = 1 << ( this.INDEX_OUTSIDE_NEG_Y + 1 );
        this.FLAG_POS_Z = 1 << ( this.INDEX_OUTSIDE_POS_Z + 1 );
        this.FLAG_NEG_Z = 1 << ( this.INDEX_OUTSIDE_NEG_Z + 1 );

        // pass scene to see octree structure

        this.scene = parameters.scene;

        if ( this.scene ) {

            this.visualGeometry = new BoxBufferGeometry( 1, 1, 1 );
            this.visualMaterial = new MeshBasicMaterial( {
                color: 0xff0066,
                wireframe: true,
                wireframeLinewidth: 1
            } );

        }

        // properties

        this.depthMax = isNumber( parameters.depthMax ) ? parameters.depthMax : Infinity;
        this.objectsThreshold = isNumber( parameters.objectsThreshold ) ? parameters.objectsThreshold : 8;
        this.overlapPct = isNumber( parameters.overlapPct ) ? parameters.overlapPct : 0.15;
        this.undeferred = parameters.undeferred || false;

        this.root = parameters.root instanceof OctreeNode ? parameters.root : new OctreeNode( parameters );

    }

    /**
     * When `octree.add( object )` is called and `octree.undeferred !== true`,
     * insertion for that object is deferred until the octree is updated.
     * Update octree to insert all deferred objects after render cycle to make sure object matrices are up to date.
     */

    update() {

        // add any deferred objects that were waiting for render cycle

        if ( this.objectsDeferred.length > 0 ) {

            for ( let i = 0, il = this.objectsDeferred.length; i < il; i ++ ) {

                const { object, options } = this.objectsDeferred[ i ];

                this.addDeferred( object, options );

            }

            this.objectsDeferred.length = 0;

        }

    }

    /**
     * Add mesh as single octree object.
     */

    add( object: Mesh | OctreeObjectData, options?: ObjectOptions ) {

        if ( this.undeferred ) {

            // add immediately

            this.updateObject( object );
            this.addDeferred( object, options );

        } else {

            // defer add until update called

            this.objectsDeferred.push( { object, options } );

        }

    }

    addDeferred( object: Mesh | OctreeObjectData, options?: ObjectOptions ) {

        // ensure object is not object data

        if ( object instanceof OctreeObjectData ) {

            object = object.object;

        }

        if ( ! ( object.geometry instanceof BufferGeometry ) ) {

            throw new Error( 'Unsupported geometry type: Use BufferGeometry!' );

        }

        // check uuid to avoid duplicates

        if ( ! object.uuid ) {

            object.uuid = MathUtils.generateUUID();

        }

        if ( ! this.objectsMap[ object.uuid ] ) {

            // store

            this.objects.push( object );
            this.objectsMap[ object.uuid ] = object;

            // check options

            let useFaces = false;
            let useVertices = false;

            if ( options ) {

                useFaces = options.useFaces;
                useVertices = options.useVertices;

            }

            if ( useVertices === true ) {

                // TODO: support InterleavedBuffer/InterleavedBufferAttribute?

                if ( object.geometry instanceof BufferGeometry && object.geometry.attributes.position instanceof BufferAttribute ) {

                    const position = object.geometry.attributes.position;

                    for ( let i = 0, l = position.count; i < l; i ++ ) {

                        this.addObjectData( object, new Vector3().fromBufferAttribute( position, i ) );

                    }

                }

            } else if ( useFaces === true ) {

                const position = object.geometry.attributes.position;
                const index = object.geometry.index;

                // TODO: support face/vertex normals and colors?
                // TODO: support materialIndex for multiple materials https://github.com/mrdoob/three.js/blob/master/src/objects/Mesh.js#L165-L193

                if ( index ) {

                    // indexed triangles

                    for ( let i = 0, l = index.count; i < l; i += 3 ) {

                        this.addObjectData( object, {
                            a: i, b: i + 1, c: i + 2,
                            normal: new Vector3(), materialIndex: 0
                        } );

                    }

                } else {

                    // every 3 vertices are one triangle

                    for ( let i = 0, l = position.count; i < l; i += 3 ) {

                        this.addObjectData( object, {
                            a: i, b: i + 1, c: i + 2,
                            normal: new Vector3(), materialIndex: 0
                        } );

                    }

                }

            } else {

                this.addObjectData( object );

            }

        }

    }

    addObjectData( object: Mesh, part?: Face | Vector3 ) {

        const objectData = new OctreeObjectData( object, part );

        // add to tree objects data list

        this.objectsData.push( objectData );

        // add to nodes

        this.root.addObject( objectData );

    }

    /**
     * Remove all octree objects associated with the mesh.
     */

    remove( object: Mesh | OctreeObjectData ) {

        // ensure object is not object data for index search

        if ( object instanceof OctreeObjectData ) {

            object = object.object;

        }

        // check uuid

        if ( this.objectsMap[ object.uuid ] ) {

            this.objectsMap[ object.uuid ] = undefined;

            // check and remove from objects, nodes, and data lists

            const index = this.objects.indexOf( object );

            if ( index !== - 1 ) {

                this.objects.splice( index, 1 );

                // remove from nodes

                const objectsDataRemoved = this.root.removeObject( object );

                // remove from objects data list

                for ( let i = 0, l = objectsDataRemoved.length; i < l; i ++ ) {

                    const objectData = objectsDataRemoved[ i ];
                    const indexData = this.objectsData.indexOf( objectData );

                    if ( indexData !== - 1 ) {

                        this.objectsData.splice( indexData, 1 );

                    }

                }

            }

        } else if ( this.objectsDeferred.length > 0 ) {

            // check and remove from deferred

            const index = indexOfPropertyWithValue( this.objectsDeferred, 'object', object );

            if ( index !== - 1 ) {

                this.objectsDeferred.splice( index, 1 );

            }

        }

    }

    extend( octree: Octree ) {

        if ( octree instanceof Octree ) {

            // for each object data

            const objectsData = octree.objectsData;

            for ( let i = 0, l = objectsData.length; i < l; i ++ ) {

                const objectData = objectsData[ i ];

                this.add( objectData, { useFaces: objectData.useFaces, useVertices: objectData.useVertices } );

            }

        }

    }

    /**
     * Rebuild octree to account for moving objects within the tree.
     */

    rebuild() {

        const objectsUpdate: OctreeObjectData[] = [];

        // check all object data for changes in position
        // assumes all object matrices are up to date

        for ( let i = 0, l = this.objectsData.length; i < l; i ++ ) {

            const objectData = this.objectsData[ i ];
            const node = objectData.node;

            // update object

            objectData.update();

            // if position has changed since last organization of object in tree

            if ( node instanceof OctreeNode && ! objectData.positionLast.equals( objectData.position ) ) {

                // get octant index of object within current node

                const indexOctantLast = objectData.indexOctant;
                const indexOctant = node.getOctantIndex( objectData );

                // if object octant index has changed

                if ( indexOctant !== indexOctantLast ) {

                    // add to update list

                    objectsUpdate.push( objectData );

                }

            }

        }

        // update changed objects

        for ( let i = 0, l = objectsUpdate.length; i < l; i ++ ) {

            const objectData = objectsUpdate[ i ];

            // remove object from current node

            objectData.node.removeObject( objectData );

            // add object to tree root

            this.root.addObject( objectData );

        }

    }

    updateObject( object: Object3D | OctreeObjectData ) {

        if ( object instanceof OctreeObjectData ) {

            object = object.object;

        }

        // search all parents between object and root for world matrix update

        const parentCascade = [ object ];
        let parent = object.parent;
        let parentUpdate: Object3D;

        while ( parent ) {

            parentCascade.push( parent );
            parent = parent.parent;

        }

        for ( let i = 0, l = parentCascade.length; i < l; i ++ ) {

            parent = parentCascade[ i ];

            if ( parent.matrixWorldNeedsUpdate ) {

                parentUpdate = parent;

            }

        }

        // update world matrix starting at uppermost parent that needs update

        if ( typeof parentUpdate !== 'undefined' ) {

            parentUpdate.updateMatrixWorld();

        }

    }

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
    search( position: Vector3, radius: number, organizeByObject?: boolean, direction?: Vector3 ): OctreeObjectData[] | ResultData[] {

        let directionPct: Vector3;

        // add root objects

        let objects: OctreeObjectData[] = [].concat( this.root.objects );

        // ensure radius (i.e. distance of ray) is a number

        if ( ! ( radius > 0 ) ) {

            radius = Number.MAX_VALUE;

        }

        // if direction passed, normalize and find pct

        if ( direction instanceof Vector3 ) {

            direction = direction.clone().normalize();
            directionPct = new Vector3( 1, 1, 1 ).divide( direction );

        }

        // search each node of root

        for ( let i = 0, l = this.root.nodesIndices.length; i < l; i ++ ) {

            const node = this.root.nodesByIndex[ this.root.nodesIndices[ i ] ];

            objects = node.search( position, radius, objects, direction, directionPct );

        }

        // if should organize results by object

        if ( organizeByObject === true ) {

            const results: ResultData[] = [];
            const resultsObjectsIndices = [];
            let resultData: ResultData;

            // for each object data found

            for ( let i = 0, l = objects.length; i < l; i ++ ) {

                const objectData = objects[ i ];
                const object = objectData.object;

                const resultObjectIndex = resultsObjectsIndices.indexOf( object );

                // if needed, create new result data

                if ( resultObjectIndex === - 1 ) {

                    resultData = {
                        object,
                        faces: [],
                        vertices: []
                    };

                    results.push( resultData );
                    resultsObjectsIndices.push( object );

                } else {

                    resultData = results[ resultObjectIndex ];

                }

                // object data has faces or vertices, add to list

                if ( objectData.faces ) {

                    resultData.faces.push( objectData.faces );

                } else {

                    resultData.vertices.push( objectData.vertices );

                }

            }

            return results;

        } else {

            return objects;

        }

    }

    findClosestVertex( position: Vector3, radius: number ): Vector3 {

        const search = this.search( position, radius, true ) as ResultData[];

        if ( ! search[ 0 ] ) {

            return null;

        }

        const object = search[ 0 ].object;
        const vertices = search[ 0 ].vertices;

        if ( vertices.length === 0 ) {

            return null;

        }

        let distance;
        let vertex: Vector3 = null;
        const localPosition = object.worldToLocal( position.clone() );

        for ( let i = 0, l = vertices.length; i < l; i ++ ) {

            distance = vertices[ i ].distanceTo( localPosition );

            if ( distance > radius ) {

                continue;

            }

            // use distance in new comparison to find the closest point

            radius = distance;
            vertex = vertices[ i ];

        }

        if ( vertex === null ) {

            return null;

        }

        return object.localToWorld( vertex.clone() );

    }

    setRoot( root: OctreeNode ) {

        if ( root instanceof OctreeNode ) {

            // store new root

            this.root = root;

            // update properties

            this.root.updateProperties();

        }

    }

    getDepthEnd(): number {

        return this.root.getDepthEnd();

    }

    getNodeCountEnd(): number {

        return this.root.getNodeCountEnd();

    }

    getObjectCountEnd(): number {

        return this.root.getObjectsCountEnd();

    }

    toConsole() {

        this.root.toConsole();

    }

}
