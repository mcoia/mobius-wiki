import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { StaffLibrariesService } from './libraries.service';
import { CreateLibraryDto } from './dto/create-library.dto';
import { UpdateLibraryDto } from './dto/update-library.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('staff/libraries')
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', ['mobius_staff'])
export class StaffLibrariesController {
  constructor(private librariesService: StaffLibrariesService) {}

  @Get()
  async findAll() {
    return this.librariesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.librariesService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateLibraryDto, @User() user: any) {
    return this.librariesService.create(dto, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLibraryDto,
    @User() user: any,
  ) {
    return this.librariesService.update(id, dto, user.id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.librariesService.remove(id, user.id);
  }
}
