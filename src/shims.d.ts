declare module 'n8ao' {
  export class N8AOPostPass {
    constructor(scene: any, camera: any, width?: number, height?: number);
    configuration: any;
    enabled: boolean;
    setQualityMode(mode: string): void;
  }
}
