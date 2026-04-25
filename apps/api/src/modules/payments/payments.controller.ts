import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { PaymentsService } from './payments.service';
import { InitPaymentDto } from './dto/init-payment.dto';
import { MomoCallbackDto } from './dto/momo-callback.dto';
import { GrantPremiumDto } from './dto/grant-premium.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../common/enums';

@Controller('payment')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  // ── VNPay ──────────────────────────────────────────────────────────────────

  @Get('vn-pay')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  initVnpay(
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Query() dto: InitPaymentDto,
  ) {
    return this.paymentsService.initVnpay(userId, ip, dto);
  }

  // @Redirect() breaks when TransformInterceptor wraps the response.
  // Use @Res() + res.redirect() to ensure the browser redirect always fires.
  @Get('vn-pay/callback')
  @Public()
  async vnpayCallback(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const returnUrl = this.config.get<string>('payment.vnpay.returnUrl')!;
    try {
      const { redirectUrl } = await this.paymentsService.handleVnpayCallback(query);
      return res.redirect(HttpStatus.FOUND, redirectUrl);
    } catch {
      return res.redirect(HttpStatus.FOUND, `${returnUrl}?status=failed`);
    }
  }

  // ── MoMo ──────────────────────────────────────────────────────────────────

  @Post('momo')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  initMomo(
    @CurrentUser('id') userId: string,
    @Body() dto: InitPaymentDto,
  ) {
    return this.paymentsService.initMomo(userId, dto);
  }

  @Post('momo/callback')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  momoCallback(@Body() body: MomoCallbackDto) {
    return this.paymentsService.handleMomoCallback(body);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  @Post('admin/users/:userId/premium')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  adminGrantPremium(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: GrantPremiumDto,
  ) {
    return this.paymentsService.adminGrantPremium(targetUserId, dto);
  }

  @Delete('admin/users/:userId/premium')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  adminRevokePremium(@Param('userId', ParseUUIDPipe) targetUserId: string) {
    return this.paymentsService.adminRevokePremium(targetUserId);
  }
}
