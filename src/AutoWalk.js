import * as THREE from 'three';

export class AutoWalk {
  constructor() {
    // Proportions
    this.baseHeight = 1.8;
    this.baseWidth = 0.3;
    this.hipHeight = this.baseHeight * 0.55;

    // Thresholds
    this.motionActivationThreshold = 0.01;
    this.motionStopThreshold = 0.01;

    // State
    this.prevPosOnGround = new THREE.Vector3(0, 0, 0);
    this.prevForwardVec = new THREE.Vector3(0, 0, 1);
    this.motionActivator = 0.0;
    this.forwardMotionActivator = 0.0;
    this.time = 0.0;
    this.centerGroundHeight = 0.0;

    // Walk settings
    this.stepSpeed = 0.2;
    this.footLift = 0.8;
    this.hipBounce = 0.0;
    this.upDown = 0.9;
    this.upDownFreq = 0.3;

    // Derived parameters
    this.walkStepFreq = 0;
    this.footLiftHeight = 0;
    this.stepForward = 0;
    this.hipUpDownFreqMult = 0;
    this.hipLift = 0;
    this.motionDecay = 0;
    this.footLiftSpeed = 0;

    // Dummy rig targets representing where limbs should be positioned
    this.rootTrn = {
      position: new THREE.Vector3(),
      forward: new THREE.Vector3(0, 0, 1),
      up: new THREE.Vector3(0, 1, 0),
      orientation: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    };

    this.legLeft = this._createLeg();
    this.legRight = this._createLeg();
    this.hip = { position: new THREE.Vector3() };
  }

  _createLeg() {
    return {
      lastFootPlantedPos: null,
      heelLen: 0.05,
      legLen: 1.5,
      shinLen: 1.5,
      legAutoPosition: new THREE.Vector3(),
      legAutoOrientation: new THREE.Quaternion(),
      kneeAutoPosition: new THREE.Vector3(),
      kneeAutoOrientation: new THREE.Quaternion(),
      footAutoPosition: new THREE.Vector3(),
      kneeJointPosition: new THREE.Vector3(),
      footAutoOrientation: new THREE.Quaternion()
    };
  }

  update(deltaTime, rootPosition, rootForward, rootUp, rootOrientation, rootScale) {
    this.time += deltaTime;

    // Update root transform references
    this.rootTrn.position.copy(rootPosition);
    this.rootTrn.forward.copy(rootForward);
    this.rootTrn.up.copy(rootUp);
    this.rootTrn.orientation.copy(rootOrientation);
    this.rootTrn.scale.copy(rootScale);

    // Calculate derived parameters
    this.walkStepFreq = THREE.MathUtils.lerp(5.0, 50.0, this.stepSpeed);
    this.footLiftHeight = THREE.MathUtils.lerp(this.hipHeight * 0.01, this.hipHeight, this.footLift);
    this.stepForward = THREE.MathUtils.lerp(0.0, this.hipHeight, this.footLift);
    this.hipUpDownFreqMult = THREE.MathUtils.lerp(2.0, 3.0, this.hipBounce);
    this.hipLift = THREE.MathUtils.lerp(0.0, this.hipHeight * 0.2, this.upDown);
    this.motionDecay = THREE.MathUtils.lerp(0.8, 0.3, this.stepSpeed);
    this.footLiftSpeed = THREE.MathUtils.lerp(0.1, 0.8, this.stepSpeed);

    this.solveRoot();

    let legMotionOffset = 0.0;
    this.solveFootPlacement(this.legLeft, legMotionOffset);

    legMotionOffset = Math.PI;
    this.solveFootPlacement(this.legRight, legMotionOffset);

    this.solveHipMotion();

    this.solveIK(this.legLeft);
    this.solveIK(this.legRight);
  }

