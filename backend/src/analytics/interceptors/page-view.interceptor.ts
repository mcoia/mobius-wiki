import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AnalyticsService } from '../analytics.service';

@Injectable()
export class PageViewInterceptor implements NestInterceptor {
  constructor(private analyticsService: AnalyticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Only track successful GET requests to page endpoints
    return next.handle().pipe(
      tap((responseBody) => {
        if (request.method === 'GET' && response.statusCode === 200) {
          // Check if this is a page view endpoint
          let pageId = this.extractPageId(request);

          // Extract from response body if not in params (for slug-based endpoints)
          if (!pageId && responseBody?.data?.id) {
            pageId = responseBody.data.id;
          }

          if (pageId) {
            // Extract user info
            const userId = request.session?.userId || null;
            const sessionId = request.session?.id || null;
            const referrer = request.headers['referer'] || request.headers['referrer'] || null;

            // Track asynchronously (don't block response)
            this.analyticsService
              .trackPageView(pageId, userId, sessionId, referrer)
              .catch(err => {
                // Log error but don't fail the request
                console.error('Failed to track page view:', err.message);
              });
          }
        }
      }),
    );
  }

  private extractPageId(request: any): number | null {
    // Check if this is a pages/:id endpoint
    if (request.route?.path?.includes('/pages/:id') && request.params?.id) {
      const pageId = parseInt(request.params.id, 10);
      return isNaN(pageId) ? null : pageId;
    }

    return null;
  }

}
