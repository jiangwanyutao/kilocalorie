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
  OnModuleInit,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString, Length } from 'class-validator';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { FoodStd, FoodUser, FoodFavorite, MealItem } from '@/entities';
import { CurrentUser, JwtAuthGuard } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';

interface SeedRow {
  n: string; s: string; c: string;
  ug?: number; pg: number; pd: string;
  kcal: number; carb: number; prot: number; fat: number;
  brand?: string;
}

/** 精选常见食物 · 数值 per 100g · 参考中国食物成分表标准版第 6 版 + 品牌官方营养表 */
const SEED: SeedRow[] = [
  { n:'米饭', s:'mifan', c:'01', pg:200, pd:'1 碗', kcal:116, carb:25, prot:2.6, fat:0.3 },
  { n:'白粥', s:'baizhou', c:'01', pg:250, pd:'1 碗', kcal:46, carb:9.4, prot:1.1, fat:0.2 },
  { n:'馒头', s:'mantou', c:'01', pg:60, pd:'1 个', kcal:223, carb:47, prot:7, fat:1.1 },
  { n:'花卷', s:'huajuan', c:'01', pg:80, pd:'1 个', kcal:217, carb:45, prot:7, fat:1.4 },
  { n:'煮面条', s:'zhumiantiao', c:'01', pg:200, pd:'1 碗', kcal:110, carb:24, prot:3, fat:0.4 },
  { n:'燕麦片', s:'yanmaipian', c:'01', pg:40, pd:'1 份', kcal:367, carb:66, prot:15, fat:6.7 },
  { n:'全麦面包', s:'quanmaimianbao', c:'01', pg:25, pd:'1 片', kcal:246, carb:46, prot:8, fat:4 },
  { n:'白面包', s:'baimianbao', c:'01', pg:25, pd:'1 片', kcal:265, carb:51, prot:8, fat:3 },
  { n:'玉米', s:'yumi', c:'01', pg:150, pd:'1 根', kcal:106, carb:22, prot:4, fat:1.2 },
  { n:'红薯', s:'hongshu', c:'01', pg:150, pd:'1 个中等', kcal:99, carb:24, prot:1.1, fat:0.2 },
  { n:'意面(煮)', s:'yimian', c:'01', pg:200, pd:'1 份', kcal:158, carb:31, prot:6, fat:0.9 },
  { n:'猪肉大葱饺子', s:'zhuroudacongjiaozi', c:'11', pg:25, pd:'1 个', kcal:233, carb:27, prot:9, fat:10 },
  { n:'猪肉包子', s:'zhuroubaozi', c:'11', pg:100, pd:'1 个', kcal:227, carb:32, prot:10, fat:7 },
  { n:'春卷', s:'chunjuan', c:'11', pg:40, pd:'1 个', kcal:175, carb:21, prot:3.5, fat:8 },
  { n:'白菜', s:'baicai', c:'02', pg:200, pd:'1 小把', kcal:20, carb:3.4, prot:1.5, fat:0.2 },
  { n:'生菜', s:'shengcai', c:'02', pg:100, pd:'1 份', kcal:15, carb:2.9, prot:1.4, fat:0.2 },
  { n:'番茄', s:'fanqie', c:'02', pg:150, pd:'1 个', kcal:20, carb:3.9, prot:0.9, fat:0.2 },
  { n:'黄瓜', s:'huanggua', c:'02', pg:100, pd:'1 根', kcal:15, carb:3.3, prot:0.7, fat:0.1 },
  { n:'胡萝卜', s:'huluobo', c:'02', pg:150, pd:'1 根', kcal:39, carb:8.8, prot:1, fat:0.2 },
  { n:'西兰花', s:'xilanhua', c:'02', pg:100, pd:'1 小碗', kcal:34, carb:5.6, prot:3.5, fat:0.4 },
  { n:'土豆', s:'tudou', c:'02', pg:150, pd:'1 个中等', kcal:76, carb:17, prot:2, fat:0.2 },
  { n:'菠菜', s:'bocai', c:'02', pg:200, pd:'1 小把', kcal:24, carb:3.6, prot:2.9, fat:0.4 },
  { n:'茄子', s:'qiezi', c:'02', pg:150, pd:'1 个', kcal:21, carb:5, prot:1, fat:0.1 },
  { n:'青椒', s:'qingjiao', c:'02', pg:100, pd:'1 个', kcal:27, carb:6, prot:1.3, fat:0.2 },
  { n:'苹果', s:'pingguo', c:'03', pg:200, pd:'1 个', kcal:52, carb:14, prot:0.3, fat:0.2 },
  { n:'香蕉', s:'xiangjiao', c:'03', pg:100, pd:'1 根', kcal:89, carb:23, prot:1.1, fat:0.3 },
  { n:'橘子', s:'juzi', c:'03', pg:150, pd:'1 个', kcal:43, carb:11, prot:0.8, fat:0.1 },
  { n:'葡萄', s:'putao', c:'03', pg:100, pd:'10 颗', kcal:62, carb:16, prot:0.7, fat:0.4 },
  { n:'西瓜', s:'xigua', c:'03', pg:300, pd:'1 大块', kcal:30, carb:8, prot:0.6, fat:0.2 },
  { n:'梨', s:'li', c:'03', pg:200, pd:'1 个', kcal:44, carb:12, prot:0.4, fat:0.1 },
  { n:'猕猴桃', s:'mihoutao', c:'03', pg:100, pd:'1 个', kcal:61, carb:15, prot:1.1, fat:0.5 },
  { n:'草莓', s:'caomei', c:'03', pg:100, pd:'5 颗', kcal:32, carb:7.7, prot:0.7, fat:0.3 },
  { n:'鸡蛋', s:'jidan', c:'06', pg:50, pd:'1 颗', kcal:155, carb:1.1, prot:12.6, fat:10.6 },
  { n:'茶叶蛋', s:'chayedan', c:'06', pg:50, pd:'1 颗', kcal:158, carb:1.3, prot:13, fat:11 },
  { n:'白煮蛋', s:'baizhudan', c:'06', pg:50, pd:'1 颗', kcal:147, carb:1.1, prot:12.5, fat:10 },
  { n:'鸡胸肉(生)', s:'jixiongrou', c:'04', pg:100, pd:'1 份', kcal:165, carb:0, prot:31, fat:3.6 },
  { n:'鸡腿(带皮)', s:'jitui', c:'04', pg:100, pd:'1 个', kcal:213, carb:0, prot:27, fat:11 },
  { n:'瘦猪肉', s:'shouzhurou', c:'04', pg:100, pd:'1 份', kcal:143, carb:1.5, prot:20, fat:6.2 },
  { n:'五花肉', s:'wuhuarou', c:'04', pg:100, pd:'1 份', kcal:508, carb:0, prot:14, fat:50 },
  { n:'瘦牛肉', s:'shouniurou', c:'04', pg:100, pd:'1 份', kcal:143, carb:0, prot:26, fat:3.6 },
  { n:'三文鱼', s:'sanwenyu', c:'05', pg:100, pd:'1 块', kcal:208, carb:0, prot:20, fat:13 },
  { n:'虾仁', s:'xiaren', c:'05', pg:100, pd:'1 份', kcal:99, carb:0, prot:24, fat:0.3 },
  { n:'全脂牛奶', s:'quanzhiniunai', c:'07', pg:250, pd:'1 杯', kcal:65, carb:5, prot:3.3, fat:3.6 },
  { n:'脱脂牛奶', s:'tuozhiniunai', c:'07', pg:250, pd:'1 杯', kcal:33, carb:5, prot:3.4, fat:0.1 },
  { n:'无糖酸奶', s:'wutangsuannai', c:'07', pg:100, pd:'1 盒', kcal:60, carb:5, prot:3.3, fat:3.2 },
  { n:'燕麦奶', s:'yanmainai', c:'07', pg:250, pd:'1 杯', kcal:47, carb:7.5, prot:1, fat:1.5 },
  { n:'北豆腐', s:'beidoufu', c:'08', pg:100, pd:'1 块', kcal:76, carb:4.2, prot:12, fat:4.8 },
  { n:'无糖豆浆', s:'wutangdoujiang', c:'08', pg:250, pd:'1 杯', kcal:33, carb:2, prot:3.4, fat:1.1 },
  { n:'花生', s:'huasheng', c:'09', pg:30, pd:'1 小把', kcal:567, carb:16, prot:26, fat:49 },
  { n:'杏仁', s:'xingren', c:'09', pg:20, pd:'20 颗', kcal:579, carb:22, prot:21, fat:50 },
  { n:'核桃', s:'hetao', c:'09', pg:30, pd:'3 颗', kcal:654, carb:14, prot:15, fat:65 },
  { n:'腰果', s:'yaoguo', c:'09', pg:20, pd:'10 颗', kcal:553, carb:30, prot:18, fat:44 },
  { n:'星巴克拿铁(中杯)', s:'xingbakenatie', c:'12', pg:355, pd:'1 杯 · 355ml', kcal:55, carb:8, prot:3, fat:2, brand:'星巴克' },
  { n:'瑞幸美式(中杯)', s:'ruixingmeishi', c:'12', pg:480, pd:'1 杯 · 480ml', kcal:2, carb:0.5, prot:0.1, fat:0, brand:'瑞幸' },
  { n:'瑞幸生椰拿铁', s:'ruixingshengyenatie', c:'12', pg:480, pd:'1 杯', kcal:70, carb:9, prot:2, fat:3, brand:'瑞幸' },
  { n:'Manner拿铁(小杯)', s:'mannernatie', c:'12', pg:240, pd:'1 杯', kcal:60, carb:8, prot:3.3, fat:2, brand:'Manner' },
  { n:'可口可乐(罐装)', s:'kekoukele', c:'12', pg:330, pd:'1 罐 · 330ml', kcal:42, carb:10.6, prot:0, fat:0, brand:'可口可乐' },
  { n:'元气森林白桃味', s:'yuanqisenlinbaitao', c:'12', pg:480, pd:'1 瓶 · 480ml', kcal:0, carb:0, prot:0, fat:0, brand:'元气森林' },
  { n:'康师傅冰红茶', s:'kangshifubinghongcha', c:'12', pg:500, pd:'1 瓶 · 500ml', kcal:30, carb:7.4, prot:0, fat:0, brand:'康师傅' },
  { n:'农夫山泉', s:'nongfushanquan', c:'12', pg:550, pd:'1 瓶 · 550ml', kcal:0, carb:0, prot:0, fat:0, brand:'农夫山泉' },
  { n:'宫保鸡丁', s:'gongbaojiding', c:'11', pg:200, pd:'1 份', kcal:200, carb:9, prot:15, fat:12 },
  { n:'麻婆豆腐', s:'mapodoufu', c:'11', pg:200, pd:'1 份', kcal:130, carb:6, prot:8, fat:9 },
  { n:'番茄炒蛋', s:'fanqiechaodan', c:'11', pg:150, pd:'1 份', kcal:120, carb:4, prot:7, fat:8 },
  { n:'红烧肉', s:'hongshaorou', c:'11', pg:100, pd:'1 份(4-5块)', kcal:320, carb:8, prot:15, fat:26 },
  { n:'糖醋里脊', s:'tangculiji', c:'11', pg:150, pd:'1 份', kcal:260, carb:25, prot:12, fat:12 },
  { n:'鱼香肉丝', s:'yuxiangrousi', c:'11', pg:200, pd:'1 份', kcal:180, carb:12, prot:12, fat:10 },
  { n:'蒜蓉西兰花', s:'suanrongxilanhua', c:'11', pg:150, pd:'1 份', kcal:45, carb:5, prot:3, fat:2 },
  { n:'清炒时蔬', s:'qingchaoshishu', c:'11', pg:200, pd:'1 份', kcal:40, carb:6, prot:2, fat:1 },
  { n:'清蒸鲈鱼', s:'qingzhengluyu', c:'11', pg:200, pd:'1 份', kcal:100, carb:0, prot:18, fat:3 },
  { n:'白灼虾', s:'baizhuoxia', c:'11', pg:100, pd:'8-10 只', kcal:85, carb:0, prot:20, fat:1 },
  { n:'拍黄瓜', s:'paihuanggua', c:'11', pg:150, pd:'1 份', kcal:25, carb:5, prot:1, fat:0.5 },
  { n:'凉拌木耳', s:'liangbanmuer', c:'11', pg:100, pd:'1 份', kcal:40, carb:8, prot:2, fat:0.5 },
  { n:'麦当劳巨无霸', s:'maidanglaojuwuba', c:'12', pg:219, pd:'1 个', kcal:250, carb:20, prot:12, fat:14, brand:'麦当劳' },
  { n:'麦当劳麦香鸡', s:'maidanglaomaixiangji', c:'12', pg:130, pd:'1 个', kcal:240, carb:25, prot:10, fat:11, brand:'麦当劳' },
  { n:'麦当劳薯条(中)', s:'maidanglaoshutiao', c:'12', pg:117, pd:'1 份 · 中', kcal:320, carb:41, prot:4, fat:15, brand:'麦当劳' },
  { n:'肯德基香辣鸡腿堡', s:'kendejixianglajituibao', c:'12', pg:155, pd:'1 个', kcal:275, carb:22, prot:12, fat:15, brand:'肯德基' },
  { n:'肯德基原味鸡', s:'kendejiyuanweiji', c:'12', pg:100, pd:'1 块', kcal:280, carb:8, prot:20, fat:18, brand:'肯德基' },
  { n:'饭团(三角)', s:'fantuan', c:'12', pg:110, pd:'1 个', kcal:170, carb:30, prot:6, fat:4, brand:'便利店' },
  { n:'三明治(火腿蛋)', s:'sanmingzhi', c:'12', pg:150, pd:'1 个', kcal:240, carb:25, prot:12, fat:10, brand:'便利店' },
  { n:'华夫饼', s:'huafubing', c:'12', pg:40, pd:'1 个', kcal:291, carb:33, prot:6, fat:15 },
];

