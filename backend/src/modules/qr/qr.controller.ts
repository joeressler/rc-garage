import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import {
  PublicInspectionSheet,
  QrQuery,
  QrQuerySchema,
  QrSlugParamSchema,
} from '../../contracts/qr.contract';
import { SetupIdSchema } from '../../contracts/setup.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { QrService } from './qr.service';

/**
 * Purpose: expose unauthenticated chassis QR downloads, public slug resolution, and crawler share HTML.
 */
@Controller()
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get('setups/:id/qr')
  async generate(
    @Param('id', new ZodValidationPipe(SetupIdSchema)) id: string,
    @Query(new ZodValidationPipe(QrQuerySchema)) query: QrQuery,
  ): Promise<StreamableFile> {
    const image = await this.qrService.generate(id, query);
    return new StreamableFile(image.body, {
      type: image.contentType,
      disposition: `inline; filename="chassis-qr.${image.format}"`,
    });
  }

  @Get('qr/resolve/:slug')
  resolve(
    @Param('slug', new ZodValidationPipe(QrSlugParamSchema)) slug: string,
  ): Promise<PublicInspectionSheet> {
    return this.qrService.resolveBySlug(slug);
  }

  @Get('share/:slug')
  async share(
    @Param('slug', new ZodValidationPipe(QrSlugParamSchema)) slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const document = await this.qrService.buildShareDocument(slug);
    res.status(document.statusCode);
    return new StreamableFile(Buffer.from(document.html, 'utf8'), {
      type: 'text/html; charset=utf-8',
    });
  }

  @Get('sitemap.xml')
  async sitemap(): Promise<StreamableFile> {
    const xml = await this.qrService.buildSitemapXmlDocument();
    return new StreamableFile(Buffer.from(xml, 'utf8'), {
      type: 'application/xml; charset=utf-8',
    });
  }
}
