import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
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
 * Purpose: expose unauthenticated chassis QR downloads and public slug resolution.
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
}
