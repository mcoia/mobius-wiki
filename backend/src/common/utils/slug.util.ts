export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
    .replace(/[\s_]+/g, '-')   // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '');  // Trim leading/trailing hyphens
}
