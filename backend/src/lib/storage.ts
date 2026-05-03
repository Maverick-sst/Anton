import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export const uploadToCloudinary = async (
  buffer: Buffer,
  fileId: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const publicId = `anton/${fileId}`

    cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "upload",
        access_mode: "public",
        public_id: publicId,
        format: "pdf",
      },
      (err, result) => {
        if (err) {
          reject(err)
          return
        }

        console.log("[cloudinary:upload]", {
          public_id: result?.public_id,
          resource_type: result?.resource_type,
          type: result?.type,
          format: result?.format,
          secure_url: result?.secure_url,
        })

        // Use Cloudinary's authoritative delivery URL returned by upload.
        resolve(result!.secure_url)
      }
    ).end(buffer)
  })
}