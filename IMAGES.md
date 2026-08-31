# Image slots to fill

Three spots on the site currently show `images/Mis/holder.png`, which renders as a
plain grey block. This file lists each one. Delete this file whenever you like,
it is not linked from the site and does not affect anything.

## How to fill a slot

1. Save your image at the path listed below.
2. Open the HTML file and change that one `src="images/Mis/holder.png"` to your path.
3. Update the `alt` text if the image shows something different from the description.

Each slot also has a comment directly above it in the HTML repeating this.

## The three slots

| # | Page | Entry | Save your file as |
|---|------|-------|-------------------|
| 1 | `projects.html` | Neuroscience & Neuroethics Research | `images/Media/research.jpg` |
| 2 | `projects.html` | Better U LLC | `images/Mis/betterullc.png` |
| 3 | `projects.html` | CogTrack | `images/Mis/cogtrack.png` |

## Size and format

Same for all three:

- **Target size: 1200 x 700 px**, landscape, roughly 16:9
- **Keep it under about 300 KB** so pages stay fast
- **JPG** for photographs, **PNG** for logos and screenshots

### Why that size

The image box in a project card renders at up to **600 x 350 px** on a wide screen.
1200 x 700 is exactly double that, so it stays sharp on retina displays without
being needlessly heavy.

The CSS uses `object-fit: contain`, which means **nothing is ever cropped**. Any
aspect ratio will display in full. The tradeoff is that a portrait photo gets
grey bars down both sides and looks small. Landscape fills the box properly.

### Slot-specific notes

- **Slot 1, research.** A landscape photo works best. A single phone photo held
  vertically will letterbox badly.
- **Slot 2, Better U LLC.** A logo on a plain background is a good fit. PNG with
  transparency is fine, the box background is the site's light grey.
- **Slot 3, CogTrack.** One phone screenshot is portrait and will look small.
  Two or three screens side by side on a plain background fills the box much better.
  There is a `cogtrack1.png` in your Downloads that might be a starting point.

## Images already in place, nothing needed

- BetterU app entry uses `images/Mis/BetterU.PNG`
- Illustrator piece uses `images/Media/RenderProject.png`
- Home page hero and card images are unchanged
- Footer icons are unchanged, except the new `images/Icons/linkedin.svg`

## The LinkedIn icon

I drew `images/Icons/linkedin.svg` by hand as a white mark on a transparent
background, to match the other four footer icons. It is a plain geometric
approximation, not LinkedIn's official asset. If you would rather use the real
one, swap the file and keep the same filename and the footers all update at once.

## Optional: the Mentions page

`mentions.html` has no images at all right now, just link cards. If you want
thumbnails there later, the same `.project-item` pattern and the same 1200 x 700
guidance apply. Say the word and I will wire the slots in.
