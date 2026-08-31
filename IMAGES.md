# Images

This file is just notes for you. It is not linked from the site and deleting it
changes nothing.

## Source vs. web copies

- **`images/Johnsontexasimages/`** is the drop folder for full-size originals
  (from phones and the Leadership Initiatives photographer). These are large and
  are **not** referenced by any page.
- The site only ever loads the resized copies in **`images/Media/`**. When you
  add a new photo, resize it before wiring it in. On macOS:

  ```
  sips -Z 1400 -s formatOptions 65 "images/Johnsontexasimages/.../original.jpg" \
       --out "images/Media/short-name.jpg"
  ```

  Aim for the long edge around 1400 px and the file under ~350 KB.

## The three project slots (now filled)

The grey `images/Mis/holder.png` placeholders are gone.

| Page | Entry | Image now used |
|------|-------|----------------|
| `projects.html` | Neuroscience &amp; Neuroethics Research | `li-presentation.jpg`, plus `li-team.jpg` and `li-group.jpg` in the small strip |
| `projects.html` | Better U LLC &amp; BetterU (the two entries are now merged into one) | three-phone strip: `Mis/BetterU.PNG`, `betteru-trainer.jpg`, `betteru-community.jpg` |
| `projects.html` | CogTrack | no image yet (text-only card, on purpose, until there are real screens) |

## New `images/Media/` files added in the 2026 update

- `li-presentation.jpg`, `li-group.jpg`, `li-team.jpg` &ndash; Advanced Medical
  Neuroscience Internship at Georgetown
- `guatemala-stem.jpg`, `guatemala-group.jpg`, `guatemala-antigua.jpg` &ndash;
  July 2026 mission trip
- `xc-team.jpg` &ndash; cross country teammates (Media Gallery)
- `betteru-community.jpg`, `betteru-trainer.jpg` &ndash; BetterU app screens
  (resized from `images/Johnsontexasimages/betteru/`)

Every large existing photo in `images/Media/` was also recompressed in place
(no visible change, roughly a 5x smaller total), and gallery/project images now
use `loading="lazy"`.

## Not used anymore

`images/Media/venice.jpeg` and `images/Media/redboat.jpeg` were dropped from the
Media Gallery (self-deprecating captions). The files are still in the repo if you
want them back.

## The LinkedIn icon

`images/Icons/linkedin.svg` is a hand-drawn white mark to match the other footer
icons, not LinkedIn's official asset. Swap the file (same name) to use the real one.