@Injectable()
export class FoodService implements OnModuleInit {
  private readonly logger = new Logger('FoodService');

  constructor(
    @InjectRepository(FoodStd) private readonly stdRepo: Repository<FoodStd>,
    private readonly idGen: IdGeneratorService,
  ) {}

  onModuleInit() {
    setImmediate(() => {
      this.seedIfEmpty().catch((e: unknown) => {
        this.logger.warn(`seed 失败：${(e as Error).message}`);
      });
    });
  }

  private async seedIfEmpty() {
    const count = await this.stdRepo.count({ where: { delFlag: 'N' } });
    if (count > 0) {
      this.logger.log(`food_std 已有 ${count} 条 · 跳过 seed`);
      return;
    }
    this.logger.log(`food_std 为空 · 开始 seed ${SEED.length} 条精选食物...`);
    const ids = await this.idGen.nextBatch('food_std', SEED.length);
    const now = new Date();
    const rows = SEED.map((f, i) => ({
      id: ids[i],
      foodName: f.n,
      spellCode: f.s.replace(/\s+/g, '').slice(0, 20),
      catCode: f.c,
      brand: f.brand,
      unitG: f.ug ?? 100,
      portionG: f.pg,
      portionDesc: f.pd,
      kcal: String(f.kcal),
      carbG: String(f.carb),
      protG: String(f.prot),
      fatG: String(f.fat),
      sourceRef: '中国食物成分表第6版 · 品牌官方',
      status: 'A',
      delFlag: 'N',
      createBy: '000000',
      updateBy: '000000',
      createTime: now,
      updateTime: now,
    }));
    await this.stdRepo.insert(rows);
    this.logger.log(`food_std seeded ${rows.length} 条`);
  }

