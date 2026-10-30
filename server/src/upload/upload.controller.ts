import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ServiceUnavailableException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';

/** Builds a multer file filter that only lets through files whose mime type (or file name) passes `test` */
const acceptOnly =
  (label: string, test: (mimetype: string, filename: string) => boolean) =>
  (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    const mimetype = file?.mimetype || '';
    if (!test(mimetype, file?.originalname || '')) {
      return cb(
        new BadRequestException(`Only ${label} are allowed. Received: ${mimetype || 'unknown'}`),
        false,
      );
    }
    cb(null, true);
  };

const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'text/csv',
  'application/csv',
];

/** The chat file picker offers these; browsers often report a different (or empty) mime type for some of them */
const DOCUMENT_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|txt|csv)$/i;

/**
 * All uploads go to Cloudinary (signed with the API secret, using the upload presets
 * from .env). Nothing is ever written to the server's disk: if Cloudinary refuses an
 * upload, the client gets a clear error instead.
 */
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);
  private isCloudinaryConfigured = false;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      this.isCloudinaryConfigured = true;
      this.logger.log(`☁️ Cloudinary configured (cloud: ${cloudName})`);
    } else {
      this.logger.error(
        '❌ Cloudinary credentials missing (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET) — uploads are disabled',
      );
    }
  }

  // ============================
  // Shared upload path
  // ============================

  /**
   * Uploads `file` to Cloudinary with the preset named in .env (`presetEnv`). If
   * Cloudinary says that preset doesn't exist, it retries without it. Any other
   * failure becomes a clear error for the app — never a local copy.
   */
  private async uploadToCloudinary(
    file: Express.Multer.File,
    presetEnv: string,
    defaultPreset: string,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    if (!this.isCloudinaryConfigured) {
      throw new ServiceUnavailableException(
        'File uploads are not configured on the server (Cloudinary credentials missing).',
      );
    }

    const preset: string = this.configService.get(presetEnv) || defaultPreset;
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    this.logger.log(
      `📥 Uploading ${file.originalname || 'file'} (${file.size} bytes, ${file.mimetype}) → Cloudinary folder "${options.folder}", preset "${preset}"`,
    );

    try {
      try {
        return await cloudinary.uploader.upload(dataUri, { ...options, upload_preset: preset });
      } catch (error: any) {
        const message: string = error?.message || error?.error?.message || '';
        if (!/preset/i.test(message)) throw error;
        this.logger.warn(
          `⚠️ Upload preset "${preset}" not found in Cloudinary — uploading without it. Create it under Settings → Upload → Upload presets to use it.`,
        );
        return await cloudinary.uploader.upload(dataUri, options);
      }
    } catch (error: any) {
      const message: string = error?.message || error?.error?.message || 'Unknown error';
      this.logger.error(`❌ Cloudinary upload failed: ${message}`);

      if (/permission|forbidden|403/i.test(message)) {
        throw new ServiceUnavailableException(
          'Cloudinary refused the upload: the API key has no upload permission. Give it upload access in Cloudinary (Settings → API Keys).',
        );
      }
      throw new ServiceUnavailableException(`Cloudinary upload failed: ${message}`);
    }
  }

  // ============================
  // ✅ UPLOAD IMAGE
  // ============================

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
      fileFilter: acceptOnly('image files', (m) => m.startsWith('image/')),
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file provided');

    const result = await this.uploadToCloudinary(file, 'CLOUDINARY_UPLOAD_PRESET_IMAGE', 'lingoverse_chat_images', {
      resource_type: 'image',
      folder: 'lingoverse_chat_images',
    });

    this.logger.log(`✅ Image uploaded: ${result.secure_url}`);
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  // ============================
  // ✅ UPLOAD AUDIO / VOICE
  // ============================

  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
      fileFilter: acceptOnly('audio files', (m) => m.startsWith('audio/')),
    }),
  )
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No audio file provided');

    const result = await this.uploadToCloudinary(file, 'CLOUDINARY_UPLOAD_PRESET_VOICE', 'lingoverse_voice_messages', {
      // Cloudinary stores audio as "video" resources; MP3 carries its duration
      // (browser-recorded WebM often doesn't), so the player can show the length
      resource_type: 'video',
      folder: 'lingoverse_voice_messages',
      format: 'mp3',
      unique_filename: true,
    });

    this.logger.log(`✅ Audio uploaded: ${result.secure_url}`);
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration,
      format: result.format,
    };
  }

  // ============================
  // ✅ UPLOAD VIDEO
  // ============================

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
      fileFilter: acceptOnly('video files', (m) => m.startsWith('video/')),
    }),
  )
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No video file provided');

    const result = await this.uploadToCloudinary(file, 'CLOUDINARY_UPLOAD_PRESET_VIDEO', 'lingoverse_chat_videos', {
      resource_type: 'video',
      folder: 'lingoverse_chat_videos',
    });

    this.logger.log(`✅ Video uploaded: ${result.secure_url}`);
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  }

  // ============================
  // ✅ UPLOAD DOCUMENT
  // ============================

  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: acceptOnly('documents (PDF, DOC, XLS, PPT, TXT, ZIP)', (m, name) => DOCUMENT_TYPES.includes(m) || DOCUMENT_EXTENSIONS.test(name)),
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const result = await this.uploadToCloudinary(file, 'CLOUDINARY_UPLOAD_PRESET_FILE', 'lingoverse_chat_files', {
      // "raw" so PDFs/ZIPs always download (image-type PDFs are blocked by default)
      resource_type: 'raw',
      folder: 'lingoverse_chat_files',
      use_filename: true,
      unique_filename: true,
    });

    this.logger.log(`✅ File uploaded: ${result.secure_url}`);
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes,
      format: result.format,
      originalName: file.originalname,
    };
  }

  // ============================
  // ✅ UPLOAD AVATAR
  // ============================

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: acceptOnly('image files', (m) => m.startsWith('image/')),
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No avatar file provided');

    const result = await this.uploadToCloudinary(file, 'CLOUDINARY_UPLOAD_PRESET_AVATAR', 'lingoverse_user_avatars', {
      resource_type: 'image',
      folder: 'lingoverse_user_avatars',
      // Face-centred square crop on upload
      transformation: [{ width: 400, height: 400, crop: 'thumb', gravity: 'face' }],
    });

    this.logger.log(`✅ Avatar uploaded: ${result.secure_url}`);
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    };
  }
}
