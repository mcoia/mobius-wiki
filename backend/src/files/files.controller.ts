import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Res,
  Req,
  BadRequestException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { AccessControlGuard } from '../access-control/access-control.guard';
import { AccessControlService } from '../access-control/access-control.service';
import { User } from '../common/decorators/user.decorator';
import { FilesService } from './files.service';
import { FileAuditService } from './file-audit.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileAdminQueryDto, UpdateFileMetadataDto } from './dto/file-admin-query.dto';

@Controller('files')
export class FilesController {
  constructor(
    private filesService: FilesService,
    private fileAuditService: FileAuditService,
    private accessControlService: AccessControlService,
  ) {}

  // ==========================================================================
  // ADMIN ENDPOINTS (must come BEFORE parameterized routes like :id)
  // ==========================================================================

  @Get('admin')
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  async findAllAdmin(@Query() query: FileAdminQueryDto) {
    return this.filesService.findAllAdmin(query);
  }

  @Get('admin/stats')
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  async getStorageStats() {
    return { data: await this.filesService.getStorageStats() };
  }

  @Get('admin/orphaned')
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  async findOrphaned() {
    return this.filesService.findOrphaned();
  }

  // Linked files endpoint (specific path, must come before :id)
  @Get('linked/:type/:id')
  async findLinkedFiles(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('context') context: 'attachment' | 'inline' | 'cover' | 'thumbnail' | undefined,
    @User() user: any,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'users'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate context if provided
    if (context && !['attachment', 'inline', 'cover', 'thumbnail'].includes(context)) {
      throw new BadRequestException(`Invalid context. Must be one of: attachment, inline, cover, thumbnail`);
    }

    const linkableType = type.slice(0, -1); // wikis -> wiki

    // Check if user can access the parent content (skip for users - profile files are different)
    if (linkableType !== 'user') {
      const canAccess = await this.accessControlService.canAccess(user, linkableType, id);
      if (!canAccess) {
        throw new ForbiddenException('Access denied to this content');
      }
    }

    return this.filesService.findLinkedFiles(linkableType, id, context);
  }

