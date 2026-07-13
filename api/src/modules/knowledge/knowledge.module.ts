import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { AiKbChunk, AiKbDoc } from '@/entities';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';

/** 每片最长字符数 · 阶段 1 按段落切 · 阶段 2 按 tokens */
const CHUNK_MAX_CHARS = 400;

interface SeedDoc {
  title: string;
  tag: string;
  paragraphs: string[];
}

/** 初始种子 · 中文常识 · 6 篇 · 让 search_knowledge_base 有的搜 */
const SEED: SeedDoc[] = [
  {
    title: '减脂原理与热量赤字',
    tag: '减脂,基础',
    paragraphs: [
      '减脂的本质是长期热量赤字：一天摄入 < 一天消耗。健康节奏是每周减重 0.3 - 0.7 公斤，对应每日赤字 300 - 500 kcal，过快容易反弹和肌肉流失。',
      'TDEE（每日总能量消耗）= BMR × 活动系数。计算 BMR 常用 Mifflin-St Jeor：男 = 10×kg + 6.25×cm − 5×age + 5；女 = 上式再减 161。活动系数 1.2（久坐）到 1.9（重体力）。',
      '宏营素分配一般为：蛋白 1.6 - 2.2 g / kg 体重 · 碳水占总热量 40 - 50% · 脂肪 20 - 30%。蛋白要在减脂期优先保证 · 才能少掉肌肉。',
    ],
  },
  {
    title: '轻断食 (Intermittent Fasting)',
    tag: '断食',
    paragraphs: [
      '16 : 8 断食是最常见的方式：每天集中在 8 小时进食 · 剩下 16 小时只喝水/黑咖啡/无糖茶。适合大多数上班族 · 相当于跳过早餐或晚餐一次。',
      '断食好处：提升胰岛素敏感度 · 促进自噬 · 简化饮食决策。副作用：初期饥饿感 · 易低血糖 · 建议先从 12:12 或 14:10 过渡。',
      '断食期禁忌：孕妇 · 哺乳期 · BMI < 18.5 · 有饮食失调史 · 糖尿病用胰岛素者 · 建议先咨询医生。',
    ],
  },
  {
    title: '水分摄入',
    tag: '水分,基础',
    paragraphs: [
      '成人每日建议总水分摄入 2.5 - 3 L · 其中约 20% 来自食物 · 需要额外喝 2 L 左右。运动 · 高温 · 高蛋白饮食时应上调。',
      '判断是否喝够：观察尿液颜色 · 淡黄色最佳 · 深黄说明缺水 · 完全无色则可能过量。分次饮水优于一次牛饮 · 有助于吸收。',
    ],
  },
  {
    title: '运动与消耗',
    tag: '运动',
    paragraphs: [
      '减脂期建议每周 3-5 次运动 · 每次 30-60 分钟。有氧（跑步 · 骑行 · 游泳）主要燃脂 · 力量训练维持代谢和肌肉。二者结合最优。',
      'HIIT（高强度间歇）性价比高 · 20 分钟等效 45 分钟慢跑的燃脂效果 · 但对膝盖压力大 · 初学者慎入 · 每周 ≤ 2 次。',
      '力量训练不用担心变粗壮 · 女性睾酮低 · 增肌很难 · 反而能塑形提高代谢。深蹲 · 硬拉 · 卧推 · 划船是四大基础动作。',
    ],
  },
  {
    title: '平台期与复食',
    tag: '减脂,进阶',
    paragraphs: [
      '减脂 4-8 周后常遇平台期 · 体重停止下降。原因是身体适应了新代谢率。破解办法：短期 refeed（复食）一天回到 TDEE · 增加抗阻训练 · 变换有氧方式。',
      '不要长期极低热量 · 会引发代谢适应（甲状腺下降 · 静息代谢降 20%+）· 反弹快 · 建议每减 8-12 周做 1-2 周维持期。',
      '复食（结束减脂）要循序渐进 · 每周热量 +150 kcal · 观察体重稳定后再加 · 避免脂肪快速回填。',
    ],
  },
  {
    title: '心理与情绪',
    tag: '心理',
    paragraphs: [
      '情绪化进食是很多人减脂失败的核心 · 焦虑 · 疲惫 · 无聊时更容易吃甜和油。识别触发场景 · 用散步 · 短睡 · 深呼吸替代。',
      '不要用食物奖励自己 · 会强化"吃 = 快乐"的神经回路。可以换成非食物奖励：一件衣服 · 一次按摩 · 一场电影。',
    ],
  },
];

class SearchDto {
  @IsString() @Length(1, 100) q!: string;
  @IsOptional() @IsString() @Length(1, 4) limit?: string;
}

