//https://threejs.org/examples/webgl_physics_convex_break.html

import Expo from 'expo';
import React from 'react';
import ExpoTHREE from 'expo-three';
import Touches from '../window/Touches';
import Files from '../Files';
import { Dimensions } from 'react-native';
import { ThreeView } from './index';

import THREE from '../Three';
import 'three/examples/js/geometries/ConvexGeometry';
import 'three/examples/js/ConvexObjectBreaker';
import 'three/examples/js/libs/ammo.js';

const { Ammo } = global;

class Scene extends React.Component {
  static defaultProps = {
    onLoadingUpdated: ({ loaded, total }) => {},
    onFinishedLoading: () => {},
  };

  AR = false;

  shouldComponentUpdate(nextProps, nextState) {
    const { props, state } = this;
    return false;
  }

  render() {
    return (
      <ThreeView
        style={{ flex: 1 }}
        onContextCreate={this.onContextCreateAsync}
        render={this.animate}
        enableAR={this.AR}
      />
    );
  }

  onContextCreateAsync = async (gl, arSession) => {
    const { width, height, scale } = Dimensions.get('window');

    for (var i = 0; i < 500; i++) {
      this.objectsToRemove[i] = null;
    }

    // renderer
    this.renderer = ExpoTHREE.createRenderer({ gl });
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 1.0);
    this.renderer.shadowMap.enabled = true;

    this.setupScene(arSession);

    this.textureLoader = new THREE.TextureLoader();

    // resize listener
    window.addEventListener('resize', this.onWindowResize, false);

    this.setupPhysics();
    await this.createObjects();

    // // setup custom world
    await this.setupWorldAsync();
    this.setupInput();

