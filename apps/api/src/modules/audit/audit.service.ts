import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async log(
    adminId: string,
    action: string,
    targetType: string,
    targetId?: string,
    notes?: string,
  ): Promise<void> {
    const entry = this.repo.create({
      adminId,
      action,
      targetType,
      targetId: targetId ?? null,
      notes: notes ?? null,
    });
    await this.repo.save(entry);
  }

  async findAll(opts: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
    from?: string;
    to?: string;
  }) {
    const page  = Math.max(1, opts.page  ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip  = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('al').orderBy('al.createdAt', 'DESC');

    if (opts.action)  qb.andWhere('al.action  = :action',  { action:  opts.action  });
    if (opts.adminId) qb.andWhere('al.adminId = :adminId', { adminId: opts.adminId });
    if (opts.from)    qb.andWhere('al.createdAt >= :from', { from: new Date(opts.from) });
    if (opts.to)      qb.andWhere('al.createdAt <= :to',   { to:   new Date(opts.to)   });

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  // Phase 9: paginated audit list using size param convention (BL-40)
  async findAllPaginated(opts: {
    page?: number;
    size?: number;
    action?: string;
    adminId?: string;
    targetType?: string;
    from?: string;
    to?: string;
  }) {
    const page  = Math.max(1, opts.page ?? 1);
    const size  = Math.min(100, Math.max(1, opts.size ?? 20));
    const skip  = (page - 1) * size;

    const qb = this.repo.createQueryBuilder('al').orderBy('al.createdAt', 'DESC');

    if (opts.action)     qb.andWhere('al.action     = :action',     { action:     opts.action });
    if (opts.adminId)    qb.andWhere('al.adminId    = :adminId',    { adminId:    opts.adminId });
    if (opts.targetType) qb.andWhere('al.targetType = :targetType', { targetType: opts.targetType });
    if (opts.from)       qb.andWhere('al.createdAt >= :from',       { from: new Date(opts.from) });
    if (opts.to)         qb.andWhere('al.createdAt <= :to',         { to:   new Date(opts.to) });

    const [items, totalItems] = await qb.skip(skip).take(size).getManyAndCount();
    return { items, totalItems, page, size, totalPages: Math.ceil(totalItems / size) };
  }
}
