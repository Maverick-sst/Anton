import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const BUCKET = process.env.SUPABASE_BUCKET!

export const uploadToCloudinary = async (
  buffer: Buffer,
  fileId: string
): Promise<string> => {
  const path = `${fileId}.pdf`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  console.log("[storage:upload] success:", data.publicUrl)
  return data.publicUrl
}