import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums';

export const ROLES_KEY = 'roles';

// Usage: @Roles(Role.ADMIN) or @Roles(Role.ARTIST, Role.ADMIN)
// Checked by RolesGuard after JwtAuthGuard runs.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
