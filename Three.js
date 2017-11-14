import * as THREE from 'three';
global.THREE = THREE;
export default THREE;

//Physics
require('./libs/ammo');
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/ConvexObjectBreaker');
require('three/examples/js/QuickHull');
require('three/examples/js/geometries/ConvexGeometry');

if (!console.time) {
  console.time = () => {};
}
if (!console.timeEnd) {
  console.timeEnd = () => {};
}

console.ignoredYellowBox = ['THREE.WebGLRenderer', 'THREE.WebGLProgram'];