  solveRoot() {
    this.centerGroundHeight = this.rootTrn.position.y;

    const targetPosOnGround = this.rootTrn.position.clone();
    targetPosOnGround.y = this.centerGroundHeight;

    const motionDelta = this.prevPosOnGround.clone().sub(targetPosOnGround);
    motionDelta.y = 0.0;

    const motionDeltaLen = motionDelta.length();

    let goingForward = this.rootTrn.forward.dot(motionDelta);
    goingForward = THREE.MathUtils.clamp(goingForward, 0.0, 1.0);

    if (goingForward > this.motionActivationThreshold) {
      this.forwardMotionActivator = THREE.MathUtils.lerp(this.forwardMotionActivator, 1.0, 0.5);
    }
    this.forwardMotionActivator *= this.motionDecay;

    this.prevPosOnGround.copy(targetPosOnGround);

    const rootForwardVec = this.prevForwardVec.clone();
    const targetForwardVec = this.rootTrn.forward;

    this.prevForwardVec.copy(targetForwardVec);

    const angularMotion = Math.abs((1.0 - rootForwardVec.dot(targetForwardVec)) * 0.5);
    const overallMotionDeltaLen = motionDeltaLen + angularMotion;

    if (overallMotionDeltaLen > this.motionActivationThreshold) {
      this.motionActivator = THREE.MathUtils.lerp(this.motionActivator, 1.0, 0.5);
    }

    if (motionDeltaLen > this.motionActivationThreshold) {
      this.motionActivator = THREE.MathUtils.lerp(this.motionActivator, 1.0, 0.5);
    }

    this.motionActivator *= this.motionDecay;
  }