  // Download file by filename (for content that references files by name)
  @Get('by-name/:filename')
  @SkipThrottle()
  async downloadByName(
    @Param('filename') filename: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // Look up file by filename
    const file = await this.filesService.findByFilename(filename);

    // Get user from session (or null for guests)
    const user = req.session?.userId
      ? {
          id: req.session.userId,
          role: req.session.role,
          libraryId: req.session.libraryId,
        }
      : null;

    // ACL check
    const hasAccess = await this.accessControlService.canAccess(user, 'file', file.id);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Serve file
    const buffer = await this.filesService.getFileBuffer(file.id);
    const isImage = file.mime_type?.startsWith('image/');
    const disposition = isImage ? 'inline' : 'attachment';

    res.set({
      'Content-Type': file.mime_type,
      'Content-Disposition': `${disposition}; filename="${file.filename}"`,
      'Content-Length': file.size_bytes,
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    res.send(buffer);
  }

  // ==========================================================================
  // STANDARD FILE ENDPOINTS
  // ==========================================================================

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
  @UseGuards(AuthGuard)
  async findAll(
    @Query('includeDeleted') includeDeleted?: string,
    @User() user?: any,
  ) {
    return this.filesService.findAllFiltered(user, includeDeleted === 'true');
  }

  // ==========================================================================
  // PARAMETERIZED ROUTES (must come AFTER specific routes like /admin)
  // ==========================================================================

  @Get(':id')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'file', idParam: 'id' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.findOne(id);
  }

  @Get(':id/download')
  @SkipThrottle()
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'file', idParam: 'id' })
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const file = await this.filesService.findOne(id);
    const buffer = await this.filesService.getFileBuffer(id);

    // Use inline for images so they display in <img> tags, attachment for other files
    const isImage = file.mime_type?.startsWith('image/');
    const disposition = isImage ? 'inline' : 'attachment';

    res.set({
      'Content-Type': file.mime_type,
      'Content-Disposition': `${disposition}; filename="${file.filename}"`,
      'Content-Length': file.size_bytes,
      'Cross-Origin-Resource-Policy': 'cross-origin',  // Allow embedding in TinyMCE iframe
    });

    res.send(buffer);
  }

  @Get(':id/links')
  @SkipThrottle()
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  async getFileLinks(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.getFileLinks(id);
  }

  @Get(':id/audit-logs')
  @SkipThrottle()
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  async getFileAuditLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const logs = await this.fileAuditService.getLogsForFile(id, parsedLimit);
    return { data: logs };
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @Req() req: Request,
  ) {
    // Get the file first
    const file = await this.filesService.findOne(id);

    // Check 1: Owner can always delete their own files
    if (file.uploaded_by === user.id) {
      const result = await this.filesService.remove(id, user.id);
      await this.fileAuditService.log(
        id,
        'delete',
        user.id,
        { reason: 'owner' },
        req.ip,
        req.headers['user-agent'],
      );
      return result;
    }

    // Check 2: User with canEdit on any linked content can delete
    const links = await this.filesService.getFileLinksForAuth(id);
    for (const link of links) {
      const canEdit = await this.accessControlService.canEdit(user, link.linkable_type, link.linkable_id);
      if (canEdit) {
        const result = await this.filesService.remove(id, user.id);
        await this.fileAuditService.log(
          id,
          'delete',
          user.id,
          { reason: 'canEdit', linkable_type: link.linkable_type, linkable_id: link.linkable_id },
          req.ip,
          req.headers['user-agent'],
        );
        return result;
      }
    }

    throw new ForbiddenException('You do not have permission to delete this file');
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  async updateMetadata(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFileMetadataDto,
    @User() user: any,
    @Req() req: Request,
  ) {
    const result = await this.filesService.updateMetadata(id, dto);

    // Log audit event
    await this.fileAuditService.log(
      id,
      'metadata_update',
      user.id,
      { description: dto.description },
      req.ip,
      req.headers['user-agent'],
    );

    return { data: result };
  }

  @Post(':fileId/link/:type/:id')
  @UseGuards(AuthGuard)
  async linkToContent(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { context?: 'attachment' | 'inline' | 'cover' | 'thumbnail' },
    @User() user: any,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'users'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate context if provided
    const context = body?.context || 'attachment';
    if (!['attachment', 'inline', 'cover', 'thumbnail'].includes(context)) {
      throw new BadRequestException(`Invalid context. Must be one of: attachment, inline, cover, thumbnail`);
    }

    const linkableType = type.slice(0, -1); // wikis -> wiki

    // Check if user can edit the target content
    const canEdit = await this.accessControlService.canEdit(user, linkableType, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to link files to this content');
    }

    const link = await this.filesService.linkToContent(fileId, linkableType, id, user.id, context);
    return { data: link };
  }

  @Delete(':fileId/link/:type/:id')
  @UseGuards(AuthGuard)
  async unlinkFromContent(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'users'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const linkableType = type.slice(0, -1);

    // Check if user can edit the target content
    const canEdit = await this.accessControlService.canEdit(user, linkableType, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to unlink files from this content');
    }

    const link = await this.filesService.unlinkFromContent(fileId, linkableType, id);
    return { data: link };
  }

  @Post(':id/replace')
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  @UseInterceptors(FileInterceptor('file'))
  async replaceFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @User() user: any,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.filesService.replaceFile(id, file, user.id);

    // Log audit event
    await this.fileAuditService.log(
      id,
      'replace',
      user.id,
      {
        new_filename: file.originalname,
        new_size: file.size,
        new_mime_type: file.mimetype,
      },
      req.ip,
      req.headers['user-agent'],
    );

    return { data: result };
  }

  @Post(':id/restore')
  @UseGuards(AuthGuard, RoleGuard)
  @SetMetadata('roles', ['mobius_staff'])
  async restore(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @Req() req: Request,
  ) {
    const result = await this.filesService.restore(id);

    // Log audit event
    await this.fileAuditService.log(
      id,
      'restore',
      user.id,
      {},
      req.ip,
      req.headers['user-agent'],
    );

    return { data: result };
  }
}
