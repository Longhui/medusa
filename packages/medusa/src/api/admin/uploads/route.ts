import { uploadFilesWorkflow } from "@medusajs/core-flows"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { HttpTypes } from "@medusajs/framework/types"
import path from "path"

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
]

const MAX_IMAGE_DIMENSION = 1920
const WEBP_QUALITY = 80

/**
 * Compress an image buffer using sharp.
 * - Resizes to MAX_IMAGE_DIMENSION on the longest edge (maintaining aspect ratio)
 * - Converts to WebP format for optimal compression
 * - Returns null if sharp is unavailable (falls through to original)
 */
async function compressImage(
  buffer: Buffer,
  originalname: string
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  try {
    const sharp = (await import("sharp")).default
    const ext = path.extname(originalname).toLowerCase()

    // Skip non-image files and already-optimized WebP/GIF
    if (ext === ".webp" || ext === ".gif" || ext === ".svg") {
      return null
    }

    const metadata = await sharp(buffer).metadata()

    // Only resize if image is larger than MAX_IMAGE_DIMENSION
    const resizeOpts: { width?: number; height?: number; fit?: string } = {}
    if (
      (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
      (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)
    ) {
      resizeOpts.width = MAX_IMAGE_DIMENSION
      resizeOpts.height = MAX_IMAGE_DIMENSION
      resizeOpts.fit = "inside"
    }

    const webpName = `${path.basename(originalname, ext)}.webp`

    let sharpInstance = sharp(buffer)

    if (resizeOpts.width) {
      sharpInstance = sharpInstance.resize(
        resizeOpts.width,
        resizeOpts.height,
        { fit: "inside", withoutEnlargement: true }
      )
    }

    const compressed = await sharpInstance
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer()

    return { buffer: compressed, mimeType: "image/webp", filename: webpName }
  } catch {
    // sharp not available or processing failed — return original
    return null
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUploadFile>,
  res: MedusaResponse<HttpTypes.AdminFileListResponse>
) => {
  const input = req.files as Express.Multer.File[]

  if (!input?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files were uploaded"
    )
  }

  const processedFiles = await Promise.all(
    input.map(async (f) => {
      const isImage = IMAGE_MIME_TYPES.includes(f.mimetype)

      if (isImage) {
        const result = await compressImage(f.buffer, f.originalname)
        if (result) {
          return {
            filename: result.filename,
            mimeType: result.mimeType,
            content: result.buffer.toString("base64"),
            access: "public" as const,
          }
        }
      }

      // Fall through: use original file
      return {
        filename: f.originalname,
        mimeType: f.mimetype,
        content: f.buffer.toString("base64"),
        access: "public" as const,
      }
    })
  )

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: processedFiles,
    },
  })

  res.status(200).json({ files: result })
}
