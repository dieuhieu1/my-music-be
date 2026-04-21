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
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PaymentsService } from './payments.service';
import { InitPaymentDto } from './dto/init-payment.dto';
import { MomoCallbackDto } from './dto/momo-callback.dto';
import { GrantPremiumDto } from './dto/grant-premium.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';

@Controller('payment')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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

  @Get('vn-pay/callback')
  @Public()
  @Redirect()
  async vnpayCallback(@Query() query: Record<string, string>) {
    const { redirectUrl } = await this.paymentsService.handleVnpayCallback(query);
    return { url: redirectUrl, statusCode: HttpStatus.FOUND };
  }

  // ── MoMo ──────────────────────────────────────────────────────────────────

  @Post('momo')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  initMomo(
    @CurrentUser('id') userId: string,
    @Query() dto: InitPaymentDto,
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
