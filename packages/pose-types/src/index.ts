/** Shared pose types. Mirrors MediaPipe Pose Landmarker's 33-landmark (BlazePose) layout. */

export interface Landmark {
  /** Normalized image x in [0, 1] (may fall slightly outside when off-frame). */
  x: number
  /** Normalized image y in [0, 1], increasing downward. */
  y: number
  /** Relative depth; smaller is closer to the camera. */
  z: number
  /** Model's estimate that the landmark is visible (not occluded), in [0, 1]. */
  visibility: number
}

export interface PoseFrame {
  /** Monotonic timestamp in milliseconds. */
  t: number
  /** Source image size in pixels, used to compute angles without aspect distortion. */
  width: number
  height: number
  /** 33 landmarks, or null when no person was detected in this frame. */
  landmarks: Landmark[] | null
}

export type Side = 'left' | 'right'

export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32
} as const

export const LANDMARK_COUNT = 33

export const LANDMARK_NAMES: readonly string[] = [
  'NOSE', 'L_EYE_IN', 'L_EYE', 'L_EYE_OUT', 'R_EYE_IN', 'R_EYE', 'R_EYE_OUT', 'L_EAR', 'R_EAR',
  'MOUTH_L', 'MOUTH_R', 'L_SHOULDER', 'R_SHOULDER', 'L_ELBOW', 'R_ELBOW', 'L_WRIST', 'R_WRIST',
  'L_PINKY', 'R_PINKY', 'L_INDEX', 'R_INDEX', 'L_THUMB', 'R_THUMB', 'L_HIP', 'R_HIP',
  'L_KNEE', 'R_KNEE', 'L_ANKLE', 'R_ANKLE', 'L_HEEL', 'R_HEEL', 'L_FOOT', 'R_FOOT'
]

/** Body joints on one side of the body. */
export interface SideJoints {
  shoulder: number
  elbow: number
  wrist: number
  hip: number
  knee: number
  ankle: number
}

export const SIDE_JOINTS: Record<Side, SideJoints> = {
  left: { shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST, hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE },
  right: { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE }
}

/** Skeleton edges for drawing. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
  [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22],
  [0, 2], [0, 5], [2, 7], [5, 8]
]
