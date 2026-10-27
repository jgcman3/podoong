import { diaryPhotoResponse } from '@/features/growth-community/photo-response';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return diaryPhotoResponse(request, (await params).id, false);
}
