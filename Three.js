import * as THREE from 'three';
global.THREE = THREE;
export default THREE;

//Physics
require('./libs/ammo');
require('three/examples/js/controls/OrbitControls');
console.ignoredYellowBox = ['THREE.WebGLRenderer', 'THREE.WebGLProgram'];
require('react-native-console-time-polyfill');
