import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { pinyin } from 'pinyin-pro';
import type { FastifyRequest } from 'fastify';

import { IdGeneratorService } from '@/common/id-generator.service';
import { MailService } from '@/common/mail.service';
import { UserInfo, UserAuth, UserSession, UserVerify } from '@/entities';
import type { JwtPayload } from './jwt.strategy';
import type {
  ChangePasswordDto,
  ForgotDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetDto,
} from './auth.dto';

interface PublicUser {
  id: string;
  email: string;
  nickname: string;
  gender: string;
  activityLvl: string;
  vipLvl: string;
  emailVerified: string;
}

interface TokenBundle {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  private readonly bcryptRounds = 12;
  private readonly accessTtlSec = 1800;
  private readonly refreshTtlSec = 60 * 60 * 24 * 30;
  private readonly verifyTtlMs = 24 * 60 * 60 * 1_000;
  private readonly resetTtlMs = 30 * 60 * 1_000;

  constructor(
    @InjectRepository(UserInfo) private readonly userRepo: Repository<UserInfo>,
    @InjectRepository(UserAuth) private readonly authRepo: Repository<UserAuth>,
    @InjectRepository(UserSession) private readonly sessRepo: Repository<UserSession>,
    @InjectRepository(UserVerify) private readonly vrfyRepo: Repository<UserVerify>,
    private readonly idGen: IdGeneratorService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly ds: DataSource,
    private readonly cfg: ConfigService,
  ) {}

  async register(dto: RegisterDto, req?: FastifyRequest): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.userRepo.findOne({ where: { email, delFlag: 'N' } });

    // 已激活账号 → 明确拒绝
    if (exists && exists.emailVerified === 'Y') {
      throw new ConflictException('邮箱已注册，请直接登录');
    }

    // 未激活账号 → 允许覆盖 nickname/密码 + 重发验证邮件（用户可能第一次填错、或没收到邮件）
    if (exists) {
      const pwdHash = await bcrypt.hash(dto.password, this.bcryptRounds);
      const now = new Date();
      const uid = exists.id;
      await this.ds.transaction(async (mgr) => {
        await mgr.update(
          UserInfo,
          { id: uid },
          { nickname: dto.nickname, updateBy: uid, updateTime: now },
        );
        await mgr
          .createQueryBuilder()
          .update(UserAuth)
          .set({ pwdHash, pwdVer: () => 'pwd_ver + 1', updateBy: uid, updateTime: now })
          .where('id = :id', { id: uid })
          .execute();
      });
      const token = await this.issueVerifyToken(uid, email, 'V');
      this.mail.sendVerifyEmail(email, token).catch((e: unknown) => {
        this.logger.warn(`验证邮件重发失败：${(e as Error).message}`);
      });
      return {
        id: uid,
        email,
        nickname: dto.nickname,
        gender: exists.gender,
        activityLvl: exists.activityLvl,
        vipLvl: exists.vipLvl,
        emailVerified: 'N',
      };
    }

    // 全新账号
    const id = await this.idGen.next('user_info');
    const pwdHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    const now = new Date();

    await this.ds.transaction(async (mgr) => {
      await mgr.insert(UserInfo, {
        id,
        nickname: dto.nickname,
        email,
        gender: 'U',
        activityLvl: '2',
        vipLvl: '0',
        emailVerified: 'N',
        status: 'A',
        delFlag: 'N',
        regIp: this.pickIp(req),
        regUa: req?.headers['user-agent']?.slice(0, 200),
        createBy: id,
        updateBy: id,
        createTime: now,
        updateTime: now,
      });
      await mgr.insert(UserAuth, {
        id,
        pwdHash,
        pwdVer: 1,
        delFlag: 'N',
        createBy: id,
        updateBy: id,
        createTime: now,
        updateTime: now,
      });
    });

    const token = await this.issueVerifyToken(id, email, 'V');
    this.mail.sendVerifyEmail(email, token).catch((e: unknown) => {
      this.logger.warn(`验证邮件发送失败：${(e as Error).message}`);
    });

