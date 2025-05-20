import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface ProjectileOptions {
  speed?: number;
  size?: number;
  color?: number;
  lifespan?: number;
  mass?: number;
  restitution?: number;
}

export class Projectile {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  creationTime: number;
  lifespan: number;
  trajectoryPoints: THREE.Vector3[] = [];
  
  constructor(
    physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> },
    position: THREE.Vector3,
    direction: THREE.Vector3,
    options: ProjectileOptions = {}
  ) {
    // Default options
    const size = options.size || 0.1;
    const color = options.color || 0xffff00;
    const speed = options.speed || 30;
    this.lifespan = options.lifespan || 5000; // 5 seconds by default
    const mass = options.mass || 0.2;
    const restitution = options.restitution || 0.3;
    
    // Create bullet geometry and material
    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.7,
      emissive: color,
      emissiveIntensity: 0.5
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.position.copy(position);
    
    // Create rigid body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setCcdEnabled(true) // Enable continuous collision detection
      .setLinvel(direction.x * speed, direction.y * speed, direction.z * speed)
      .setAdditionalMass(mass);
    
    this.rigidBody = physics.world.createRigidBody(rigidBodyDesc);

    // Create collider
    const colliderDesc = RAPIER.ColliderDesc.ball(size)
      .setRestitution(restitution)
      .setFriction(0.1)
      .setDensity(2.0);

    this.collider = physics.world.createCollider(colliderDesc, this.rigidBody);
    
    // Add to physics tracking
    physics.rigidBodies.set(this.mesh, this.rigidBody);
    
    // Record creation time
    this.creationTime = Date.now();
    
    // Record initial position in trajectory
    this.trajectoryPoints.push(position.clone());
  }
  
  // Update bullet position from physics
  update() {
    if (this.rigidBody) {
      const position = this.rigidBody.translation();
      this.mesh.position.set(position.x, position.y, position.z);
      
      // Add current position to trajectory
      this.trajectoryPoints.push(new THREE.Vector3(position.x, position.y, position.z));
    }
  }
  
  // Get trajectory points
  getTrajectoryPoints(): THREE.Vector3[] {
    return this.trajectoryPoints;
  }
  
  // Check if the bullet should be removed
  shouldRemove(): boolean {
    return Date.now() - this.creationTime > this.lifespan || 
           this.mesh.position.y < -20; // Remove if fallen off the world
  }
  
  // Remove the bullet from the scene and physics world
  remove(
    scene: THREE.Scene,
    physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> }
  ) {
    scene.remove(this.mesh);
    physics.world.removeRigidBody(this.rigidBody);
    physics.rigidBodies.delete(this.mesh);
  }
}

// Create a projectile from a given position and direction
export function createProjectile(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> },
  position: THREE.Vector3,
  direction: THREE.Vector3,
  options: ProjectileOptions = {}
): Projectile {
  return new Projectile(physics, position, direction, options);
} 