import { createZodDto } from 'nestjs-zod';
import { CreateLinkSchema } from '@tracer/common-models';

export class CreateLinkDto extends createZodDto(CreateLinkSchema) {}
