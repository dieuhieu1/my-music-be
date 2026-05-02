import {
  IsString, MaxLength, IsOptional, IsArray, ValidateNested, IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

class SocialLinkDto {
  @IsString()
  platform: string;

  @IsUrl()
  url: string;
}

export class CreateOfficialArtistDto {
  @IsString()
  @MaxLength(100)
  stageName: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: { platform: string; url: string }[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedGenres?: string[];

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
