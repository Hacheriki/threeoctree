# threeoctree

### (sparse + dynamic) 3D spatial representation structure for fast searches

Fully featured search tree for the [three.js WebGL library](https://github.com/mrdoob/three.js).

See [demo examples](https://brakebein.github.io/threeoctree)

### Acknowledgement

The original library has been implemented by [Collin Hover](https://github.com/collinhover/threeoctree)
based on Dynamic Octree by [Piko3D](http://www.piko3d.com/) and Octree by [Marek Pawlowski](pawlowski.it).

Since the original repo hasn't been updated for years, the aim of this repo is to bring it up-to-date with the latest three.js release (r133).
It also adds type declarations.
However, it also drops support for `Geometry`, since it has been removed from three.js core.
Only `BufferGeometry` is supported.
  
## Features

* handle complete objects ( i.e. 1 center position for entire geometry )
* handle object faces ( i.e. split a complex mesh's geometry into a series of pseudo-objects )
* handle both objects and faces together in a single octree
* overlapping nodes to help sort objects that overlap multiple nodes much more efficiently ( overlap is percentage based )
* split ( 1 larger octree node > up to 8 smaller octree nodes )
* merge ( up to 8 smaller octree nodes > 1 larger octree node )
* expand ( 1 smaller octree node > 1 larger octree node + original smaller octree node + up to 7 other smaller octree nodes ) 
* contract ( 1 larger octree node + entire subtree > 1 smaller octree node )
* rebuild ( account for moving objects, trade-off is performance and is not recommended )
* search by position and radius ( i.e. sphere search )
* search by ray using position, direction, and distance/far ( does not include specific collisions, only potential )
* raycast search results using `THREE.OctreeRaycaster`
    
### Needs

* reworking / optimization of insert and removal ( currently we have to force a transform update in case the object is added before first three update )
* `OctreeRaycaster`: consider backface culling with respect to `material.side` ( `FrontSide | BackSide | DoubleSide` )

## Usage

Download the [latest script](https://github.com/Brakebein/threeoctree/tree/master/build)
and include it in your html after three.js:

```html
<script src="js/three.min.js"></script>
<script src="js/threeoctree.min.js"></script>
<script>
  const octree = new THREE.Octree();
</script>
```

Usage with npm and ES modules:

```
npm install threeoctree
```

```javascript
import { Octree } from 'threeoctree';

const octree = new Octree();
```

### Initialize

```javascript
const octree = new THREE.Octree({
    undeferred: false, // optional, default = false, octree will defer insertion until you call octree.update();
    depthMax: Infinity, // optional, default = Infinity, infinite depth
    objectsThreshold: 8, // optional, default = 8
    overlapPct: 0.15, // optional, default = 0.15 (15%), this helps sort objects that overlap nodes
    scene: scene // optional, pass scene as parameter only if you wish to visualize octree
});
```

### Add/Remove Objects

Add mesh as single octree object:  
  
```javascript
octree.add( mesh );
```
  
Add mesh's faces as octree objects:  
  
```javascript
octree.add( mesh, { useFaces: true } );
```
  
Add mesh's vertices as octree objects:  
  
```javascript
octree.add( mesh, { useVertices: true } );
```
( note that only vertices OR faces can be used, and useVertices overrides useFaces )

Remove all octree objects associated with a mesh:  
  
```javascript
octree.remove( mesh );
```

### Update
  
When `octree.add( object )` is called and `octree.undeferred !== true`, insertion for that object is deferred until the octree is updated.
Update octree to insert all deferred objects **after render cycle** to makes sure object matrices are up-to-date.

```javascript
renderer.render( scene, camera );
octree.update();
```

### Rebuild

To account for moving objects within the octree:

```javascript
octree.rebuild();
```
  
### Search

Search octree at a position in all directions for radius distance:  
  
```javascript
octree.search( position, radius );
```

Search octree and organize results by object (i.e. all faces/vertices belonging to three object in one list vs a result for each face/vertex):  
  
```javascript
octree.search( position, radius, true );
```

Search octree using a ray:  
  
```javascript
octree.search( ray.origin, ray.far, true, ray.direction );
```

### Intersections

The `OctreeRaycaster` extends the `THREE.Raycaster` class by two methods to help use the search results:
`intersectOctreeObjects()` and `intersectOctreeObject()`.
In most cases you will use only the former:  
  
```javascript
const octreeResults = octree.search( raycaster.ray.origin, raycaster.ray.far, true, raycaster.ray.direction );
const intersections = raycaster.intersectOctreeObjects( octreeResults );
```

If you wish to get an intersection from a user's mouse click, this is easy enough:

```javascript
function onClick ( event ) {
    
    const mouse = new THREE.Vector2(
        ( event.pageX / window.innerWidth ) * 2 - 1,
        -( event.pageY / window.innerHeight ) * 2 + 1
    );

    // set raycaster
  
    const raycaster = new THREE.OctreeRaycaster();
    raycaster.setFromCamera( mouse, camera );

    // now search octree and find intersections using method above
  
    const octreeResults = octree.search( raycaster.ray.origin, raycaster.ray.far, true, raycaster.ray.direction );
    const intersections = raycaster.intersectOctreeObjects( octreeResults );
    
    // ...
    
}
```

### TypeScript usage

Make use of generics in TypeScript: 

```typescript
import { BoxGeometry, MeshBasicMaterial } from 'three';
import { Octree } from 'threeoctree';

const octree = new Octree<Mesh<BoxGeometry, MeshBasicMaterial>>();

const mesh = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );

octree.add( mesh );

// ...

const octreeResults = octree.search( position, radius, true );

octreeResults[0].object // -> Mesh<BoxGeometry, MeshBasicMaterial>
```
