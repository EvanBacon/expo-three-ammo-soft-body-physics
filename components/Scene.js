//https://threejs.org/examples/webgl_physics_convex_break.html

import Expo from 'expo';
import React from 'react';
import ExpoTHREE from 'expo-three';
import Touches from '../window/Touches';
import Files from '../Files';
import { Dimensions } from 'react-native';
import { ThreeView } from './index';

import THREE from '../Three';

const { Ammo } = global;

const USE_SHADOWS = false;
const USE_AR = false;

class Scene extends React.Component {
  static defaultProps = {
    onLoadingUpdated: ({ loaded, total }) => {},
    onFinishedLoading: () => {},
  };

  mouseCoords = new THREE.Vector2();
  raycaster = new THREE.Raycaster();
  ballMaterial = new THREE.MeshPhongMaterial({ color: 0x202020 });
  gravityConstant = -9.8;
  collisionConfiguration;
  physicsWorld;
  margin = 0.05;

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

  clickRequest = false;
  pos = new THREE.Vector3();
  quat = new THREE.Quaternion();
  // Physics variables
  softBodies = [];
  softBodyHelpers = new Ammo.btSoftBodyHelpers();

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
        enableAR={USE_AR}
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
    this.renderer.shadowMap.enabled = USE_SHADOWS;

    this.setupScene(arSession);

    // resize listener
    Dimensions.addEventListener('change', this.onResize);

    this.setupPhysics();

    // // setup custom world
    await this.setupWorldAsync();
    await this.createObjects();
    this.setupInput();

