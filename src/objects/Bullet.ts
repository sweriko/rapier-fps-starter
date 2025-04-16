import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

// Interface for raycast result
export interface RaycastResult {
  hit: boolean;
  hitPoint?: { x: number; y: number; z: number };
  hitDistance?: number;
  hitRigidBody?: RAPIER.RigidBody;
}

/**
 * Casts a ray in the physics world to simulate a bullet
 * @param physics Physics world and rigid bodies map
 * @param origin Starting point of the ray
 * @param direction Direction vector for the ray (will be normalized)
 * @param distance Maximum distance for the ray
 * @param ignoreBody Optional rigid body to ignore (e.g. player's own body)
 * @returns Result of the raycast with hit information
 */
export function castBulletRay(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> },
  origin: { x: number; y: number; z: number },
  direction: THREE.Vector3,
  distance: number,
  ignoreBody?: RAPIER.RigidBody
): RaycastResult {
  // Normalize direction vector
  const normalizedDir = direction.clone().normalize();
  
  // Convert to Rapier vector
  const rayDir = { x: normalizedDir.x, y: normalizedDir.y, z: normalizedDir.z };
  
  // Cast the ray
  const ray = new RAPIER.Ray(origin, rayDir);
  const hit = physics.world.castRayAndGetNormal(
    ray, 
    distance, 
    true // Solid hit only
  );
  
  // Default result (no hit)
  const result: RaycastResult = { hit: false };
  
  // Check if we hit something
  if (hit) {
    // If we should ignore this hit because it's the player's body
    const hitRigidBody = hit.collider.parent();
    if (ignoreBody && hitRigidBody && hitRigidBody === ignoreBody) {
      return result;
    }
    
    // Get hit information
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    
    result.hit = true;
    result.hitPoint = hitPoint;
    result.hitDistance = hit.timeOfImpact;
    result.hitRigidBody = hitRigidBody || undefined;
  }
  
  return result;
}

// Trail function removed 