insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'document-assets',
    'document-assets',
    false,
    52428800,
    array[
      'text/html',
      'text/plain',
      'text/markdown',
      'text/css',
      'application/javascript',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
      'font/woff',
      'font/woff2'
    ]
  ),
  (
    'document-thumbnails',
    'document-thumbnails',
    true,
    10485760,
    array[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml'
    ]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 说明：
-- 1. 正式写入和删除建议统一走服务端 Service Role，而不是直接开放浏览器写入。
-- 2. 公开缩略图可以放在 document-thumbnails。
-- 3. HTML 正文资源建议存放到私有桶 document-assets，再通过应用层进行受控访问。
