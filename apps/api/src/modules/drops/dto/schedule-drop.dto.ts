import { IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';

// Validates dropAt format at the DTO boundary.
// Business constraints (now+1h ≤ dropAt ≤ now+90d) are enforced in DropsService
// because they depend on the wall-clock time of the request.
export class ScheduleDropDto {
  @IsISO8601({ strict: true })
  @Transform(({ value }: { value: string }) => new Date(value))
  dropAt: Date;
}