class CreateDocDto {
  @IsString() @Length(1, 100) title!: string;
  @IsString() @Length(1, 20000) text!: string;
  @IsOptional() @IsString() @Length(0, 100) tag?: string;
  @IsOptional() @IsString() @IsIn(['MD', 'PD', 'TX']) sourceType?: string;
}

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private readonly logger = new Logger('KnowledgeService');

  constructor(
    @InjectRepository(AiKbDoc) private readonly docRepo: Repository<AiKbDoc>,
    @InjectRepository(AiKbChunk) private readonly chunkRepo: Repository<AiKbChunk>,
    private readonly idGen: IdGeneratorService,
  ) {}

  onModuleInit(): void {
    setImmediate(() => {
      this.seedIfEmpty().catch((e: unknown) => {
        this.logger.warn(`kb seed 失败：${(e as Error).message}`);
      });
    });
  }

  private async seedIfEmpty(): Promise<void> {
    const count = await this.docRepo.count({ where: { delFlag: 'N' } });
    if (count > 0) {
      this.logger.log(`ai_kb_doc 已有 ${count} 篇 · 跳过 seed`);
      return;
    }
    this.logger.log(`ai_kb_doc 为空 · 开始 seed ${SEED.length} 篇...`);
    let totalChunks = 0;
    for (const s of SEED) {
      await this.createInternal({ title: s.title, tag: s.tag, chunks: s.paragraphs, sourceType: 'MD' });
      totalChunks += s.paragraphs.length;
    }
    this.logger.log(`kb seed 完成 · ${SEED.length} 篇 · ${totalChunks} 切片`);
  }

  private async createInternal(input: { title: string; tag?: string; chunks: string[]; sourceType?: string; createBy?: string }) {
    const now = new Date();
    const docId = await this.idGen.next('ai_kb_doc');
    await this.docRepo.insert({
      id: docId,
      docTitle: input.title.slice(0, 100),
      docTag: input.tag?.slice(0, 100),
      sourceType: input.sourceType ?? 'MD',
      chunkCount: input.chunks.length,
      kbStatus: 'A',
      publishTime: now,
      delFlag: 'N',
      createBy: input.createBy ?? '000000',
      updateBy: input.createBy ?? '000000',
      createTime: now,
      updateTime: now,
    });
    if (input.chunks.length) {
      const chunkIds = await this.idGen.nextBatch('ai_kb_chunk', input.chunks.length);
      const rows = input.chunks.map((text, i) => ({
        id: chunkIds[i],
        docId,
        chunkIdx: i,
        chunkText: text.slice(0, 2000),
        chunkTokens: Math.min(32767, Math.ceil(text.length / 2)),
        embedding: undefined as unknown as string,
        hitCount: 0,
        delFlag: 'N',
        createBy: input.createBy ?? '000000',
        updateBy: input.createBy ?? '000000',
        createTime: now,
        updateTime: now,
      }));
      await this.chunkRepo.insert(rows);
    }
    return docId;
  }

  async createDoc(userId: string, dto: CreateDocDto) {
    const chunks = this.splitText(dto.text);
    if (!chunks.length) throw new BadRequestException('文本切分为空');
    const docId = await this.createInternal({
      title: dto.title, tag: dto.tag, chunks,
      sourceType: dto.sourceType ?? 'TX', createBy: userId,
    });
    return { id: docId, chunkCount: chunks.length };
  }

  private splitText(text: string): string[] {
    const paras = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    const out: string[] = [];
    for (const p of paras) {
      if (p.length <= CHUNK_MAX_CHARS) {
        out.push(p);
      } else {
        for (let i = 0; i < p.length; i += CHUNK_MAX_CHARS) {
          out.push(p.slice(i, i + CHUNK_MAX_CHARS));
        }
      }
    }
    return out;
  }

  async listDocs() {
    return this.docRepo.find({
      where: { delFlag: 'N' },
      order: { publishTime: 'DESC' },
      take: 100,
    });
  }

  async deleteDoc(userId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, delFlag: 'N' } });
    if (!doc) throw new NotFoundException('文档不存在');
    const now = new Date();
    await this.docRepo.update({ id: docId }, { delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now });
    await this.chunkRepo
      .createQueryBuilder()
      .update()
      .set({ delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now })
      .where({ docId, delFlag: 'N' })
      .execute();
    return { success: true };
  }

  /** 关键词搜（阶段 1 · 无 embedding）· ILIKE + hit_count 排序 */
  async search(q: string, limit = 5) {
    if (!q?.trim()) return [];
    const cap = Math.max(1, Math.min(20, limit));
    const words = q.split(/\s+/).filter((w) => w.length >= 1).slice(0, 5);
    if (!words.length) return [];

    const qb = this.chunkRepo
      .createQueryBuilder('c')
      .innerJoin(AiKbDoc, 'd', 'd.id = c.doc_id')
      .where("c.del_flag = 'N'")
      .andWhere("d.del_flag = 'N'")
      .andWhere("d.kb_status = 'A'");
    words.forEach((w, i) => {
      qb.andWhere(`(c.chunk_text ILIKE :w${i} OR COALESCE(d.doc_tag, '') ILIKE :w${i})`, { [`w${i}`]: `%${w}%` });
    });
    qb.orderBy('c.hit_count', 'DESC').addOrderBy('c.chunk_idx', 'ASC').limit(cap);
    qb.select([
      'c.id AS id',
      'c.doc_id AS "docId"',
      'c.chunk_idx AS "chunkIdx"',
      'c.chunk_text AS "chunkText"',
      'd.doc_title AS "docTitle"',
      'd.doc_tag AS "docTag"',
    ]);
    const rows = await qb.getRawMany<{
      id: string; docId: string; chunkIdx: number; chunkText: string; docTitle: string; docTag: string | null;
    }>();

    if (rows.length) {
      this.chunkRepo
        .increment({ id: rows[0].id }, 'hitCount', 1)
        .catch(() => undefined);
    }
    return rows;
  }
}

@Controller('kb')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly svc: KnowledgeService) {}

  @Get('search')
  search(@Query() dto: SearchDto) {
    return this.svc.search(dto.q, dto.limit ? Number(dto.limit) : 5);
  }

  @Get('docs')
  list() {
    return this.svc.listDocs();
  }

  @Post('docs')
  @HttpCode(200)
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateDocDto) {
    return this.svc.createDoc(u.id, dto);
  }

  @Delete('docs/:id')
  del(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteDoc(u.id, id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([AiKbDoc, AiKbChunk])],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
