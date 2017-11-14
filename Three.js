import * as THREE from 'three';
global.THREE = THREE;
export default THREE;

//Physics
require('./libs/ammo');
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/ConvexObjectBreaker');
require('three/examples/js/QuickHull');
require('three/examples/js/geometries/ConvexGeometry');
console.ignoredYellowBox = ['THREE.WebGLRenderer', 'THREE.WebGLProgram'];
require('react-native-console-time-polyfill');