  async search(q?: string, cat?: string, limit = 30) {
    const mapFood = (f: FoodStd) => ({
      id: f.id,
      foodName: f.foodName,
      spellCode: f.spellCode,
      catCode: f.catCode,
      brand: f.brand ?? null,
      unitG: f.unitG,
      portionG: f.portionG ?? 100,
      portionDesc: f.portionDesc ?? '',
      kcal: Number(f.kcal),
      carbG: Number(f.carbG),
      protG: Number(f.protG),
      fatG: Number(f.fatG),
    });

    if (!q || !q.trim()) {
      const qb = this.stdRepo.createQueryBuilder('f')
        .where("f.del_flag = 'N'").andWhere("f.status = 'A'");
      if (cat) qb.andWhere('f.cat_code = :c', { c: cat });
      qb.orderBy('f.food_name', 'ASC').limit(Math.min(limit, 100));
      return (await qb.getMany()).map(mapFood);
    }

    const raw = q.trim();
    const run = async (keywords: string[]) => {
      const qb = this.stdRepo.createQueryBuilder('f')
        .where("f.del_flag = 'N'").andWhere("f.status = 'A'");
      qb.andWhere(new Brackets((sub) => {
        keywords.forEach((kw, i) => {
          const p = `n${i}`;
          const sp = `s${i}`;
          const b = `b${i}`;
          const method = i === 0 ? 'where' : 'orWhere';
          sub[method](`f.food_name LIKE :${p}`, { [p]: `%${kw}%` });
          sub.orWhere(`LOWER(f.spell_code) LIKE :${sp}`, { [sp]: `${kw.toLowerCase()}%` });
          sub.orWhere(`f.brand LIKE :${b}`, { [b]: `%${kw}%` });
        });
      }));
      if (cat) qb.andWhere('f.cat_code = :c', { c: cat });
      qb.orderBy('LENGTH(f.food_name)', 'ASC').addOrderBy('f.food_name', 'ASC')
        .limit(Math.min(limit, 100));
      return qb.getMany();
    };

    let list = await run([raw]);

    // 精确命中过少 + 中文 2 字以上 · 拆 2-gram 模糊查
    if (list.length < 3 && /[一-龥]/.test(raw) && raw.length >= 2) {
      const grams: string[] = [];
      for (let i = 0; i < raw.length - 1; i++) grams.push(raw.slice(i, i + 2));
      const uniq = Array.from(new Set(grams));
      if (uniq.length > 0) {
        const fuzzy = await run(uniq);
        const seen = new Set(list.map((f) => f.id));
        for (const f of fuzzy) {
          if (!seen.has(f.id)) { list.push(f); seen.add(f.id); }
          if (list.length >= limit) break;
        }
      }
    }

    return list.slice(0, limit).map(mapFood);
  }
}

