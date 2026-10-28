import { Injectable } from "@nestjs/common";
import sharp from "sharp";
import type {
  ImageProcessorPort,
  ProcessedImage,
} from "@/shared/application/ports/image-processor.port";
import {
  PROFILE_PHOTO_FORMATS,
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_MAX_PIXELS,
  PROFILE_PHOTO_SIZE,
} from "@/shared/domain/profile-photo";

// Decoding and re-encoding with sharp (libvips): what gets stored is a new
// image made from the pixels only, so metadata, trailing data and anything
// hidden in the original file are gone.
@Injectable()
export class SharpImageProcessor implements ImageProcessorPort {
  async profilePhoto(input: Buffer): Promise<ProcessedImage | null> {
    if (input.length === 0 || input.length > PROFILE_PHOTO_MAX_BYTES) {
      return null;
    }
    const options = {
      limitInputPixels: PROFILE_PHOTO_MAX_PIXELS,
      failOn: "warning" as const,
    };
    try {
      const meta = await sharp(input, options).metadata();
      if (
        !(PROFILE_PHOTO_FORMATS as readonly string[]).includes(
          meta.format ?? "",
        ) ||
        (meta.pages ?? 1) > 1
      ) {
        return null;
      }
      const data = await sharp(input, options)
        .rotate() // apply the EXIF orientation before it is dropped
        .resize(PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE, { fit: "cover" })
        .webp({ quality: 82 })
        .toBuffer();
      return { data, contentType: "image/webp" };
    } catch {
      // Corrupt, truncated or too large to decode.
      return null;
    }
  }
}
