import 'server-only';
import { createClient as supabaseClient } from '@supabase/supabase-js';
import { imageType } from '@/features/child-care/schema';
import {
  renderPhotoVariant,
  photoVariantPath,
} from '@/features/growth-community/photo-variants.mjs';

export async function stageGiftPhoto(
  file: File,
  user: string,
  child: string,
  record: string,
) {
  if (file.size <= 0 || file.size > 5242880) throw new Error('invalid photo');
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!imageType(bytes) || imageType(bytes) !== file.type)
    throw new Error('invalid photo');
  const original = await renderPhotoVariant(bytes, 1600);
  const thumbnail = await renderPhotoVariant(original, 480);
  const id = crypto.randomUUID(),
    path = `${user}/${child}/${record}/${id}.webp`;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Photo storage unavailable');
  const admin = supabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const files = [
    { path, bytes: original },
    { path: photoVariantPath(path, 480), bytes: thumbnail },
    { path: photoVariantPath(path, 1600), bytes: original },
  ];
  const cleanup = async () => {
    await admin.storage
      .from('child-care-photos')
      .remove(files.map((f) => f.path));
  };
  try {
    for (const file of files) {
      const stored = await admin.storage
        .from('child-care-photos')
        .upload(file.path, file.bytes, {
          contentType: 'image/webp',
          upsert: false,
        });
      if (stored.error) throw new Error('Photo upload failed');
    }
  } catch (error) {
    await cleanup();
    throw error;
  }
  return { metadata: { id, path, size: original.length }, cleanup };
}
