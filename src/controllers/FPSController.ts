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

// Character movement states
enum MovementState {
  GROUNDED,
  JUMPING,
  FALLING,
  SLIDING
}

// FPS Controller class
export class FPSController {
  object: THREE.Object3D;
  camera: THREE.Camera;
  physics: PhysicsWorld;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  characterController: RAPIER.KinematicCharacterController;
  velocity: THREE.Vector3;
  horizontalVelocity: THREE.Vector2;
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
  
  // Movement parameters
  moveSpeed: number = 5.0;
  jumpVelocity: number = 10.0;
  jumpCooldown: number = 300; // ms
  jumpBufferTime: number = 200; // ms to buffer jump input
  lastJumpRequestTime: number = 0;
  coyoteTime: number = 150; // ms of "coyote time" (can jump briefly after leaving platform)
  lastGroundedTime: number = 0;
  airControl: number = 0.7;
  pushPower: number = 0.5;
  upVector = { x: 0, y: 1, z: 0 };
  verticalVelocity: number = 0;
  gravityForce: number = 20.0;
  movementState: MovementState = MovementState.GROUNDED;
  groundAcceleration: number = 10.0;
  groundDeceleration: number = 15.0;
  airAcceleration: number = 5.0;
  airDeceleration: number = 2.0;
  slidingFriction: number = 0.2;
  maxSlideAngle: number = 0.8; // ~45 degrees
  bodyQueryInterval: number = 5; // Only perform body queries every N frames
  bodyQueryCounter: number = 0;
  
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
    
