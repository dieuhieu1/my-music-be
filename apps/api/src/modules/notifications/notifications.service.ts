import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from '../../common/enums';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const notification = this.repo.create({
      userId,
      type,
      payload: payload ?? null,
    });
    await this.repo.save(notification);
  }
}