    this.props.onFinishedLoading();
  };

  createObjects = async () => {
    const createObject = (mass, halfExtents, pos, quat, material) => {
      const object = new THREE.Mesh(
        new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2),
        material
      );
      object.position.copy(pos);
      object.quaternion.copy(quat);
      this.convexBreaker.prepareBreakableObject(
        object,
        mass,
        new THREE.Vector3(),
        new THREE.Vector3(),
        true
      );
      this.createDebrisFromBreakableObject(object);
    };
    // Ground
    this.pos.set(0, -0.5, 0);
    this.quat.set(0, 0, 0, 1);
    var ground = this.createParalellepipedWithPhysics(
      40,
      1,
      40,
      0,
      this.pos,
      this.quat,
      new THREE.MeshPhongMaterial({ color: 0xffffff })
    );
    ground.receiveShadow = true;

    const texture = await ExpoTHREE.createTextureAsync({
      asset: Expo.Asset.fromModule(Files.textures.grid),
    });

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40);
    ground.material.map = texture;
    ground.material.needsUpdate = true;

    // Tower 1
    var towerMass = 1000;
    var towerHalfExtents = new THREE.Vector3(2, 5, 2);
    this.pos.set(-8, 5, 0);
    this.quat.set(0, 0, 0, 1);
    createObject(towerMass, towerHalfExtents, this.pos, this.quat, createMaterial(0xf0a024));

    // Tower 2
    this.pos.set(8, 5, 0);
    this.quat.set(0, 0, 0, 1);
    createObject(towerMass, towerHalfExtents, this.pos, this.quat, createMaterial(0xf4a321));

    //Bridge
    var bridgeMass = 100;
    var bridgeHalfExtents = new THREE.Vector3(7, 0.2, 1.5);
    this.pos.set(0, 10.2, 0);
    this.quat.set(0, 0, 0, 1);
    createObject(bridgeMass, bridgeHalfExtents, this.pos, this.quat, createMaterial(0xb38835));

    // Stones
    var stoneMass = 120;
    var stoneHalfExtents = new THREE.Vector3(1, 2, 0.15);
    var numStones = 8;
    this.quat.set(0, 0, 0, 1);
    for (var i = 0; i < numStones; i++) {
      this.pos.set(0, 2, 15 * (0.5 - i / (numStones + 1)));

      createObject(stoneMass, stoneHalfExtents, this.pos, this.quat, createMaterial(0xb0b0b0));
    }

    // Mountain
    var mountainMass = 860;
    var mountainHalfExtents = new THREE.Vector3(4, 5, 4);
    this.pos.set(5, mountainHalfExtents.y * 0.5, -7);
    this.quat.set(0, 0, 0, 1);
    var mountainPoints = [];
    mountainPoints.push(
      new THREE.Vector3(mountainHalfExtents.x, -mountainHalfExtents.y, mountainHalfExtents.z)
    );
    mountainPoints.push(
      new THREE.Vector3(-mountainHalfExtents.x, -mountainHalfExtents.y, mountainHalfExtents.z)
    );
    mountainPoints.push(
      new THREE.Vector3(mountainHalfExtents.x, -mountainHalfExtents.y, -mountainHalfExtents.z)
    );
    mountainPoints.push(
      new THREE.Vector3(-mountainHalfExtents.x, -mountainHalfExtents.y, -mountainHalfExtents.z)
    );
    mountainPoints.push(new THREE.Vector3(0, mountainHalfExtents.y, 0));
    const mountain = new THREE.Mesh(
      new THREE.ConvexGeometry(mountainPoints),
      createMaterial(0xffb443)
    );
    mountain.position.copy(this.pos);
    mountain.quaternion.copy(this.quat);
    this.convexBreaker.prepareBreakableObject(
      mountain,
      mountainMass,
      new THREE.Vector3(),
      new THREE.Vector3(),
      true
    );
    this.createDebrisFromBreakableObject(mountain);
  };

  setupScene = arSession => {
    const { width, height, scale } = Dimensions.get('window');

    // scene
    this.scene = new THREE.Scene();

    if (this.AR) {
      // AR Background Texture
      this.scene.background = ExpoTHREE.createARBackgroundTexture(arSession, this.renderer);

      /// AR Camera
      this.camera = ExpoTHREE.createARCamera(arSession, width, height, 0.01, 1000);
    } else {
      // Standard Background
      this.scene.background = new THREE.Color(0xbfd1e5);
      this.scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

      /// Standard Camera
      this.camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 2000);
      this.camera.position.set(-14, 8, 16);

      // controls
      this.controls = new THREE.OrbitControls(this.camera);
      this.controls.target.set(0, 2, 0);
      // this.controls.addEventListener('change', this._render); // remove when using animation loop
    }
  };

  setupLights = () => {
    const ambientLight = new THREE.AmbientLight(0x707070);
    this.scene.add(ambientLight);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(-10, 18, 5);
    light.castShadow = true;
    var d = 14;
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;

    light.shadow.camera.near = 2;
    light.shadow.camera.far = 50;

    light.shadow.mapSize.x = 1024;
    light.shadow.mapSize.y = 1024;

    this.scene.add(light);
  };

  setupInput = () => {
    window.document.addEventListener(
      'touchstart',
      event => {
        const { width, height } = Dimensions.get('window');
        const { locationX: x, locationY: y } = event;
        const xPos = x / width * 2 - 1;
        const yPos = -(y / height) * 2 + 1;
        this.mouseCoords.set(xPos, yPos);

        this.raycaster.setFromCamera(this.mouseCoords, this.camera);

        // Creates a ball and throws it
        var ballMass = 35;
        var ballRadius = 0.4;

        var ball = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 14, 10), this.ballMaterial);
        ball.castShadow = true;
        ball.receiveShadow = true;
        var ballShape = new Ammo.btSphereShape(ballRadius);
        ballShape.setMargin(this.margin);
        this.pos.copy(this.raycaster.ray.direction);
        this.pos.add(this.raycaster.ray.origin);
        this.quat.set(0, 0, 0, 1);
        var ballBody = this.createRigidBody(ball, ballShape, ballMass, this.pos, this.quat);

        this.pos.copy(this.raycaster.ray.direction);
        this.pos.multiplyScalar(24);
        ballBody.setLinearVelocity(new Ammo.btVector3(this.pos.x, this.pos.y, this.pos.z));
      },
      false
    );
  };

  setupPhysics = () => {
    // Physics configuration

    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase,
      this.solver,
      this.collisionConfiguration
    );
    this.physicsWorld.setGravity(new Ammo.btVector3(0, -this.gravityConstant, 0));
  };

  convexBreaker = new THREE.ConvexObjectBreaker();
  mouseCoords = new THREE.Vector2();
  raycaster = new THREE.Raycaster();
  ballMaterial = new THREE.MeshPhongMaterial({ color: 0x202020 });
  gravityConstant = 7.8;
  collisionConfiguration;
  dispatcher;
  broadphase;
  solver;
  physicsWorld;
  margin = 0.05;
  textureLoader;

  // Rigid bodies include all movable objects
  rigidBodies = [];

  pos = new THREE.Vector3();
  quat = new THREE.Quaternion();
  transformAux1 = new Ammo.btTransform();
  tempBtVec3_1 = new Ammo.btVector3(0, 0, 0);

  time = 0;

  objectsToRemove = [];

  numObjectsToRemove = 0;

  impactPoint = new THREE.Vector3();
  impactNormal = new THREE.Vector3();

  setupWorldAsync = async () => {
    this.setupLights();
    // this.scene.add(new THREE.GridHelper(4, 10));
  };

  onWindowResize = () => {
    const { width, height, scale } = Dimensions.get('window');

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(width, height);
  };

  animate = delta => {
    this.updatePhysics(delta);

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    this.time += delta;
  };

  createParalellepipedWithPhysics = (sx, sy, sz, mass, pos, quat, material) => {
    var object = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1), material);
    var shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5));
    shape.setMargin(this.margin);

    this.createRigidBody(object, shape, mass, pos, quat);

    return object;
  };

  createDebrisFromBreakableObject = object => {
    object.castShadow = true;
    object.receiveShadow = true;

    const shape = this.createConvexHullPhysicsShape(object.geometry.vertices);
    shape.setMargin(this.margin);

    const body = this.createRigidBody(
      object,
      shape,
      object.userData.mass,
      null,
      null,
      object.userData.velocity,
      object.userData.angularVelocity
    );

    // Set pointer back to the three object only in the debris objects
    const btVecUserData = new Ammo.btVector3(0, 0, 0);
    btVecUserData.threeObject = object;
    body.setUserPointer(btVecUserData);
  };

  createConvexHullPhysicsShape = points => {
    var shape = new Ammo.btConvexHullShape();

    for (var i = 0, il = points.length; i < il; i++) {
      var p = points[i];
      this.tempBtVec3_1.setValue(p.x, p.y, p.z);
      var lastOne = i === il - 1;
      shape.addPoint(this.tempBtVec3_1, lastOne);
    }

    return shape;
  };

  createRigidBody(object, physicsShape, mass, pos, quat, vel, angVel) {
    if (pos) {
      object.position.copy(pos);
    } else {
      pos = object.position;
    }
    if (quat) {
      object.quaternion.copy(quat);
    } else {
      quat = object.quaternion;
    }

    var transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    var motionState = new Ammo.btDefaultMotionState(transform);

    var localInertia = new Ammo.btVector3(0, 0, 0);
    physicsShape.calculateLocalInertia(mass, localInertia);

    var rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      physicsShape,
      localInertia
    );
    var body = new Ammo.btRigidBody(rbInfo);

    body.setFriction(0.5);

    if (vel) {
      body.setLinearVelocity(new Ammo.btVector3(vel.x, vel.y, vel.z));
    }
    if (angVel) {
      body.setAngularVelocity(new Ammo.btVector3(angVel.x, angVel.y, angVel.z));
    }

    object.userData.physicsBody = body;
    object.userData.collided = false;

    this.scene.add(object);

    if (mass > 0) {
      this.rigidBodies.push(object);

      // Disable deactivation
      body.setActivationState(4);
    }

    this.physicsWorld.addRigidBody(body);

    return body;
  }

  removeDebris = object => {
    this.scene.remove(object);
    this.physicsWorld.removeRigidBody(object.userData.physicsBody);
  };
  updatePhysics = deltaTime => {
    // Step world
    this.physicsWorld.stepSimulation(deltaTime, 10);

    // Update rigid bodies
    for (let i = 0, il = this.rigidBodies.length; i < il; i++) {
      const objThree = this.rigidBodies[i];
      const objPhys = objThree.userData.physicsBody;
      const ms = objPhys.getMotionState();
      if (ms) {
        ms.getWorldTransform(this.transformAux1);
        var p = this.transformAux1.getOrigin();
        var q = this.transformAux1.getRotation();
        objThree.position.set(p.x(), p.y(), p.z());
        objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());

        objThree.userData.collided = false;
      }
    }

    for (let i = 0, il = this.dispatcher.getNumManifolds(); i < il; i++) {
      const contactManifold = this.dispatcher.getManifoldByIndexInternal(i);
      const rb0 = contactManifold.getBody0();
      const rb1 = contactManifold.getBody1();

      let threeObject0 = Ammo.castObject(rb0.getUserPointer(), Ammo.btVector3).threeObject;
      let threeObject1 = Ammo.castObject(rb1.getUserPointer(), Ammo.btVector3).threeObject;

      if (!threeObject0 && !threeObject1) {
        continue;
      }

      const userData0 = threeObject0 ? threeObject0.userData : null;
      const userData1 = threeObject1 ? threeObject1.userData : null;

      const breakable0 = userData0 ? userData0.breakable : false;
      const breakable1 = userData1 ? userData1.breakable : false;

      const collided0 = userData0 ? userData0.collided : false;
      const collided1 = userData1 ? userData1.collided : false;

      if ((!breakable0 && !breakable1) || (collided0 && collided1)) {
        continue;
      }

      var contact = false;
      var maxImpulse = 0;
      for (var j = 0, jl = contactManifold.getNumContacts(); j < jl; j++) {
        var contactPoint = contactManifold.getContactPoint(j);
        if (contactPoint.getDistance() < 0) {
          contact = true;
          var impulse = contactPoint.getAppliedImpulse();
          if (impulse > maxImpulse) {
            maxImpulse = impulse;
            var pos = contactPoint.get_m_positionWorldOnB();
            var normal = contactPoint.get_m_normalWorldOnB();
            this.impactPoint.set(pos.x(), pos.y(), pos.z());
            this.impactNormal.set(normal.x(), normal.y(), normal.z());
          }
          break;
        }
      }

      // If no point has contact, abort
      if (!contact) {
        continue;
      }

      // Subdivision

      const fractureImpulse = 250;

      if (breakable0 && !collided0 && maxImpulse > fractureImpulse) {
        var debris = this.convexBreaker.subdivideByImpact(
          threeObject0,
          this.impactPoint,
          this.impactNormal,
          1,
          2,
          1.5
        );

        const _numObjects = debris.length;
        for (var j = 0; j < _numObjects; j++) {
          this.createDebrisFromBreakableObject(debris[j]);
        }

        this.objectsToRemove[this.numObjectsToRemove++] = threeObject0;
        userData0.collided = true;
      }

      if (breakable1 && !collided1 && maxImpulse > fractureImpulse) {
        var debris = this.convexBreaker.subdivideByImpact(
          threeObject1,
          this.impactPoint,
          this.impactNormal,
          1,
          2,
          1.5
        );

        const _numObjects = debris.length;
        for (var j = 0; j < _numObjects; j++) {
          this.createDebrisFromBreakableObject(debris[j]);
        }

        this.objectsToRemove[this.numObjectsToRemove++] = threeObject1;
        userData1.collided = true;
      }
    }

    for (var i = 0; i < this.numObjectsToRemove; i++) {
      this.removeDebris(this.objectsToRemove[i]);
    }
    this.numObjectsToRemove = 0;
  };
}

function createRandomColor() {
  return Math.floor(Math.random() * (1 << 24));
}

function createMaterial(color) {
  color = color || createRandomColor();
  return new THREE.MeshPhongMaterial({ color });
}

export default Touches(Scene);