/** 收藏 / 常用 / 自建食物 · 独立 Service · 依赖多 repo */
@Injectable()
export class FoodPersonalService {
  constructor(
    @InjectRepository(FoodStd) private readonly stdRepo: Repository<FoodStd>,
    @InjectRepository(FoodUser) private readonly userRepo: Repository<FoodUser>,
    @InjectRepository(FoodFavorite) private readonly favRepo: Repository<FoodFavorite>,
    @InjectRepository(MealItem) private readonly itemRepo: Repository<MealItem>,
    private readonly idGen: IdGeneratorService,
  ) {}

  private mapStd(f: FoodStd) {
    return {
      id: f.id, foodName: f.foodName, spellCode: f.spellCode ?? '',
      catCode: f.catCode, brand: f.brand ?? null,
      unitG: f.unitG, portionG: f.portionG ?? 100, portionDesc: f.portionDesc ?? '',
      kcal: Number(f.kcal), carbG: Number(f.carbG),
      protG: Number(f.protG), fatG: Number(f.fatG),
    };
  }
  private mapUsr(f: FoodUser) {
    return {
      id: f.id, foodName: f.foodName, spellCode: f.spellCode ?? '',
      catCode: f.catCode ?? '', brand: null,
      unitG: f.unitG, portionG: f.portionG ?? 100, portionDesc: f.portionDesc ?? '自定义',
      kcal: Number(f.kcal), carbG: Number(f.carbG),
      protG: Number(f.protG), fatG: Number(f.fatG),
    };
  }

