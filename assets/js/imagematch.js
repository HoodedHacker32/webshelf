// Whether an image is about the search. Bing Images, asked by a server, often
// answers with unrelated pictures (Cookie Monster costumes for "legend of
// zelda wallpapers"), so an image is kept only when its title or address has
// the words that matter: all of them for a one- or two-word search, most of
// them for a longer one. Words that describe the kind of picture
// ("wallpaper", "hd", "4k") don't count, since any image can claim them.

const IGNORED = new Set(['how', 'what', 'who', 'when', 'where', 'why', 'is', 'are', 'was', 'were', 'does', 'do', 'did', 'the', 'a', 'an',
  'of', 'to', 'in', 'for', 'and', 'with', 'on', 'pictures', 'picture', 'photos', 'photo', 'images', 'image', 'wallpaper', 'wallpapers',
  'background', 'backgrounds', 'hd', '4k', '1080p', 'desktop', 'iphone', 'phone', 'android', 'pics', 'pic', 'free', 'cute', 'aesthetic',
  'art', 'drawing', 'drawings', 'png', 'jpg', 'gif', 'gifs']);

const norm = (text) => String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const decode = (url) => { try { return decodeURIComponent(url ?? ''); } catch { return url ?? ''; } };
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A test for images ({ title, page, full }) about `subject`.
export function imageMatcher(subject) {
  const core = [...new Set(norm(subject).match(/[\p{L}\p{N}]+/gu) ?? [])].filter((w) => !IGNORED.has(w) && w.length > 1);
  const needed = core.length <= 2 ? core.length : Math.ceil(core.length * 0.6);
  // Whole words, either number: "cats" finds "cat", never "catacombs".
  const patterns = core.map((w) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)}(?:s|es)?(?![\\p{L}\\p{N}])`, 'u'));
  return (item) => {
    if (!core.length) return true;
    const text = norm(`${item.title} ${decode(item.page)} ${decode(item.full)}`).replace(/[_\-./]+/g, ' ');
    return patterns.filter((p) => p.test(text)).length >= needed;
  };
}
