import { IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';

export class RescheduleDropDto {
  @IsISO8601({ strict: true })
  @Transform(({ value }: { value: string }) => new Date(value))
  dropAt: Date;
}
