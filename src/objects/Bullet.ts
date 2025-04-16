import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

// Create a single physics-enabled bullet
export function createBullet(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Mesh, RAPIER.RigidBody> },
  position: { x: number; y: number; z: number },
  direction: THREE.Vector3,
  speed: number = 40
) {
  // Create bullet geometry and material
  const size = 0.2; // Larger bullet size
  const geometry = new THREE.SphereGeometry(size, 8, 8);
  const material = new THREE.MeshStandardMaterial({
    color: 0xFFFF00, // Bright yellow
    roughness: 0.3,
    metalness: 0.8,
    emissive: 0xFF8C00, // Orange glow
    emissiveIntensity: 0.8
  });

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.position.set(position.x, position.y, position.z);

  // Add a trail effect to the bullet
  const trail = createBulletTrail();
  mesh.add(trail);
  
  // Create a point light that moves with the bullet
  const light = new THREE.PointLight(0xFFFF00, 1, 3);
  light.position.set(0, 0, 0);
  mesh.add(light);

  // Create rigid body with special settings to prevent sticking
  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setCcdEnabled(true) // Enable continuous collision detection for fast-moving objects
    .setGravityScale(0.0) // Turn off gravity completely for bullets
    .setLinearDamping(0.0) // No damping to maintain velocity
    .setAngularDamping(0.0) // No angular damping
    .setCanSleep(false); // Prevent the physics engine from putting the bullet to sleep
  
  const rigidBody = physics.world.createRigidBody(rigidBodyDesc);

  // Create collider with special settings
  const colliderDesc = RAPIER.ColliderDesc.ball(size)
    .setRestitution(0.2) // Low bounciness
    .setFriction(0.0)    // Zero friction
    .setDensity(0.5)     // Lightweight
    .setSensor(true);    // Make it a sensor (passes through but still detects collisions)

  physics.world.createCollider(colliderDesc, rigidBody);
  
  // Add to physics tracking
  physics.rigidBodies.set(mesh, rigidBody);

  // Apply initial velocity in the direction of the camera
  const normalizedDir = direction.clone().normalize();
  rigidBody.setLinvel(
    {
      x: normalizedDir.x * speed,
      y: normalizedDir.y * speed,
      z: normalizedDir.z * speed
    },
    true
  );
  
  // Lock rotations to prevent weird spinning behaviors
  rigidBody.lockRotations(true, true);

  // Set lifetime for bullet (will be removed after this time)
  const lifetime = 3000; // 3 seconds
  const creationTime = Date.now();

  return { mesh, rigidBody, creationTime, lifetime };
}

// Create a trail effect for the bullet
function createBulletTrail() {
  const trailLength = 10;
  const positions = new Float32Array(trailLength * 3);
  const colors = new Float32Array(trailLength * 3);
  
  // Initialize positions (they will be updated in the animation loop)
  for (let i = 0; i < trailLength; i++) {
    const i3 = i * 3;
    // Trail starts at the bullet and extends backward
    positions[i3] = 0;
    positions[i3 + 1] = 0;
    positions[i3 + 2] = i * 0.1; // Trail extends backward (positive z in bullet's local space)
    
    // Gradient color from yellow to red
    const ratio = i / trailLength;
    colors[i3] = 1;      // Red channel
    colors[i3 + 1] = 1 - ratio;  // Green channel (fade out)
    colors[i3 + 2] = 0;  // Blue channel
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const material = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });
  
  return new THREE.Points(geometry, material);
} 