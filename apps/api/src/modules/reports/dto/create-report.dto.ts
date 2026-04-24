import { IsEnum, IsUUID } from 'class-validator';
import { ContentTargetType, ReportReason } from '../../../common/enums';

export class CreateReportDto {
  @IsEnum(ContentTargetType)
  targetType: ContentTargetType;

  @IsUUID()
  targetId: string;

  @IsEnum(ReportReason)
  reason: ReportReason;
}
