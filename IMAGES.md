# Images

Notes for you. Not linked from the site; safe to delete.

## Where images live

- **`images/Johnsontexasimages/`** — drop folder for full-size originals from
  phones and event photographers. Large, and **not** referenced by any page.
- **`images/Media/`** — the resized copies the site actually loads. Resize before
  wiring anything in. On macOS:

  ```
  sips -Z 1400 -s formatOptions 65 "images/Johnsontexasimages/.../original.jpg" \
       --out "images/Media/short-name.jpg"
  ```

  Long edge ~1400 px, file under ~350 KB.

## In use now (`images/Media/`)

| File | Where |
|------|-------|
| `li-presentation.jpg`, `li-team.jpg`, `li-group.jpg` | projects.html (neuroscience card), index.html |
| `guatemala-stem.jpg`, `guatemala-group.jpg`, `guatemala-antigua.jpg` | mentions.html, index.html section cards |
| `xc-team.jpg` | index.html (Resume card) |
| `betteru-community.jpg`, `betteru-trainer.jpg` + `Mis/BetterU.PNG` | projects.html (Better U card) |

## 2026 cleanup

The Media Gallery page and all its travel/art photos were removed, along with the
"Christ Crucifixion" project and the dog / red-hoodie portraits. `images/self/`
is gone. If you want any of those photos back they are in git history.

## Open TODOs (also flagged in projects.html)

- `betterullc.com` still has no DNS records, so it is shown as text, not a link.
  When it resolves, swap the placeholder for the real `<a>` (comment in projects.html).
- Add the direct App Store URL for BetterU when available.

## The LinkedIn icon

`images/Icons/linkedin.svg` is a hand-drawn white mark to match the other footer
icons, not LinkedIn's official asset.
