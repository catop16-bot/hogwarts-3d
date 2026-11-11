export type QualityName = 'low' | 'medium' | 'high';
export interface QualityLevel {
  name: QualityName;
  label: string;
  dpr: number; // 像素比上限
  shadow: number;
  ao: boolean;
  aoHalf: boolean;
  godRays: boolean;
  reflection: boolean;
  reflectionScale: number;
  smaa: boolean;
  trees: number; // 樹木密度倍率
}
export const QUALITY: Record<QualityName, QualityLevel> = {
  low: { name: 'low', label: '低', dpr: 1, shadow: 2048, ao: false, aoHalf: true, godRays: false, reflection: false, reflectionScale: 0.35, smaa: true, trees: 0.6 },
  medium: { name: 'medium', label: '中', dpr: 1.25, shadow: 4096, ao: true, aoHalf: true, godRays: true, reflection: true, reflectionScale: 0.5, smaa: true, trees: 1 },
  high: { name: 'high', label: '高', dpr: 2, shadow: 4096, ao: true, aoHalf: false, godRays: true, reflection: true, reflectionScale: 0.75, smaa: true, trees: 1 },
};