  /** 收藏列表 · 展开 food_std / food_user */
  async favorites(userId: string) {
    const favs = await this.favRepo.find({
      where: { userId, delFlag: 'N' },
      order: { createTime: 'DESC' },
    });
    if (favs.length === 0) return [];
    const stdIds = favs.filter((f) => f.foodSrc === 'S').map((f) => f.foodId);
    const usrIds = favs.filter((f) => f.foodSrc === 'U').map((f) => f.foodId);
    const [stds, usrs] = await Promise.all([
      stdIds.length ? this.stdRepo.find({ where: { id: In(stdIds), delFlag: 'N' } }) : Promise.resolve([] as FoodStd[]),
      usrIds.length ? this.userRepo.find({ where: { id: In(usrIds), userId, delFlag: 'N' } }) : Promise.resolve([] as FoodUser[]),
    ]);
    const map = new Map<string, ReturnType<typeof this.mapStd> | ReturnType<typeof this.mapUsr>>();
    stds.forEach((f) => map.set('S:' + f.id, this.mapStd(f)));
    usrs.forEach((f) => map.set('U:' + f.id, this.mapUsr(f)));
    return favs.map((f) => map.get(f.foodSrc + ':' + f.foodId)).filter((x) => !!x);
  }

  async toggleFavorite(userId: string, foodSrc: 'S' | 'U', foodId: string) {
    const existing = await this.favRepo.findOne({
      where: { userId, foodSrc, foodId, delFlag: 'N' },
    });
    if (existing) {
      await this.favRepo.update({ id: existing.id }, {
        delFlag: 'Y', deleteTime: new Date(), deleteBy: userId,
      });
      return { favorited: false };
    }
    const id = await this.idGen.next('food_favorite');
    const now = new Date();
    await this.favRepo.insert({
      id, userId, foodSrc, foodId,
      delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    });
    return { favorited: true };
  }

