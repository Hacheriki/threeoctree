"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isNumber(n) {
    return !isNaN(n) && isFinite(n);
}
exports.isNumber = isNumber;
function indexOfPropertyWithValue(array, property, value) {
    for (var i = 0, il = array.length; i < il; i++) {
        if (array[i][property] === value) {
            return i;
        }
    }
    return -1;
}
exports.indexOfPropertyWithValue = indexOfPropertyWithValue;
