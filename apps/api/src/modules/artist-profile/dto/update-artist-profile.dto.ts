import {
  IsOptional,
  IsString,
  IsUrl,
  IsArray,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Each element of socialLinks is a { platform, url } pair.
export class SocialLinkDto {
  @IsString()
  @MaxLength(50)
  platform: string;

  @IsUrl()
  @MaxLength(500)
  url: string;
}

// BL-67: all fields optional — PATCH is truly partial.
// socialLinks supports both JSON body and multipart (JSON-stringified).
export class UpdateArtistProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  stageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  // When sent via multipart/form-data the value arrives as a JSON string.
  // @Transform handles both cases and instantiates SocialLinkDto so that
  // class-validator whitelist can resolve property names against the class.
  @IsOptional()
  @Transform(({ value }) => {
    let arr = value;
    if (typeof value === 'string') {
      try { arr = JSON.parse(value); } catch { return undefined; }
    }
    if (!Array.isArray(arr)) return arr;
    return arr.map((item) => Object.assign(new SocialLinkDto(), item));
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];
}
