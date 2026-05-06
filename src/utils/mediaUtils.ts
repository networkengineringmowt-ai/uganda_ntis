export const GDRIVE_FOLDER = '1DWvTzbTue6ZvmXzXmj8UsBZRJ-ZtocFI';

export function gdriveUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function gdriveThumbnail(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}
