import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { castBulletRay } from '../objects/Bullet';
import { createVisualBullet } from '../objects/BulletVisual';
import { DebugVisualizer } from '../utils/DebugVisualizer';

// Interface for physics world
interface PhysicsWorld {
  world: RAPIER.World;
  rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody>;
}

// FPS Controller class
export class FPSController {
  object: THREE.Object3D;
  camera: THREE.Camera;
  physics: PhysicsWorld;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  canJump: boolean;
  domElement: HTMLElement;
  pitchObject: THREE.Object3D;
  yawObject: THREE.Object3D;
  isLocked: boolean;
  position: THREE.Vector3;
  jumpRequested: boolean;
  lastJumpTime: number;
  isShooting: boolean;
  lastShootTime: number;
  scene: THREE.Scene | null;
  debugVisualizer: DebugVisualizer | null = null;
  
  // Bullet properties
  bulletSpeed: number = 40;
  bulletGravity: number = 9.81; // m/s²
  bulletSize: number = 0.1;
  bulletColor: number = 0xFFFF00;

  constructor(camera: THREE.Camera, physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> }, domElement: HTMLElement) {
    this.camera = camera;
    this.physics = physics;
    this.domElement = domElement;
    this.isLocked = false;
    this.jumpRequested = false;
    this.lastJumpTime = 0;
    this.isShooting = false;
    this.lastShootTime = 0;
    this.scene = null;

    // Create a character controller
    const position = new RAPIER.Vector3(0, 5, 10);
    
    // Create a dynamic rigid body for the player
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinearDamping(0.1)
      .setAngularDamping(0.9)
      .setCcdEnabled(true);

    this.rigidBody = physics.world.createRigidBody(bodyDesc);
    
    // Create a collider for the player (capsule shape)
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.9, 0.3)
      .setDensity(1.0)
      .setFriction(0.2);

    this.collider = physics.world.createCollider(colliderDesc, this.rigidBody);

    // Create a 3D object for the player
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(camera);

    this.yawObject = new THREE.Object3D();
    this.yawObject.position.set(position.x, position.y, position.z);
    this.yawObject.add(this.pitchObject);

    this.object = this.yawObject;
    this.position = this.yawObject.position;

    // Initial values for movement
    this.velocity = new THREE.Vector3();
    this.rotation = new THREE.Euler();
    
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;

    // Set up pointer lock controls
    this.setupPointerLock();
    
    // Set up keyboard and mouse input
    document.addEventListener('keydown', this.onKeyDown.bind(this), false);
    document.addEventListener('keyup', this.onKeyUp.bind(this), false);
    document.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    document.addEventListener('mouseup', this.onMouseUp.bind(this), false);

    // Lock rotations - prevent tipping over
    this.rigidBody.lockRotations(true, true);
  }

  // Set the scene reference
  setScene(scene: THREE.Scene) {
    this.scene = scene;
    
    // Initialize debug visualizer
    this.debugVisualizer = new DebugVisualizer(scene);
  }

  setupPointerLock() {
    const that = this;
    this.domElement.ownerDocument.addEventListener('click', function() {
      that.domElement.requestPointerLock();
    });

    const lockChangeEvent = () => {
      const doc = this.domElement.ownerDocument;
      if (doc.pointerLockElement === this.domElement) {
        this.isLocked = true;
      } else {
        this.isLocked = false;
      }
    };

    const moveCallback = (event: MouseEvent) => {
      if (!this.isLocked) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      this.yawObject.rotation.y -= movementX * 0.002;
      this.pitchObject.rotation.x -= movementY * 0.002;
      
      // Clamp the pitch to avoid flipping
      this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
    };

    document.addEventListener('pointerlockchange', lockChangeEvent, false);
    document.addEventListener('mousemove', moveCallback, false);
  }

  onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'Space':
        // Just mark jump as requested - we'll handle it in update
        this.jumpRequested = true;
        break;
    }
  }

  onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
      case 'Space':
        this.jumpRequested = false;
        break;
    }
  }

  onMouseDown(event: MouseEvent) {
    if (!this.isLocked) return;
    
    // Only handle left mouse button (button 0)
    if (event.button === 0) {
      this.isShooting = true;
      this.shoot();
    }
  }

  onMouseUp(event: MouseEvent) {
    if (event.button === 0) {
      this.isShooting = false;
    }
  }

  shoot() {
    if (!this.scene) return;
    
    const now = Date.now();
    // Don't allow shooting faster than once every 200ms (5 shots per second)
    if (now - this.lastShootTime < 200) return;
    this.lastShootTime = now;
    
    // Get current camera position and direction
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);
    
    // Calculate bullet direction - forward vector from camera
    const bulletDirection = new THREE.Vector3(0, 0, -1);
    bulletDirection.applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    
    // Position the bullet slightly in front of the camera
    const bulletOffset = 0.5; // Distance in front of the camera
    const bulletPosition = {
      x: cameraPosition.x + bulletDirection.x * bulletOffset,
      y: cameraPosition.y + bulletDirection.y * bulletOffset,
      z: cameraPosition.z + bulletDirection.z * bulletOffset
    };
    
    // Create a visual bullet
    if (this.scene) {
      createVisualBullet(
        this.scene,
        bulletPosition,
        bulletDirection,
        this.bulletSpeed,
        this.bulletColor,
        this.bulletSize
      );
    }
    
    // Show bullet trajectory in debug mode
    if (this.debugVisualizer && this.debugVisualizer.isActive()) {
      // Create trajectory points for bullet path simulation
      const points: THREE.Vector3[] = [];
      const startPos = new THREE.Vector3(bulletPosition.x, bulletPosition.y, bulletPosition.z);
      points.push(startPos.clone());
      
      // Simulate trajectory for visualization
      const velocity = bulletDirection.clone().normalize().multiplyScalar(this.bulletSpeed);
      const gravity = new THREE.Vector3(0, -this.bulletGravity, 0);
      const simPos = startPos.clone();
      const simVel = velocity.clone();
      
      // Create 50 points along trajectory
      for (let i = 0; i < 50; i++) {
        // Update velocity with gravity
        simVel.add(gravity.clone().multiplyScalar(0.05));
        // Update position
        simPos.add(simVel.clone().multiplyScalar(0.05));
        // Add point to trajectory
        points.push(simPos.clone());
      }
      
      // Draw the trajectory
      this.debugVisualizer.drawTrajectory(points);
    }
    
    // Calculate the hit after a delay using raycasting
    // We'll simulate the bullet travel time based on distance
    this.simulateBulletWithDelay(bulletPosition, bulletDirection);
  }
  
  // Simulate a bullet with realistic physics and delayed hit detection
  simulateBulletWithDelay(
    startPosition: { x: number; y: number; z: number },
    direction: THREE.Vector3,
    maxTime: number = 5, // Maximum simulation time in seconds
    timeStep: number = 0.1 // Physics simulation step - increased from 0.05
  ) {
    const velocity = direction.clone().normalize().multiplyScalar(this.bulletSpeed);
    const gravity = new THREE.Vector3(0, -this.bulletGravity, 0);
    
    // Current state
    let position = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    let currentVelocity = velocity.clone();
    let time = 0;
    
    // Visual representation of bullet path for debugging
    const trajectoryPoints: THREE.Vector3[] = [];
    trajectoryPoints.push(position.clone());
    
    // Function to simulate one step
    const simulateStep = () => {
      // Check if we've gone too far
      if (time >= maxTime) return;
      
      // Update time
      time += timeStep;
      
      // Store previous position for ray casting
      const prevPosition = position.clone();
      
      // Update velocity with gravity
      currentVelocity.add(gravity.clone().multiplyScalar(timeStep));
      
      // Update position
      position.add(currentVelocity.clone().multiplyScalar(timeStep));
      
      // Store point for debug visualization
      trajectoryPoints.push(position.clone());
      
      // Cast a ray for this step to check for collisions
      const rayDirection = position.clone().sub(prevPosition).normalize();
      const rayLength = position.clone().sub(prevPosition).length();
      
      // Create a ray from previous position to current position
      const raycastResult = castBulletRay(
        this.physics,
        { x: prevPosition.x, y: prevPosition.y, z: prevPosition.z },
        rayDirection,
        rayLength,
        this.rigidBody
      );
      
      // If we hit something, apply the impact
      if (raycastResult.hit && raycastResult.hitRigidBody) {
        // Skip if we hit our own player rigid body
        if (raycastResult.hitRigidBody === this.rigidBody) {
          // Continue simulation for next step with delay
          setTimeout(simulateStep, 50);
          return;
        }
        
        // Apply impulse to the hit object if it's a dynamic body
        if (raycastResult.hitRigidBody.bodyType() === RAPIER.RigidBodyType.Dynamic) {
          const impulseStrength = currentVelocity.length() * 0.5; // Scale impulse by velocity
          
          // Apply impulse at the hit point
          raycastResult.hitRigidBody.applyImpulseAtPoint(
            { 
              x: currentVelocity.x * 0.5, 
              y: currentVelocity.y * 0.5, 
              z: currentVelocity.z * 0.5 
            },
            raycastResult.hitPoint!,
            true
          );
          
          // Add some random rotation for more realistic impact
          raycastResult.hitRigidBody.applyTorqueImpulse(
            {
              x: (Math.random() - 0.5) * impulseStrength * 0.25,
              y: (Math.random() - 0.5) * impulseStrength * 0.25,
              z: (Math.random() - 0.5) * impulseStrength * 0.25
            },
            true
          );
        }
        
        // We hit something, visualize the trajectory in debug mode
        if (this.debugVisualizer && this.debugVisualizer.isActive()) {
          this.debugVisualizer.drawTrajectory(trajectoryPoints, 0xff0000);
        }
        
        // Stop simulation
        return;
      }
      
      // Continue simulation for next step - add real delay between steps (50ms)
      setTimeout(simulateStep, 50);
    };
    
    // Start simulation
    simulateStep();
  }

  update(deltaTime: number) {
    if (!this.rigidBody) return;
    
    // Update debug visualizer if enabled
    if (this.debugVisualizer && this.debugVisualizer.isActive()) {
      // No need to call update, remove this code
    }

    // Calculate move direction from key presses
    const direction = new THREE.Vector3();
    const rotation = this.yawObject.rotation.y;

    if (this.moveForward) direction.z = -1;
    if (this.moveBackward) direction.z = 1;
    if (this.moveLeft) direction.x = -1;
    if (this.moveRight) direction.x = 1;
    
    // Normalize direction
    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    // Rotate direction based on camera rotation
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);

    // SIMPLIFIED MOVEMENT: Just apply velocity directly
    const linvel = this.rigidBody.linvel();
    const moveSpeed = 5.0; // Reasonable speed
    
    let newVelX = linvel.x;
    let newVelZ = linvel.z;
    
    // Only override velocity when moving
    if (direction.x !== 0) {
      newVelX = direction.x * moveSpeed;
    } else {
      // Apply damping when not pressing any movement keys
      newVelX *= 0.9;
    }
    
    if (direction.z !== 0) {
      newVelZ = direction.z * moveSpeed;
    } else {
      // Apply damping when not pressing any movement keys
      newVelZ *= 0.9;
    }
    
    // Check if we're on the ground using a very simple height test
    const position = this.rigidBody.translation();
    // Just check if Y is close to zero - simple but effective
    const isGrounded = position.y < 1.5;
    
    this.canJump = isGrounded;
    
    // Handle jumping - simplified approach
    let newVelY = linvel.y;
    if (this.jumpRequested && isGrounded) {
      newVelY = 8; // Jump velocity
      this.jumpRequested = false;
      this.lastJumpTime = Date.now();
    }
    
    // Set the rigid body velocity
    this.rigidBody.setLinvel({ x: newVelX, y: newVelY, z: newVelZ }, true);
    
    // Make sure we're not rotating around X or Z axes
    const angvel = this.rigidBody.angvel();
    this.rigidBody.setAngvel({ x: 0, y: angvel.y, z: 0 }, true);
    
    // Update Three.js object position from physics
    const translation = this.rigidBody.translation();
    this.position.set(translation.x, translation.y, translation.z);

    // Handle continuous shooting
    if (this.isShooting) {
      this.shoot();
    }
  }
} 