import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * URL parity for WordPress media.
 *
 * Post/page images live in src/assets/uploads/ so Astro can optimize them, but
 * the old site served them from /wp-content/uploads/<same path> and those URLs
 * are shared in chats and on Instagram. After the build, mirror every imported
 * image back to its legacy path so it keeps resolving.
 *
 * PDFs and other non-images are not handled here - they sit in public/ already
 * and are copied verbatim by Astro.
 */
export default function legacyUploads() {
  return {
    name: 'dd:legacy-uploads',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const src = fileURLToPath(new URL('../assets/uploads/', import.meta.url));
        if (!fs.existsSync(src)) return;
        const dest = path.join(fileURLToPath(dir), 'wp-content', 'uploads');

        let copied = 0;
        const walk = (rel) => {
          for (const entry of fs.readdirSync(path.join(src, rel), { withFileTypes: true })) {
            const next = path.join(rel, entry.name);
            if (entry.isDirectory()) {
              walk(next);
              continue;
            }
            const target = path.join(dest, next);
            // public/ wins: never clobber a byte-identical original we shipped.
            if (fs.existsSync(target)) continue;
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(src, next), target);
            copied++;
          }
        };
        walk('');
        logger.info(`mirrored ${copied} images to legacy /wp-content/uploads/ paths`);
      },
    },
  };
}
