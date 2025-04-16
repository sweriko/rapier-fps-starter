import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

// Cast a ray from the given position in the given direction and return hit information
export function castBulletRay(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> },
  position: { x: number; y: number; z: number },
  direction: THREE.Vector3,
  maxDistance: number = 100
) {
  // Create a ray for raycasting
  const rayOrigin = { x: position.x, y: position.y, z: position.z };
  const normalizedDir = direction.clone().normalize();
  const rayDir = { x: normalizedDir.x, y: normalizedDir.y, z: normalizedDir.z };
  const ray = new RAPIER.Ray(rayOrigin, rayDir);
  
  // Perform the raycast - use castRayAndGetNormal to get normal information too
  const hit = physics.world.castRayAndGetNormal(ray, maxDistance, true);
  
  if (hit) {
    // Get the hit point by using the ray's pointAt method
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    
    // Return hit information
    return {
      hit: true,
      distance: hit.timeOfImpact,
      hitPoint,
      hitCollider: hit.collider,
      hitRigidBody: hit.collider.parent(),
      normal: hit.normal,
      direction: normalizedDir
    };
  }
  
  // No hit
  return {
    hit: false,
    distance: maxDistance,
    hitPoint: null,
    hitCollider: null,
    hitRigidBody: null,
    normal: null,
    direction: normalizedDir
  };
}

// Trail function removed 