    // Create a kinematic rigid body for the player (changed from dynamic)
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z)
      .setCcdEnabled(true);

    this.rigidBody = physics.world.createRigidBody(bodyDesc);
    
    // Create a collider for the player (capsule shape)
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.9, 0.3)
      .setFriction(0.2);

    this.collider = physics.world.createCollider(colliderDesc, this.rigidBody);

    // Create Rapier's KinematicCharacterController
    // The offset is the gap that the controller will leave between the character and obstacles
    const offset = 0.01;
    this.characterController = physics.world.createCharacterController(offset);
    
    // Configure character controller
    this.characterController.enableAutostep(0.5, 0.3, true);
    this.characterController.enableSnapToGround(0.3);
    this.characterController.setMaxSlopeClimbAngle(this.maxSlideAngle);
    this.characterController.setMinSlopeSlideAngle(0.6);
    this.characterController.setApplyImpulsesToDynamicBodies(true);
    this.characterController.setUp(this.upVector);

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
    this.horizontalVelocity = new THREE.Vector2();
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
        // Buffer jump input for better responsiveness
        this.jumpRequested = true;
        this.lastJumpRequestTime = Date.now();
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

  // Update the movement state based on current conditions
  updateMovementState() {
    const isGrounded = this.characterController.computedGrounded();
    const now = Date.now();
    
    // Update grounded time tracking for coyote time
    if (isGrounded) {
      this.lastGroundedTime = now;
    }
    
    // Get surface normal from character controller
    const slope = this.getSlopeAngle();
    const isTooSteep = slope > this.maxSlideAngle;
    
    // Update movement state
    if (isGrounded) {
      // On ground
      if (isTooSteep) {
        this.movementState = MovementState.SLIDING;
      } else {
        this.movementState = MovementState.GROUNDED;
      }
    } else {
      // In air
      if (this.verticalVelocity > 0) {
        this.movementState = MovementState.JUMPING;
      } else {
        this.movementState = MovementState.FALLING;
      }
    }
    
    // Update jump ability for coyote time
    this.canJump = isGrounded || (now - this.lastGroundedTime < this.coyoteTime);
  }
  
  // Get the slope angle (approximation)
  getSlopeAngle(): number {
    // Simple approximation using the up vector and ground normal
    // For a more accurate implementation, we would need to query collision normals
    return 0; // Default to flat ground - can be improved with proper normal detection
  }
  
  // Calculate acceleration based on current state
  getAcceleration(): number {
    switch (this.movementState) {
      case MovementState.GROUNDED:
        return this.groundAcceleration;
      case MovementState.JUMPING:
      case MovementState.FALLING:
        return this.airAcceleration;
      case MovementState.SLIDING:
        return this.groundAcceleration * this.slidingFriction;
      default:
        return this.groundAcceleration;
    }
  }
  
  // Calculate deceleration based on current state
  getDeceleration(): number {
    switch (this.movementState) {
      case MovementState.GROUNDED:
        return this.groundDeceleration;
      case MovementState.JUMPING:
      case MovementState.FALLING:
        return this.airDeceleration;
      case MovementState.SLIDING:
        return this.groundDeceleration * this.slidingFriction;
      default:
        return this.groundDeceleration;
    }
  }

  update(deltaTime: number) {
    if (!this.rigidBody || !this.characterController) return;

    // Update movement state
    this.updateMovementState();

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

    // Process input buffering for jump
    const now = Date.now();
    const hasBufferedJump = (now - this.lastJumpRequestTime < this.jumpBufferTime);
    
    // Jump if we have a buffered jump request and can jump (with coyote time)
    if ((this.jumpRequested || hasBufferedJump) && this.canJump && now - this.lastJumpTime > this.jumpCooldown) {
      // Set a strong upward velocity
      this.verticalVelocity = this.jumpVelocity;
      this.jumpRequested = false;
      this.lastJumpTime = now;
      this.movementState = MovementState.JUMPING;
      this.canJump = false;
    }
    
    // Apply gravity based on movement state
    if (this.movementState === MovementState.JUMPING || this.movementState === MovementState.FALLING) {
      this.verticalVelocity -= this.gravityForce * deltaTime;
    } else if (this.movementState === MovementState.SLIDING) {
      // Apply sliding force down the slope (simplified)
      this.verticalVelocity = -5.0 * this.slidingFriction;
    } else {
      // Gradually reduce vertical velocity when grounded
      this.verticalVelocity *= 0.8;
      if (Math.abs(this.verticalVelocity) < 0.1) {
        this.verticalVelocity = 0;
      }
    }
    
    // Clamp maximum falling speed
    if (this.verticalVelocity < -20) {
      this.verticalVelocity = -20;
    }
    
    // SIMPLIFIED MOVEMENT SYSTEM - direct approach to ensure it works
    // Get target velocity based on input direction and state
    const currentMoveFactor = (this.movementState === MovementState.JUMPING || 
                              this.movementState === MovementState.FALLING) ? 
                              this.airControl : 1.0;
    
    // Apply acceleration but in a simpler, more direct way
    this.horizontalVelocity.x = direction.x * this.moveSpeed * currentMoveFactor;
    this.horizontalVelocity.y = direction.z * this.moveSpeed * currentMoveFactor;
    
    // Calculate final movement vector
    let movementVector = {
      x: this.horizontalVelocity.x * deltaTime,
      y: this.verticalVelocity * deltaTime,
      z: this.horizontalVelocity.y * deltaTime
    };
    
    // Use the character controller to compute the corrected movement
    this.characterController.computeColliderMovement(
      this.collider,
      movementVector
    );
    
    // Get the corrected movement from the character controller
    const correctedMovement = this.characterController.computedMovement();
    
    // Check if we hit something above (head collision)
    if (this.verticalVelocity > 0 && correctedMovement.y < movementVector.y * 0.9) {
      // Hit ceiling or obstacle above, zero out upward velocity
      this.verticalVelocity = 0;
    }
    
    // Apply the corrected movement to the kinematic rigid body
    const currentPos = this.rigidBody.translation();
    const newPos = {
      x: currentPos.x + correctedMovement.x,
      y: currentPos.y + correctedMovement.y,
      z: currentPos.z + correctedMovement.z
    };
    
    // Update rigid body position
    this.rigidBody.setNextKinematicTranslation(newPos);
    
    // Update Three.js object position
    this.position.set(newPos.x, newPos.y, newPos.z);
    
    // Handle interactions with dynamic rigid bodies (optimized to run less frequently)
    this.bodyQueryCounter++;
    if (this.bodyQueryCounter >= this.bodyQueryInterval) {
      this.handleRigidBodyInteractions(deltaTime);
      this.bodyQueryCounter = 0;
    }

    // Handle continuous shooting
    if (this.isShooting) {
      this.shoot();
    }
  }
  
  // Handle pushing of dynamic rigid bodies
  handleRigidBodyInteractions(deltaTime: number) {
    if (!this.rigidBody) return;
    
    // Create a small query region around the player to find nearby objects
    const playerPos = this.rigidBody.translation();
    const interactionRadius = 1.5; // Radius to detect objects for pushing
    
    // Query objects in a box around the player
    const queryShape = new RAPIER.Cuboid(interactionRadius, interactionRadius, interactionRadius);
    const queryPosition = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    const queryRotation = { x: 0, y: 0, z: 0, w: 1 };
    
    // Query all nearby colliders
    this.physics.world.intersectionsWithShape(
      queryPosition,
      queryRotation,
      queryShape,
      (collider) => {
        // Skip checking against the player's own collider
        if (collider === this.collider) return true;
        
        // Only interact with dynamic bodies
        const body = collider.parent();
        if (!body || body.bodyType() !== RAPIER.RigidBodyType.Dynamic) return true;
        
        // Calculate push direction away from player
        const bodyPos = body.translation();
        const pushDir = new THREE.Vector3(
          bodyPos.x - playerPos.x,
          0, // Don't push up/down
          bodyPos.z - playerPos.z
        );
        
        // Calculate distance and only push if close enough
        const pushDistance = pushDir.length();
        
        if (pushDistance > 0 && pushDistance < interactionRadius) {
          pushDir.normalize();
          
          // Calculate push strength based on player velocity and distance
          const playerSpeed = new THREE.Vector2(this.horizontalVelocity.x, this.horizontalVelocity.y).length();
          const strength = this.pushPower * playerSpeed * (1 - pushDistance / interactionRadius);
          
          // Only push if player is moving with reasonable speed
          if (playerSpeed > 2.0) {
            // Apply the impulse
            body.applyImpulse(
              { 
                x: pushDir.x * strength, 
                y: 0, 
                z: pushDir.z * strength 
              },
              true
            );
          }
        }
        
        // Continue the query
        return true;
      }
    );
  }
} 