// Pagination tokens are opaque and can grow past 1 KB. Preserve them verbatim,
// with a bounded request envelope large enough for JSON escaping and parameters.
export const MAX_PAGE_TOKEN_LENGTH = 64 * 1024;
export const MAX_YOUTUBE_REQUEST_BYTES = 512 * 1024;
