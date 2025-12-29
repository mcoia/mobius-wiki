import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Res,
  BadRequestException,
  SetMetadata,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AccessControlGuard } from '../access-control/access-control.guard';
import { User } from '../common/decorators/user.decorator';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @User() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.filesService.upload(file, user.id, dto.description);
    return { data: result };
  }

  @Get()
  async findAll(@Query('includeDeleted') includeDeleted?: string) {
    return this.filesService.findAll(includeDeleted === 'true');
  }

  @Get(':id')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'file', idParam: 'id' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.findOne(id);
  }

  @Get(':id/download')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'file', idParam: 'id' })
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const file = await this.filesService.findOne(id);
    const buffer = await this.filesService.getFileBuffer(id);

    res.set({
      'Content-Type': file.mime_type,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.size_bytes,
    });

    res.send(buffer);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.filesService.remove(id, user.id);
  }

  @Post(':fileId/link/:type/:id')
  @UseGuards(AuthGuard)
  async linkToContent(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'users'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const linkableType = type.slice(0, -1); // wikis -> wiki
    const link = await this.filesService.linkToContent(fileId, linkableType, id, user.id);
    return { data: link };
  }

  @Delete(':fileId/link/:type/:id')
  @UseGuards(AuthGuard)
  async unlinkFromContent(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'users'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const linkableType = type.slice(0, -1);
    const link = await this.filesService.unlinkFromContent(fileId, linkableType, id);
    return { data: link };
  }

  @Get('linked/:type/:id')
  async findLinkedFiles(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'users'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const linkableType = type.slice(0, -1);
    return this.filesService.findLinkedFiles(linkableType, id);
  }
}
