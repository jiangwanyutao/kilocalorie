import { Inject, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 识别得到的一道菜 · 前端可编辑
 */
export interface VisionFoodItem {
  foodName: string;
  portionG: number;
  kcal: number;
  carbG: number;
  protG: number;
  fatG: number;
  /** 0-1 · 越高越确信 */
  confidence: number;
}

export interface VisionResult {
  provider: string;
  items: VisionFoodItem[];
  /** 万分之元 · Mock 恒为 0 */
  costCents?: number;
}

export const VISION_PROVIDER = Symbol('VISION_PROVIDER');

export interface VisionProvider {
  readonly name: string;
  recognize(imageBase64: string, mimeType: string): Promise<VisionResult>;
}

/**
 * Mock · 无 Key 时 fallback · 演示 UX 用
 * 按当前小时选早/午/晚典型三菜 · 附小幅随机让每次略有不同
 */
@Injectable()
export class MockVisionProvider implements VisionProvider {
  readonly name = 'mock';

  private readonly logger = new Logger('MockVision');

  private readonly SEEDS = {
    B: [
      { foodName: '白粥',    portionG: 250, kcal: 115, carbG: 24, protG: 2.8, fatG: 0.5, confidence: 0.88 },
      { foodName: '茶叶蛋',  portionG: 55,  kcal: 82,  carbG: 0.6, protG: 6.8, fatG: 5.8, confidence: 0.91 },
      { foodName: '馒头',    portionG: 60,  kcal: 134, carbG: 28, protG: 4.2, fatG: 0.7, confidence: 0.86 },
    ],
    L: [
      { foodName: '米饭',            portionG: 200, kcal: 232, carbG: 50, protG: 5.2, fatG: 0.6, confidence: 0.92 },
      { foodName: '西红柿炒鸡蛋',    portionG: 180, kcal: 216, carbG: 8,  protG: 12,  fatG: 14,  confidence: 0.88 },
      { foodName: '清炒青菜',        portionG: 100, kcal: 22,  carbG: 3.6, protG: 2.3, fatG: 0.2, confidence: 0.83 },
    ],
    D: [
      { foodName: '米饭',       portionG: 180, kcal: 209, carbG: 45, protG: 4.7, fatG: 0.5, confidence: 0.90 },
      { foodName: '红烧肉',     portionG: 120, kcal: 396, carbG: 4,  protG: 18,  fatG: 34,  confidence: 0.89 },
      { foodName: '蒜蓉西兰花', portionG: 120, kcal: 40,  carbG: 6,  protG: 3,   fatG: 0.6, confidence: 0.84 },
    ],
    S: [
      { foodName: '苹果',   portionG: 200, kcal: 104, carbG: 27, protG: 0.5, fatG: 0.3, confidence: 0.94 },
      { foodName: '酸奶',   portionG: 150, kcal: 108, carbG: 15, protG: 5,   fatG: 3,   confidence: 0.90 },
    ],
  } as const;

  async recognize(imageBase64: string, mimeType: string): Promise<VisionResult> {
    await new Promise((r) => setTimeout(r, 800));
    const h = new Date().getHours();
    const key: keyof typeof this.SEEDS =
      h < 10 ? 'B' :
      h < 14 ? 'L' :
      h < 17 ? 'S' :
      h < 22 ? 'D' : 'S';
    const base = this.SEEDS[key];
    const factor = 1 + ((imageBase64.length % 17) - 8) / 100;
    const items = base.map((it) => ({
      ...it,
      portionG: Math.round(it.portionG * factor),
      kcal:     Math.round(it.kcal * factor),
      carbG:    +(it.carbG * factor).toFixed(1),
      protG:    +(it.protG * factor).toFixed(1),
      fatG:     +(it.fatG * factor).toFixed(1),
    }));
    this.logger.log(`mock 识别 · meal=${key} items=${items.length} mime=${mimeType} b64Len=${imageBase64.length}`);
    return { provider: this.name, items, costCents: 0 };
  }
}

@Injectable()
export class VisionService {
  private readonly logger = new Logger('VisionService');
  constructor(@Inject(VISION_PROVIDER) private readonly provider: VisionProvider) {
    this.logger.log(`Vision provider = ${provider.name}`);
  }
  recognize(imageBase64: string, mimeType: string): Promise<VisionResult> {
    return this.provider.recognize(imageBase64, mimeType);
  }
  currentProvider(): string { return this.provider.name; }
}

@Module({
  providers: [
    MockVisionProvider,
    {
      provide: VISION_PROVIDER,
      inject: [ConfigService, MockVisionProvider],
      useFactory: (cfg: ConfigService, mock: MockVisionProvider): VisionProvider => {
        const deepseek = cfg.get<string>('DEEPSEEK_API_KEY');
        const dashscope = cfg.get<string>('DASHSCOPE_API_KEY');
        if (deepseek) {
          Logger.warn('DEEPSEEK_API_KEY 已配置但实现待接入 · 暂用 mock', 'VisionModule');
        } else if (dashscope) {
          Logger.warn('DASHSCOPE_API_KEY 已配置但实现待接入 · 暂用 mock', 'VisionModule');
        } else {
          Logger.log('未配置 vision key · 使用 mock provider', 'VisionModule');
        }
        return mock;
      },
    },
    VisionService,
  ],
  exports: [VisionService],
})
export class VisionModule {}
