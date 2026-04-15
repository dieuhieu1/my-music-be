import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

// BL-66: updatable user fields — all optional so PATCH is truly partial.
// avatarUrl is not here; it arrives as a multipart file field.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
