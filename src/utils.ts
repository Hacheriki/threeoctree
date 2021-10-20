export function isNumber( n ) {

    return ! isNaN( n ) && isFinite( n );

}

export function indexOfPropertyWithValue( array, property, value ) {

    for ( let i = 0, il = array.length; i < il; i ++ ) {

        if ( array[ i ][ property ] === value ) {

            return i;

        }

    }

    return - 1;

}
