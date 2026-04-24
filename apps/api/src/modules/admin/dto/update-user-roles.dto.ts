import { IsArray, IsEnum } from 'class-validator';
import { Role } from '../../../common/enums';

export class UpdateUserRolesDto {
  @IsArray()
  @IsEnum(Role, { each: true })
  roles: Role[];
}
