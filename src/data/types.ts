export type Mode = 'normal' | 'internal' | 'exhibit' | 'focus'
export type Quality = 'auto' | 'low' | 'medium' | 'high'
export type View = 'perspective' | 'left' | 'right' | 'top'
export type PartId = 'stock' | 'receiver' | 'cover' | 'handguard' | 'gas' | 'barrel' | 'magazine' | 'grip' | 'sights' | 'core' | 'return' | 'feed'
export interface PartInfo {
  id: PartId
  number: string
  name: string
  subtitle: string
  material: string
  description: string
  history: string
  note: string
  internal?: boolean
}
export interface SceneState { mode: Mode; selected: PartId | null; autoRotate: boolean; quality: Quality; reducedMotion: boolean }
