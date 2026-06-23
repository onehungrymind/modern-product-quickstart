import { createZodDto } from 'nestjs-zod';
import { RegisterSchema, LoginSchema } from '@tracer/common-models';

export class RegisterDto extends createZodDto(RegisterSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
