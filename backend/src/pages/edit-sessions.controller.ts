import { Controller, Get, Post, Delete, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { EditSessionsService } from './edit-sessions.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { User } from '../common/decorators/user.decorator';
import { wrapData } from '../common/utils/response.util';

@Controller('pages/:pageId/edit-session')
@UseGuards(AuthGuard)
export class EditSessionsController {
  constructor(private editSessionsService: EditSessionsService) {}

  /**
   * Start or refresh an edit session (heartbeat).
   * Call this when entering edit mode and periodically while editing.
   */
  @Post()
  async startOrRefresh(
    @Param('pageId', ParseIntPipe) pageId: number,
    @User() user: any,
  ) {
    await this.editSessionsService.startOrRefreshSession(pageId, user.id);
    return wrapData({ success: true });
  }

  /**
   * End an edit session.
   * Call this when exiting edit mode.
   */
  @Delete()
  async end(
    @Param('pageId', ParseIntPipe) pageId: number,
    @User() user: any,
  ) {
    await this.editSessionsService.endSession(pageId, user.id);
    return wrapData({ success: true });
  }

  /**
   * Get all active editors for a page, excluding the current user.
   * Returns users who have recent heartbeats (not stale).
   */
  @Get('active')
  async getActiveEditors(
    @Param('pageId', ParseIntPipe) pageId: number,
    @User() user: any,
  ) {
    const editors = await this.editSessionsService.getActiveEditors(pageId, user.id);
    return wrapData(editors);
  }
}