  /** 常用 · 从 meal_item 里 GROUP BY food_id 排序（只统计 food_std · foodSrc='S'） */
  async frequent(userId: string, limit = 30) {
    const rows = await this.itemRepo
      .createQueryBuilder('mi')
      .innerJoin('meal_entry', 'me', "me.id = mi.entry_id AND me.user_id = :u AND me.del_flag = 'N'", { u: userId })
      .select('mi.food_id', 'foodId')
      .addSelect('mi.food_src', 'foodSrc')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('MAX(me.meal_time)', 'lastAt')
      .where("mi.del_flag = 'N'")
      .andWhere("mi.food_id IS NOT NULL")
      .andWhere("mi.food_src IN ('S', 'U')")
      .groupBy('mi.food_id').addGroupBy('mi.food_src')
      .orderBy('cnt', 'DESC').addOrderBy('"lastAt"', 'DESC')
      .limit(Math.min(limit, 100))
      .getRawMany();

    if (rows.length === 0) return [];
    const stdIds = rows.filter((r) => r.foodSrc === 'S').map((r) => r.foodId as string);
    const usrIds = rows.filter((r) => r.foodSrc === 'U').map((r) => r.foodId as string);
    const [stds, usrs] = await Promise.all([
      stdIds.length ? this.stdRepo.find({ where: { id: In(stdIds), delFlag: 'N' } }) : Promise.resolve([] as FoodStd[]),
      usrIds.length ? this.userRepo.find({ where: { id: In(usrIds), userId, delFlag: 'N' } }) : Promise.resolve([] as FoodUser[]),
    ]);
    const map = new Map<string, ReturnType<typeof this.mapStd> | ReturnType<typeof this.mapUsr>>();
    stds.forEach((f) => map.set('S:' + f.id, this.mapStd(f)));
    usrs.forEach((f) => map.set('U:' + f.id, this.mapUsr(f)));
    return rows.map((r) => map.get(r.foodSrc + ':' + r.foodId)).filter((x) => !!x);
  }

