import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Link, ClickStats, User } from '@tracer/common-models';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('links')
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post()
  create(
    @Body() dto: CreateLinkDto,
    @CurrentUser() user: User,
  ): Promise<Link> {
    return this.links.create(dto, user.id);
  }

  @Get()
  list(@CurrentUser() user: User): Promise<Link[]> {
    return this.links.findAll(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Link> {
    return this.links.findOne(id, user.id);
  }

  @Get(':id/clicks')
  getClicks(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ClickStats> {
    return this.links.getClickStats(id, user.id);
  }
}
