import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from '../../common/enums';
import { NotificationQueryDto } from './dto/notification-query.dto';

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
    const { title, body } = this.buildTitleBody(type, payload);
    await this.repo.save(
      this.repo.create({ userId, type, title, body, payload: payload ?? null }),
    );
  }

  // ── GET /notifications (BL-81) ───────────────────────────────────────────

  async findAll(userId: string, query: NotificationQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const [items, totalItems] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
      select: ['id', 'type', 'title', 'body', 'payload', 'isRead', 'readAt', 'createdAt'],
    });

    return { items, totalItems, page, size, totalPages: Math.ceil(totalItems / size) };
  }

  // ── GET /notifications/unread-count (BL-82) ──────────────────────────────

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.repo.count({ where: { userId, isRead: false } });
    return { count };
  }

  // ── PATCH /notifications/:id/read ────────────────────────────────────────

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.repo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!notification.isRead) {
      await this.repo.update({ id, userId }, { isRead: true, readAt: new Date() });
    }
  }

  // ── PATCH /notifications/read-all ────────────────────────────────────────

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildTitleBody(
    type: NotificationType,
    payload?: Record<string, unknown>,
  ): { title: string; body: string } {
    const songTitle = (payload?.songTitle as string | undefined) ?? 'your song';
    const artistName = (payload?.artistName as string | undefined) ?? 'An artist';

    switch (type) {
      case NotificationType.SONG_APPROVED:
        return { title: 'Song Approved', body: `"${songTitle}" is now live.` };
      case NotificationType.SONG_REJECTED:
        return { title: 'Song Rejected', body: `"${songTitle}" did not pass review.` };
      case NotificationType.SONG_REUPLOAD_REQUIRED:
        return { title: 'Reupload Required', body: `Please reupload "${songTitle}".` };
      case NotificationType.SONG_RESTORED:
        return { title: 'Song Restored', body: `"${songTitle}" is live again.` };
      case NotificationType.PREMIUM_ACTIVATED:
        return { title: 'Premium Activated', body: 'Your Premium subscription is now active.' };
      case NotificationType.PREMIUM_REVOKED:
        return { title: 'Premium Ended', body: 'Your Premium subscription has ended.' };
      case NotificationType.UPCOMING_DROP:
        return {
          title: `Upcoming Drop: ${songTitle}`,
          body: `${artistName} drops "${songTitle}" soon.`,
        };
      case NotificationType.NEW_RELEASE:
        return {
          title: `New Release: ${songTitle}`,
          body: `${artistName} just dropped "${songTitle}".`,
        };
      case NotificationType.DROP_CANCELLED:
        return {
          title: 'Drop Cancelled',
          body: `"${songTitle}" by ${artistName} has been cancelled.`,
        };
      case NotificationType.DROP_RESCHEDULED:
        return {
          title: 'Drop Rescheduled',
          body: `"${songTitle}" by ${artistName} has been rescheduled.`,
        };
      case NotificationType.SONG_TAKEN_DOWN:
        return { title: 'Content Taken Down', body: `"${songTitle}" has been taken down following a report.` };
      default:
        return { title: 'Notification', body: 'You have a new notification.' };
    }
  }
}