  /** 用户自建食物列表 */
  async userFoods(userId: string, limit = 60) {
    const list = await this.userRepo.find({
      where: { userId, delFlag: 'N' },
      order: { useCount: 'DESC', updateTime: 'DESC' },
      take: Math.min(limit, 200),
    });
    return list.map((f) => this.mapUsr(f));
  }

  async createUserFood(userId: string, dto: {
    foodName: string; kcal: number;
    portionG?: number; portionDesc?: string;
    carbG?: number; protG?: number; fatG?: number;
    catCode?: string;
  }) {
    const id = await this.idGen.next('food_user');
    const now = new Date();
    await this.userRepo.insert({
      id, userId,
      foodName: dto.foodName,
      catCode: dto.catCode ?? '11',
      unitG: 100,
      portionG: dto.portionG ?? 100,
      portionDesc: dto.portionDesc ?? '1 份',
      kcal: Number(dto.kcal).toFixed(2),
      carbG: (dto.carbG ?? 0).toFixed(2),
      protG: (dto.protG ?? 0).toFixed(2),
      fatG: (dto.fatG ?? 0).toFixed(2),
      useCount: 0,
      delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    } as Record<string, unknown>);
    return { id };
  }
}

class ToggleFavDto {
  @IsString() @IsIn(['S', 'U']) foodSrc!: 'S' | 'U';
  @IsString() @Length(1, 10) foodId!: string;
}

class CreateUserFoodDto {
  @IsString() @Length(1, 50) foodName!: string;
}

@Controller('food')
@UseGuards(JwtAuthGuard)
export class FoodController {
  constructor(
    private readonly svc: FoodService,
    private readonly ps: FoodPersonalService,
  ) {}

  @Get('search')
  search(@Query('q') q?: string, @Query('cat') cat?: string, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 30;
    return this.svc.search(q, cat, Number.isFinite(n) ? n : 30);
  }

  @Get('favorites')
  favorites(@CurrentUser() u: AuthUser) {
    return this.ps.favorites(u.id);
  }

  @Post('favorite')
  @HttpCode(200)
  toggleFav(@CurrentUser() u: AuthUser, @Body() dto: ToggleFavDto) {
    return this.ps.toggleFavorite(u.id, dto.foodSrc, dto.foodId);
  }

  @Get('frequent')
  frequent(@CurrentUser() u: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 30;
    return this.ps.frequent(u.id, Number.isFinite(n) ? n : 30);
  }

  @Get('user')
  userFoods(@CurrentUser() u: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 60;
    return this.ps.userFoods(u.id, Number.isFinite(n) ? n : 60);
  }

  @Post('user')
  @HttpCode(200)
  createUserFood(@CurrentUser() u: AuthUser, @Body() dto: CreateUserFoodDto & Record<string, unknown>) {
    if (!dto.foodName || !dto.kcal) throw new BadRequestException('缺 foodName / kcal');
    return this.ps.createUserFood(u.id, dto as never);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([FoodStd, FoodUser, FoodFavorite, MealItem])],
  controllers: [FoodController],
  providers: [FoodService, FoodPersonalService],
  exports: [FoodService, FoodPersonalService],
})
export class FoodModule {}