    return {
      id,
      email,
      nickname: dto.nickname,
      gender: 'U',
      activityLvl: '2',
      vipLvl: '0',
      emailVerified: 'N',
    };
  }

  async verify(token: string): Promise<{ success: true; email: string }> {
    if (!token || token.length < 32) throw new BadRequestException('token 无效');
    const rec = await this.vrfyRepo.findOne({
      where: { verifyToken: token, verifyType: 'V', usedFlag: 'N', delFlag: 'N' },
    });
    if (!rec) throw new BadRequestException('链接无效或已使用');
    if (rec.expireTime.getTime() < Date.now()) throw new BadRequestException('链接已过期');

    await this.ds.transaction(async (mgr) => {
      await mgr.update(UserVerify, { id: rec.id }, { usedFlag: 'Y', updateTime: new Date() });
      if (rec.userId) {
        await mgr.update(
          UserInfo,
          { id: rec.userId },
          { emailVerified: 'Y', updateBy: rec.userId, updateTime: new Date() },
        );
      }
    });

    return { success: true, email: rec.email };
  }

  async login(dto: LoginDto, req?: FastifyRequest): Promise<TokenBundle> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email, delFlag: 'N' } });
    if (!user) throw new UnauthorizedException('邮箱或密码错误');
    if (user.status === 'D') throw new UnauthorizedException('账号已注销');
    if (user.status === 'F') throw new UnauthorizedException('账号已冻结');

    const auth = await this.authRepo.findOne({ where: { id: user.id, delFlag: 'N' } });
    if (!auth) throw new UnauthorizedException('账号异常');

    const ok = await bcrypt.compare(dto.password, auth.pwdHash);
    if (!ok) throw new UnauthorizedException('邮箱或密码错误');

    if (user.emailVerified !== 'Y') {
      const t = await this.issueVerifyToken(user.id, email, 'V');
      this.mail.sendVerifyEmail(email, t).catch(() => undefined);
      throw new UnauthorizedException('邮箱未验证，已重发验证邮件');
    }

    const payload: JwtPayload = { sub: user.id, ver: auth.pwdVer };
    const access_token = await this.jwt.signAsync(payload, { expiresIn: this.accessTtlSec });
    const refresh_token = randomBytes(32).toString('hex');

    const sessId = await this.idGen.next('user_session');
    const now = new Date();
    await this.sessRepo.insert({
      id: sessId,
      userId: user.id,
      refreshToken: refresh_token,
      deviceInfo: req?.headers['user-agent']?.slice(0, 200),
      ipAddr: this.pickIp(req),
      expireTime: new Date(Date.now() + this.refreshTtlSec * 1_000),
      revoked: 'N',
      delFlag: 'N',
      createBy: user.id,
      updateBy: user.id,
      createTime: now,
      updateTime: now,
    });

    await this.userRepo.update({ id: user.id }, { lastLogin: now, updateTime: now });

    return {
      access_token,
      refresh_token,
      expires_in: this.accessTtlSec,
      user: this.publicOf(user),
    };
  }

  async refresh(dto: RefreshDto): Promise<Pick<TokenBundle, 'access_token' | 'expires_in'>> {
    const sess = await this.sessRepo.findOne({
      where: { refreshToken: dto.refreshToken, revoked: 'N', delFlag: 'N' },
    });
    if (!sess) throw new UnauthorizedException('refresh token 无效');
    if (sess.expireTime.getTime() < Date.now()) {
      await this.sessRepo.update({ id: sess.id }, { revoked: 'Y', updateTime: new Date() });
      throw new UnauthorizedException('refresh token 已过期');
    }

    const auth = await this.authRepo.findOne({ where: { id: sess.userId, delFlag: 'N' } });
    if (!auth) throw new UnauthorizedException('账号异常');

    const payload: JwtPayload = { sub: sess.userId, ver: auth.pwdVer };
    const access_token = await this.jwt.signAsync(payload, { expiresIn: this.accessTtlSec });
    return { access_token, expires_in: this.accessTtlSec };
  }

  async forgot(dto: ForgotDto): Promise<{ success: true }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email, delFlag: 'N' } });
    if (user && user.status === 'A') {
      const token = await this.issueVerifyToken(user.id, email, 'R', this.resetTtlMs);
      this.mail.sendResetEmail(email, token).catch((e: unknown) => {
        this.logger.warn(`重置邮件发送失败：${(e as Error).message}`);
      });
    }
    return { success: true };
  }

  /** 登录态改密 · 旧密核对 → pwdVer+1 → 撤销所有 session（含当前 · 强制重登） */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: true }> {
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }
    const auth = await this.authRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    if (!auth) throw new UnauthorizedException('账号异常');

    const ok = await bcrypt.compare(dto.oldPassword, auth.pwdHash);
    if (!ok) throw new UnauthorizedException('当前密码错误');

    const pwdHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);
    const now = new Date();

    await this.ds.transaction(async (mgr) => {
      await mgr
        .createQueryBuilder()
        .update(UserAuth)
        .set({
          pwdHash,
          pwdVer: () => 'pwd_ver + 1',
          pwdResetAt: now,
          updateBy: userId,
          updateTime: now,
        })
        .where('id = :id', { id: userId })
        .execute();
      await mgr.update(
        UserSession,
        { userId, revoked: 'N' },
        { revoked: 'Y', updateTime: now },
      );
    });

    return { success: true };
  }

  async reset(dto: ResetDto): Promise<{ success: true }> {
    const rec = await this.vrfyRepo.findOne({
      where: { verifyToken: dto.token, verifyType: 'R', usedFlag: 'N', delFlag: 'N' },
    });
    if (!rec) throw new BadRequestException('链接无效或已使用');
    if (rec.expireTime.getTime() < Date.now()) throw new BadRequestException('链接已过期');
    if (!rec.userId) throw new BadRequestException('账号异常');

    const pwdHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);
    const now = new Date();
    const uid = rec.userId;

    await this.ds.transaction(async (mgr) => {
      await mgr
        .createQueryBuilder()
        .update(UserAuth)
        .set({
          pwdHash,
          pwdVer: () => 'pwd_ver + 1',
          pwdResetAt: now,
          updateBy: uid,
          updateTime: now,
        })
        .where('id = :id', { id: uid })
        .execute();
      await mgr.update(
        UserSession,
        { userId: uid, revoked: 'N' },
        { revoked: 'Y', updateTime: now },
      );
      await mgr.update(UserVerify, { id: rec.id }, { usedFlag: 'Y', updateTime: now });
    });

    return { success: true };
  }

  private async issueVerifyToken(
    userId: string | null,
    email: string,
    type: 'V' | 'R' | 'E',
    ttlMs: number = this.verifyTtlMs,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const id = await this.idGen.next('user_verify');
    const now = new Date();
    await this.vrfyRepo.insert({
      id,
      userId: userId ?? undefined,
      email,
      verifyType: type,
      verifyToken: token,
      usedFlag: 'N',
      expireTime: new Date(Date.now() + ttlMs),
      delFlag: 'N',
      createBy: userId ?? undefined,
      updateBy: userId ?? undefined,
      createTime: now,
      updateTime: now,
    });
    return token;
  }

  private pickIp(req?: FastifyRequest): string | undefined {
    if (!req) return undefined;
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0].trim();
    return req.ip;
  }

  private publicOf(u: UserInfo): PublicUser {
    return {
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      gender: u.gender,
      activityLvl: u.activityLvl,
      vipLvl: u.vipLvl,
      emailVerified: u.emailVerified,
    };
  }

  static spellCodeOf(text: string): string {
    return pinyin(text, { toneType: 'none', separator: '', type: 'string' }).slice(0, 20);
  }
}
