import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { DataSource, In, Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { PaymentRecord } from './entities/payment-record.entity';
import { DownloadRecord } from '../downloads/entities/download-record.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import {
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  PremiumType,
  Role,
} from '../../common/enums';
import { InitPaymentDto } from './dto/init-payment.dto';
import { MomoCallbackDto } from './dto/momo-callback.dto';
import { GrantPremiumDto } from './dto/grant-premium.dto';

// ── Constants ──────────────────────────────────────────────────────────────────

const PREMIUM_DURATION_DAYS: Record<PremiumType, number> = {
  [PremiumType.ONE_MONTH]: 30,
  [PremiumType.THREE_MONTH]: 90,
  [PremiumType.SIX_MONTH]: 180,
  [PremiumType.TWELVE_MONTH]: 365,
};

const PREMIUM_PRICE_VND: Record<PremiumType, number> = {
  [PremiumType.ONE_MONTH]: 30_000,
  [PremiumType.THREE_MONTH]: 79_000,
  [PremiumType.SIX_MONTH]: 169_000,
  [PremiumType.TWELVE_MONTH]: 349_000,
};

const DOWNLOAD_QUOTA: Record<string, number> = {
  ARTIST_PREMIUM: 200,
  USER_PREMIUM: 100,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getPremiumDownloadLimit(roles: Role[]): number {
  if (roles.includes(Role.ADMIN)) return Infinity;
  if (!roles.includes(Role.PREMIUM)) return 0;
  return roles.includes(Role.ARTIST) ? DOWNLOAD_QUOTA.ARTIST_PREMIUM : DOWNLOAD_QUOTA.USER_PREMIUM;
}

// VNPay: sort params alphabetically, join as encoded query string, HMAC-SHA512
function buildVnpaySignature(
  params: Record<string, string>,
  secret: string,
): string {
  const sortedKeys = Object.keys(params).sort();
  const raw = sortedKeys
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHmac('sha512', secret).update(Buffer.from(raw, 'utf-8')).digest('hex');
}

// MoMo: fixed key order required by MoMo API v2
function buildMomoRawSignature(fields: {
  accessKey: string;
  amount: number;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
}): string {
  return (
    `accessKey=${fields.accessKey}&amount=${fields.amount}` +
    `&extraData=${fields.extraData}&ipnUrl=${fields.ipnUrl}` +
    `&orderId=${fields.orderId}&orderInfo=${fields.orderInfo}` +
    `&partnerCode=${fields.partnerCode}&redirectUrl=${fields.redirectUrl}` +
    `&requestId=${fields.requestId}&requestType=${fields.requestType}`
  );
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentRecord)
    private readonly paymentRecords: Repository<PaymentRecord>,
    @InjectRepository(DownloadRecord)
    private readonly downloadRecords: Repository<DownloadRecord>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  // ── VNPay ──────────────────────────────────────────────────────────────────

  async initVnpay(
    userId: string,
    clientIp: string,
    dto: InitPaymentDto,
  ): Promise<{ paymentUrl: string }> {
    const user = await this.findUserOrFail(userId);

    const record = this.paymentRecords.create({
      userId: user.id,
      provider: PaymentProvider.VNPAY,
      amountVnd: PREMIUM_PRICE_VND[dto.premiumType],
      premiumType: dto.premiumType,
      status: PaymentStatus.PENDING,
    });
    await this.paymentRecords.save(record);

    const vnpConfig = this.config.get('payment.vnpay');
    const now = new Date();
    const createDate = now
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14);

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpConfig.tmnCode,
      vnp_Amount: String(PREMIUM_PRICE_VND[dto.premiumType] * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: record.id,
      vnp_OrderInfo: `MyMusic Premium ${dto.premiumType}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: vnpConfig.callbackUrl,
      vnp_IpAddr: clientIp,
      vnp_CreateDate: createDate,
    };

    const secureHash = buildVnpaySignature(params, vnpConfig.hashSecret);
    const queryString = Object.keys(params)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join('&');

    return { paymentUrl: `${vnpConfig.url}?${queryString}&vnp_SecureHash=${secureHash}` };
  }

  async handleVnpayCallback(
    query: Record<string, string>,
  ): Promise<{ redirectUrl: string }> {
    const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;
    const vnpConfig = this.config.get('payment.vnpay');

    // Verify signature
    const expectedHash = buildVnpaySignature(rest, vnpConfig.hashSecret);
    let hashesMatch = false;
    try {
      hashesMatch = timingSafeEqual(
        Buffer.from(vnp_SecureHash?.toLowerCase() ?? '', 'hex'),
        Buffer.from(expectedHash.toLowerCase(), 'hex'),
      );
    } catch {
      hashesMatch = false;
    }

    if (!hashesMatch) {
      throw new BadRequestException('Invalid VNPay signature');
    }

    const paymentRecord = await this.paymentRecords.findOne({
      where: { id: rest.vnp_TxnRef },
      relations: ['user'],
    });

    if (!paymentRecord) {
      throw new NotFoundException('Payment record not found');
    }

    // Idempotency: already processed
    if (paymentRecord.status === PaymentStatus.SUCCESS) {
      return { redirectUrl: `${vnpConfig.returnUrl}?status=success` };
    }

    if (rest.vnp_ResponseCode !== '00') {
      await this.paymentRecords.update(paymentRecord.id, {
        status: PaymentStatus.FAILED,
        transactionId: rest.vnp_TransactionNo ?? null,
      });
      return { redirectUrl: `${vnpConfig.returnUrl}?status=failed` };
    }

    await this.grantPremium(
      paymentRecord.user,
      paymentRecord.premiumType,
      paymentRecord.id,
      rest.vnp_TransactionNo,
      PaymentProvider.VNPAY,
      PREMIUM_PRICE_VND[paymentRecord.premiumType],
    );

    return { redirectUrl: `${vnpConfig.returnUrl}?status=success` };
  }

  // ── MoMo ──────────────────────────────────────────────────────────────────

  async initMomo(
    userId: string,
    dto: InitPaymentDto,
  ): Promise<{ paymentUrl: string }> {
    const user = await this.findUserOrFail(userId);
    const momoConfig = this.config.get('payment.momo');

    const record = this.paymentRecords.create({
      userId: user.id,
      provider: PaymentProvider.MOMO,
      amountVnd: PREMIUM_PRICE_VND[dto.premiumType],
      premiumType: dto.premiumType,
      status: PaymentStatus.PENDING,
    });
    await this.paymentRecords.save(record);

    const requestId = uuidv4();
    const amount = PREMIUM_PRICE_VND[dto.premiumType];
    const extraData = '';

    const rawSignature = buildMomoRawSignature({
      accessKey: momoConfig.accessKey,
      amount,
      extraData,
      ipnUrl: momoConfig.notifyUrl,
      orderId: record.id,
      orderInfo: `MyMusic Premium ${dto.premiumType}`,
      partnerCode: momoConfig.partnerCode,
      redirectUrl: momoConfig.returnUrl,
      requestId,
      requestType: 'captureWallet',
    });

    const signature = createHmac('sha256', momoConfig.secretKey)
      .update(rawSignature)
      .digest('hex');

    const body = {
      partnerCode: momoConfig.partnerCode,
      accessKey: momoConfig.accessKey,
      requestId,
      amount,
      orderId: record.id,
      orderInfo: `MyMusic Premium ${dto.premiumType}`,
      redirectUrl: momoConfig.returnUrl,
      ipnUrl: momoConfig.notifyUrl,
      requestType: 'captureWallet',
      extraData,
      lang: 'vi',
      signature,
    };

    let payUrl: string;
    try {
      const response = await firstValueFrom(
        this.httpService.post<{ payUrl: string; resultCode: number; message: string }>(
          momoConfig.apiUrl,
          body,
        ),
      );
      if (response.data.resultCode !== 0) {
        throw new UnprocessableEntityException(
          `MoMo error: ${response.data.message}`,
        );
      }
      payUrl = response.data.payUrl;
    } catch (err) {
      await this.paymentRecords.update(record.id, { status: PaymentStatus.FAILED });
      throw err;
    }

    return { paymentUrl: payUrl };
  }

  async handleMomoCallback(body: MomoCallbackDto): Promise<void> {
    const momoConfig = this.config.get('payment.momo');

    // Verify MoMo IPN signature
    const rawSignature = buildMomoRawSignature({
      accessKey: momoConfig.accessKey,
      amount: body.amount,
      extraData: '',
      ipnUrl: momoConfig.notifyUrl,
      orderId: body.orderId,
      orderInfo: '',
      partnerCode: body.partnerCode,
      redirectUrl: momoConfig.returnUrl,
      requestId: body.requestId,
      requestType: 'captureWallet',
    });

    const expectedSig = createHmac('sha256', momoConfig.secretKey)
      .update(rawSignature)
      .digest('hex');

    let sigMatch = false;
    try {
      sigMatch = timingSafeEqual(
        Buffer.from(body.signature, 'hex'),
        Buffer.from(expectedSig, 'hex'),
      );
    } catch {
      sigMatch = false;
    }

    if (!sigMatch) {
      throw new BadRequestException('Invalid MoMo signature');
    }

    const paymentRecord = await this.paymentRecords.findOne({
      where: { id: body.orderId },
      relations: ['user'],
    });

    if (!paymentRecord) {
      throw new NotFoundException('Payment record not found');
    }

    if (paymentRecord.status === PaymentStatus.SUCCESS) return; // idempotent

    if (body.resultCode !== 0) {
      await this.paymentRecords.update(paymentRecord.id, {
        status: PaymentStatus.FAILED,
        transactionId: String(body.transId),
      });
      return;
    }

    await this.grantPremium(
      paymentRecord.user,
      paymentRecord.premiumType,
      paymentRecord.id,
      String(body.transId),
      PaymentProvider.MOMO,
      body.amount,
    );
  }

  // ── Admin premium management ───────────────────────────────────────────────

  async adminGrantPremium(targetUserId: string, dto: GrantPremiumDto): Promise<void> {
    const user = await this.findUserOrFail(targetUserId);

    const record = this.paymentRecords.create({
      userId: user.id,
      provider: PaymentProvider.ADMIN,
      amountVnd: 0,
      premiumType: dto.premiumType,
      status: PaymentStatus.ADMIN_GRANTED,
    });
    await this.paymentRecords.save(record);

    await this.grantPremium(
      user,
      dto.premiumType,
      record.id,
      null,
      PaymentProvider.ADMIN,
      0,
    );
  }

  async adminRevokePremium(targetUserId: string): Promise<void> {
    const user = await this.findUserOrFail(targetUserId);

    if (!user.roles.includes(Role.PREMIUM)) {
      throw new BadRequestException('User does not have PREMIUM role');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Remove PREMIUM role
      const newRoles = user.roles.filter((r) => r !== Role.PREMIUM);
      await qr.manager.update(User, user.id, {
        roles: newRoles,
        premiumExpiresAt: null,
        downloadQuota: 0,
      });

      // Revoke all active download records
      await qr.manager
        .createQueryBuilder()
        .update(DownloadRecord)
        .set({ revokedAt: new Date() })
        .where('user_id = :userId AND revoked_at IS NULL', { userId: user.id })
        .execute();

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    await this.notificationsService.create(user.id, NotificationType.PREMIUM_REVOKED);

    try {
      await this.mailService.send({
        to: user.email,
        subject: 'Your MyMusic Premium subscription has ended',
        html: this.mailService.premiumRevokedEmail(),
      });
    } catch (err) {
      this.logger.warn(`Failed to send premium-revoked email to ${user.email}: ${(err as Error).message}`);
    }
  }

  // ── Hourly cron: expire premium ────────────────────────────────────────────

  @Cron('0 * * * *')
  async expirePremium(): Promise<void> {
    const expiredUsers = await this.users
      .createQueryBuilder('u')
      .where('u.premium_expires_at <= NOW()')
      .andWhere(`u.roles LIKE :premium`, { premium: `%${Role.PREMIUM}%` })
      .select(['u.id', 'u.email', 'u.roles'])
      .getMany();

    for (const user of expiredUsers) {
      try {
        await this.adminRevokePremium(user.id);
      } catch (err) {
        this.logger.error(
          `expirePremium: failed for user ${user.id}: ${(err as Error).message}`,
        );
      }
    }

    if (expiredUsers.length > 0) {
      this.logger.log(`expirePremium: revoked ${expiredUsers.length} expired subscriptions`);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async grantPremium(
    user: User,
    premiumType: PremiumType,
    paymentRecordId: string,
    transactionId: string | null,
    provider: PaymentProvider,
    amountVnd: number,
  ): Promise<void> {
    const expiresAt = addDays(new Date(), PREMIUM_DURATION_DAYS[premiumType]);
    const downloadLimit = user.roles.includes(Role.ARTIST)
      ? DOWNLOAD_QUOTA.ARTIST_PREMIUM
      : DOWNLOAD_QUOTA.USER_PREMIUM;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Add PREMIUM role if not already present
      const newRoles = user.roles.includes(Role.PREMIUM)
        ? user.roles
        : [...user.roles, Role.PREMIUM];

      await qr.manager.update(User, user.id, {
        roles: newRoles,
        premiumExpiresAt: expiresAt,
        downloadQuota: downloadLimit,
      });

      await qr.manager.update(PaymentRecord, paymentRecordId, {
        status:
          provider === PaymentProvider.ADMIN
            ? PaymentStatus.ADMIN_GRANTED
            : PaymentStatus.SUCCESS,
        transactionId,
        expiresAt,
      });

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Re-fetch updated user for notifications (email)
    const updatedUser = await this.users.findOne({ where: { id: user.id } });

    await this.notificationsService.create(user.id, NotificationType.PREMIUM_ACTIVATED, {
      premiumType,
      expiresAt: expiresAt.toISOString(),
    });

    try {
      await this.mailService.send({
        to: updatedUser!.email,
        subject: 'MyMusic Premium Activated!',
        html: this.mailService.premiumActivatedEmail(expiresAt),
      });
    } catch (err) {
      this.logger.warn(
        `grantPremium: failed to send email to ${user.email}: ${(err as Error).message}`,
      );
    }
  }
}
