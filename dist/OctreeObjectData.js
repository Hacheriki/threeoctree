"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var three_1 = require("three");
var OctreeObjectData = /** @class */ (function () {
    function OctreeObjectData(object, part) {
        this.useFaces = false;
        this.useVertices = false;
        this.object = object;
        // handle part by type
        if (part instanceof three_1.Face3) {
            this.faces = part;
            this.useFaces = true;
        }
        else if (part instanceof three_1.Vector3) {
            this.vertices = part;
            this.useVertices = true;
        }
        this.radius = 0;
        this.position = new three_1.Vector3();
        // initial update
        this.update();
        this.positionLast = this.position.clone();
    }
    OctreeObjectData.prototype.update = function () {
        if (this.faces) {
            var _a = this.getFace3BoundingSphere(this.object, this.faces), center = _a.center, radius = _a.radius;
            this.radius = radius;
            this.position.copy(center).applyMatrix4(this.object.matrixWorld);
        }
        else if (this.vertices) {
            if (!this.object.geometry.boundingSphere) {
                this.object.geometry.computeBoundingSphere();
            }
            this.radius = this.object.geometry.boundingSphere.radius;
            this.position.copy(this.vertices).applyMatrix4(this.object.matrixWorld);
        }
        else {
            if (!this.object.geometry.boundingSphere) {
                this.object.geometry.computeBoundingSphere();
            }
            this.radius = this.object.geometry.boundingSphere.radius;
            this.position.copy(this.object.geometry.boundingSphere.center).applyMatrix4(this.object.matrixWorld);
        }
        this.radius = this.radius * Math.max(this.object.scale.x, this.object.scale.y, this.object.scale.z);
    };
    OctreeObjectData.prototype.getFace3BoundingSphere = function (object, face) {
        var va;
        var vb;
        var vc;
        if (object.geometry instanceof three_1.BufferGeometry) {
            // BufferGeometry
            var position = object.geometry.attributes.position;
            va = new three_1.Vector3().fromBufferAttribute(position, face.a);
            vb = new three_1.Vector3().fromBufferAttribute(position, face.b);
            vc = new three_1.Vector3().fromBufferAttribute(position, face.c);
            // const indexA = face.a * position.itemSize;
            // va = new Vector3(position.array[indexA], position.array[indexA + 1], position.array[indexA + 2]);
            // const indexB = face.b * position.itemSize;
            // vb = new Vector3(position.array[indexB], position.array[indexB + 1], position.array[indexB + 2]);
            // const indexC = face.c * position.itemSize;
            // va = new Vector3(position.array[indexC], position.array[indexC + 1], position.array[indexC + 2]);
        }
        else {
            // Geometry
            var vertices = object.geometry.vertices;
            va = vertices[face.a];
            vb = vertices[face.b];
            vc = vertices[face.c];
        }
        var utilVec3 = new three_1.Vector3();
        var center = new three_1.Vector3().addVectors(va, vb).add(vc).divideScalar(3);
        var radius = Math.max(utilVec3.subVectors(center, va).length(), utilVec3.subVectors(center, vb).length(), utilVec3.subVectors(center, vc).length());
        return { center: center, radius: radius };
    };
    return OctreeObjectData;
}());
exports.OctreeObjectData = OctreeObjectData;