  solveFootPlacement(leg, timeOffset) {
    if (this.motionActivator < this.motionStopThreshold) {
      return;
    }

    const distToGround = leg.heelLen * this.rootTrn.scale.z;
    const footPos = leg.footAutoPosition.clone();

    const footLift = Math.sin((this.time * this.walkStepFreq) + timeOffset);
    const footLiftMotion = footLift * this.footLiftHeight * this.motionActivator;
    const footLiftVec = this.rootTrn.up.clone().multiplyScalar(footLiftMotion);

    const footForwardMotion = Math.cos((this.time * this.walkStepFreq) + timeOffset) * this.stepForward * this.motionActivator;
    const footForwardVec = this.rootTrn.forward.clone().multiplyScalar(footForwardMotion * this.forwardMotionActivator);
    
    // Original: footPlacerPos = CharacterData.rootTrn * (getPosition(leg.legAuto) + footForwardVec + footLiftVec)
    // Simplified since rootTrn translation already contains global offset, we assume legAutoPosition is local.
    const localLegPos = leg.legAutoPosition.clone().add(footForwardVec).add(footLiftVec);
    localLegPos.applyQuaternion(this.rootTrn.orientation);
    let footPlacerPos = this.rootTrn.position.clone().add(localLegPos);

    if (footPlacerPos.y < (this.centerGroundHeight + distToGround)) {
      if (!leg.lastFootPlantedPos) {
        leg.lastFootPlantedPos = footPlacerPos.clone();
      }
      footPlacerPos.copy(leg.lastFootPlantedPos);
    } else {
      leg.lastFootPlantedPos = null;
    }

    const newFootPos = footPos.lerp(footPlacerPos, this.footLiftSpeed);

    if (newFootPos.y < (this.centerGroundHeight + distToGround)) {
      newFootPos.y = this.centerGroundHeight + distToGround;
    }

    leg.footAutoPosition.copy(newFootPos);

    // Animate foot roll
    const shinVec = leg.kneeJointPosition.clone().sub(newFootPos).normalize();
    const dotVal = THREE.MathUtils.clamp(this.rootTrn.forward.dot(shinVec), -1.0, 1.0);
    const ankleAngle = Math.acos(dotVal) - Math.PI;

    const footRollPhaseMult = -2.3;
    const phaseOffset = Math.PI * footRollPhaseMult;
    const footRoll = Math.sin((this.time * this.walkStepFreq) + timeOffset + phaseOffset);

    const footLiftMult = ((footLift + 1.0) * 0.5) * this.footLift * this.motionActivator;
    const rollMinMult = -0.9;
    const footRollClamp = THREE.MathUtils.clamp(footRoll, 0.0, 1.0);
    const footRollVal = THREE.MathUtils.lerp(ankleAngle - (Math.PI * rollMinMult), ankleAngle, footRollClamp) * footLiftMult;

    const newFootRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), footRollVal);
    newFootRot.premultiply(this.rootTrn.orientation);
    leg.footAutoOrientation.copy(newFootRot);
  }

  solveHipMotion() {
    if (this.motionActivator < this.motionStopThreshold) {
      const hipPos = this.hip.position.clone();
      if (hipPos.y !== this.hipHeight) {
        const hipRestPos = new THREE.Vector3(0, this.hipHeight, 0);
        this.hip.position.lerpVectors(hipPos, hipRestPos, 0.5);
      }
      return;
    }

    const timeOffset = Math.PI;
    const hipLift = Math.sin(this.time * (this.walkStepFreq * this.hipUpDownFreqMult * this.upDownFreq) + timeOffset) * this.footLift;
    const hipLiftMotion = hipLift * this.hipLift * this.motionActivator;

    const newHipPos = new THREE.Vector3(0, this.hipHeight + hipLiftMotion, 0);
    this.hip.position.copy(newHipPos);
  }

  solveIK(leg) {
    // Calculate global root (hip + legAutoPosition)
    const rootPos = this.rootTrn.position.clone();
    const hipGlobal = this.hip.position.clone().applyQuaternion(this.rootTrn.orientation);
    rootPos.add(hipGlobal);
    
    const localLegPos = leg.legAutoPosition.clone().applyQuaternion(this.rootTrn.orientation);
    rootPos.add(localLegPos);

    const effectorPos = leg.footAutoPosition;
    
    // Knee pointing forward
    const planeVec = this.rootTrn.forward.clone().normalize();

    let c = rootPos.distanceTo(effectorPos);
    const a = leg.legLen;
    const b = leg.shinLen;

    if (c > a + b) c = a + b;

    let alpha = Math.acos(THREE.MathUtils.clamp((c * c + a * a - b * b) / (2.0 * c * a), -1.0, 1.0));
    if (isNaN(alpha)) alpha = 0.0;

    // Root LookAt effector
    const m = new THREE.Matrix4();
    m.lookAt(rootPos, effectorPos, planeVec);
    const aimRot = new THREE.Quaternion().setFromRotationMatrix(m);

    // Apply alpha bending to thigh (rotating around local X axis)
    // Positive alpha bends the thigh forward (towards the planeVec/Y-axis)
    const rootIKRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), alpha);
    aimRot.multiply(rootIKRot);

    // Convert global aimRot to local space relative to the hip
    const parentGlobalRot = this.rootTrn.orientation.clone(); // The hip inherits root orientation
    const parentInv = parentGlobalRot.invert();
    leg.legAutoOrientation.copy(aimRot.clone().premultiply(parentInv));

    // Calculate global knee hinge position
    const boneDir = new THREE.Vector3(0, 0, -1).applyQuaternion(aimRot).normalize();
    const hingePos = rootPos.clone().add(boneDir.multiplyScalar(a));
    leg.kneeAutoPosition.copy(hingePos);
    leg.kneeJointPosition.copy(hingePos);

    // Calculate Beta (shin angle)
    let beta = Math.acos(THREE.MathUtils.clamp((a * a + b * b - c * c) / (2.0 * a * b), -1.0, 1.0));
    if (isNaN(beta)) beta = 0.0;

    // local rotation around X axis by Math.PI - beta (negated to bend knee back)
    leg.kneeAutoOrientation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(Math.PI - beta));
  }
}