    this.props.onFinishedLoading();
  };

  setupPhysics = () => {
    // Physics configuration
    const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    const softBodySolver = new Ammo.btDefaultSoftBodySolver();
    this.physicsWorld = new Ammo.btSoftRigidDynamicsWorld(
      dispatcher,
      broadphase,
      solver,
      collisionConfiguration,
      softBodySolver
    );
    this.physicsWorld.setGravity(new Ammo.btVector3(0, this.gravityConstant, 0));
    this.physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, this.gravityConstant, 0));
  };

  createObjects = async () => {
    // Ground
    this.pos.set(0, -0.5, 0);
    this.quat.set(0, 0, 0, 1);
    const ground = this.createParalellepiped(
      40,
      1,
      40,
      0,
      this.pos,
      this.quat,
      new THREE.MeshPhongMaterial({ color: 0xffffff })
    );
    ground.castShadow = USE_SHADOWS;
    ground.receiveShadow = USE_SHADOWS;

    const texture = await ExpoTHREE.createTextureAsync({
      asset: Expo.Asset.fromModule(Files.textures.grid),
    });
    // textureLoader.load('textures/grid.png', texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40);
    ground.material.map = texture;
    ground.material.needsUpdate = true;
    // });
    // Create soft volumes
    const volumeMass = 15;
    const sphereGeometry = new THREE.SphereBufferGeometry(1.5, 40, 25);
    sphereGeometry.translate(5, 5, 0);
    await this.createSoftVolume(sphereGeometry, volumeMass, 250);
    const boxGeometry = new THREE.BufferGeometry().fromGeometry(
      new THREE.BoxGeometry(1, 1, 5, 4, 4, 20)
    );
    boxGeometry.translate(-2, 5, 0);
    await this.createSoftVolume(boxGeometry, volumeMass, 120);
    // Ramp
    this.pos.set(3, 1, 0);
    this.quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 30 * Math.PI / 180);
    const obstacle = this.createParalellepiped(
      10,
      1,
      4,
      0,
      this.pos,
      this.quat,
      new THREE.MeshPhongMaterial({ color: 0x606060 })
    );
    obstacle.castShadow = USE_SHADOWS;
    obstacle.receiveShadow = USE_SHADOWS;
  };
  processGeometry = bufGeometry => {
    // Obtain a Geometry
    const geometry = new THREE.Geometry().fromBufferGeometry(bufGeometry);
    // Merge the vertices so the triangle soup is converted to indexed triangles
    const vertsDiff = geometry.mergeVertices();
    // Convert again to BufferGeometry, indexed
    const indexedBufferGeom = this.createIndexedBufferGeometryFromGeometry(geometry);
    // Create index arrays mapping the indexed vertices to bufGeometry vertices
    this.mapIndices(bufGeometry, indexedBufferGeom);
  };
  createIndexedBufferGeometryFromGeometry = geometry => {
    const numVertices = geometry.vertices.length;
    const numFaces = geometry.faces.length;
    const bufferGeom = new THREE.BufferGeometry();
    const vertices = new Float32Array(numVertices * 3);
    const indices = new (numFaces * 3 > 65535 ? Uint32Array : Uint16Array)(numFaces * 3);
    for (var i = 0; i < numVertices; i++) {
      const p = geometry.vertices[i];
      var i3 = i * 3;
      vertices[i3] = p.x;
      vertices[i3 + 1] = p.y;
      vertices[i3 + 2] = p.z;
    }
    for (var i = 0; i < numFaces; i++) {
      const f = geometry.faces[i];
      var i3 = i * 3;
      indices[i3] = f.a;
      indices[i3 + 1] = f.b;
      indices[i3 + 2] = f.c;
    }
    bufferGeom.setIndex(new THREE.BufferAttribute(indices, 1));
    bufferGeom.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return bufferGeom;
  };
  isEqual = (x1, y1, z1, x2, y2, z2) => {
    const delta = 0.000001;
    return Math.abs(x2 - x1) < delta && Math.abs(y2 - y1) < delta && Math.abs(z2 - z1) < delta;
  };
  mapIndices = (bufGeometry, { attributes, index }) => {
    // Creates ammoVertices, ammoIndices and ammoIndexAssociation in bufGeometry
    const vertices = bufGeometry.attributes.position.array;
    const idxVertices = attributes.position.array;
    const indices = index.array;
    const numIdxVertices = idxVertices.length / 3;
    const numVertices = vertices.length / 3;
    bufGeometry.ammoVertices = idxVertices;
    bufGeometry.ammoIndices = indices;
    bufGeometry.ammoIndexAssociation = [];
    for (let i = 0; i < numIdxVertices; i++) {
      const association = [];
      bufGeometry.ammoIndexAssociation.push(association);
      const i3 = i * 3;
      for (let j = 0; j < numVertices; j++) {
        const j3 = j * 3;
        if (
          this.isEqual(
            idxVertices[i3],
            idxVertices[i3 + 1],
            idxVertices[i3 + 2],
            vertices[j3],
            vertices[j3 + 1],
            vertices[j3 + 2]
          )
        ) {
          association.push(j3);
        }
      }
    }
  };
  createSoftVolume = async (bufferGeom, mass, pressure) => {
    this.processGeometry(bufferGeom);
    const volume = new THREE.Mesh(bufferGeom, new THREE.MeshPhongMaterial({ color: 0xffffff }));
    volume.castShadow = USE_SHADOWS;
    volume.receiveShadow = USE_SHADOWS;
    volume.frustumCulled = false;
    this.scene.add(volume);
    const texture = await ExpoTHREE.createTextureAsync({
      asset: Expo.Asset.fromModule(Files.textures.colors),
    });
    // textureLoader.load('textures/colors.png', texture => {
    volume.material.map = texture;
    volume.material.needsUpdate = true;
    // });
    // Volume physic object
    const volumeSoftBody = this.softBodyHelpers.CreateFromTriMesh(
      this.physicsWorld.getWorldInfo(),
      bufferGeom.ammoVertices,
      bufferGeom.ammoIndices,
      bufferGeom.ammoIndices.length / 3,
      true
    );
    const sbConfig = volumeSoftBody.get_m_cfg();
    sbConfig.set_viterations(40);
    sbConfig.set_piterations(40);
    // Soft-soft and soft-rigid collisions
    sbConfig.set_collisions(0x11);
    // Friction
    sbConfig.set_kDF(0.1);
    // Damping
    sbConfig.set_kDP(0.01);
    // Pressure
    sbConfig.set_kPR(pressure);
    // Stiffness
    volumeSoftBody
      .get_m_materials()
      .at(0)
      .set_m_kLST(0.9);
    volumeSoftBody
      .get_m_materials()
      .at(0)
      .set_m_kAST(0.9);
    volumeSoftBody.setTotalMass(mass, false);
    Ammo.castObject(volumeSoftBody, Ammo.btCollisionObject)
      .getCollisionShape()
      .setMargin(this.margin);
    this.physicsWorld.addSoftBody(volumeSoftBody, 1, -1);
    volume.userData.physicsBody = volumeSoftBody;
    // Disable deactivation
    volumeSoftBody.setActivationState(4);
    this.softBodies.push(volume);
  };
  createParalellepiped = (sx, sy, sz, mass, pos, quat, material) => {
    const threeObject = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1), material);
    const shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5));
    shape.setMargin(this.margin);
    this.createRigidBody(threeObject, shape, mass, pos, quat);
    return threeObject;
  };
  createRigidBody = (threeObject, physicsShape, mass, pos, quat) => {
    threeObject.position.copy(pos);
    threeObject.quaternion.copy(quat);
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    const motionState = new Ammo.btDefaultMotionState(transform);
    const localInertia = new Ammo.btVector3(0, 0, 0);
    physicsShape.calculateLocalInertia(mass, localInertia);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      physicsShape,
      localInertia
    );
    const body = new Ammo.btRigidBody(rbInfo);
    threeObject.userData.physicsBody = body;
    this.scene.add(threeObject);
    if (mass > 0) {
      this.rigidBodies.push(threeObject);
      // Disable deactivation
      body.setActivationState(4);
    }
    this.physicsWorld.addRigidBody(body);
    return body;
  };

  setupScene = arSession => {
    const { width, height, scale } = Dimensions.get('window');

    // scene
    this.scene = new THREE.Scene();

    if (USE_AR) {
      // AR Background Texture
      this.scene.background = ExpoTHREE.createARBackgroundTexture(arSession, this.renderer);

      /// AR Camera
      this.camera = ExpoTHREE.createARCamera(arSession, width, height, 0.01, 1000);
    } else {
      // Standard Background
      this.scene.background = new THREE.Color(0xbfd1e5);
      this.scene.fog = new THREE.FogExp2(0xbfd1e5, 0.002);

      /// Standard Camera
      this.camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 2000);
      this.camera.position.set(-14, 8, 16);

      // controls
      this.controls = new THREE.OrbitControls(this.camera);
      this.controls.target.set(0, 2, 0);
    }
  };

  setupLights = () => {
    const ambientLight = new THREE.AmbientLight(0x707070);
    this.scene.add(ambientLight);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(-1.0, 1.8, 0.5);
    light.castShadow = USE_SHADOWS;
    if (USE_SHADOWS) {
      var d = 1.4;
      light.shadow.camera.left = -d;
      light.shadow.camera.right = d;
      light.shadow.camera.top = d;
      light.shadow.camera.bottom = -d;

      light.shadow.camera.near = 0.2;
      light.shadow.camera.far = 5.0;

      light.shadow.mapSize.x = 1024;
      light.shadow.mapSize.y = 1024;
    }

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
        var ballMass = 64;
        var ballRadius = 0.4;

        var ball = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 14, 10), this.ballMaterial);
        ball.castShadow = USE_SHADOWS;
        ball.receiveShadow = USE_SHADOWS;
        var ballShape = new Ammo.btSphereShape(ballRadius);
        ballShape.setMargin(this.margin);
        this.pos.copy(this.raycaster.ray.direction);
        this.pos.add(this.raycaster.ray.origin);
        this.quat.set(0, 0, 0, 1);
        var ballBody = this.createRigidBody(ball, ballShape, ballMass, this.pos, this.quat);

        this.pos.copy(this.raycaster.ray.direction);
        this.pos.multiplyScalar(64 * event.touches.length);
        ballBody.setLinearVelocity(new Ammo.btVector3(this.pos.x, this.pos.y, this.pos.z));
      },
      false
    );
  };

  setupWorldAsync = async () => {
    this.setupLights();
  };

  onResize = () => {
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

  //http://bulletphysics.org/mediawiki-1.5.8/index.php/Stepping_The_World
  fixedTimeStep = 1 / 30;
  maxSubSteps = 1;
  updatePhysics = deltaTime => {
    // Step world
    this.physicsWorld.stepSimulation(deltaTime, this.maxSubSteps, this.fixedTimeStep);

    // Update soft volumes
    for (var i = 0, il = this.softBodies.length; i < il; i++) {
      const volume = this.softBodies[i];
      const geometry = volume.geometry;
      const softBody = volume.userData.physicsBody;
      const volumePositions = geometry.attributes.position.array;
      const volumeNormals = geometry.attributes.normal.array;
      const association = geometry.ammoIndexAssociation;
      const numVerts = association.length;
      const nodes = softBody.get_m_nodes();
      for (let j = 0; j < numVerts; j++) {
        const node = nodes.at(j);
        const nodePos = node.get_m_x();
        const x = nodePos.x();
        const y = nodePos.y();
        const z = nodePos.z();
        const nodeNormal = node.get_m_n();
        const nx = nodeNormal.x();
        const ny = nodeNormal.y();
        const nz = nodeNormal.z();
        const assocVertex = association[j];
        for (let k = 0, kl = assocVertex.length; k < kl; k++) {
          let indexVertex = assocVertex[k];
          volumePositions[indexVertex] = x;
          volumeNormals[indexVertex] = nx;
          indexVertex++;
          volumePositions[indexVertex] = y;
          volumeNormals[indexVertex] = ny;
          indexVertex++;
          volumePositions[indexVertex] = z;
          volumeNormals[indexVertex] = nz;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
    }
    // Update rigid bodies
    for (var i = 0, il = this.rigidBodies.length; i < il; i++) {
      const objThree = this.rigidBodies[i];
      const objPhys = objThree.userData.physicsBody;
      const ms = objPhys.getMotionState();
      if (ms) {
        ms.getWorldTransform(this.transformAux1);
        const p = this.transformAux1.getOrigin();
        const q = this.transformAux1.getRotation();
        objThree.position.set(p.x(), p.y(), p.z());
        objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
      }
    }
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
