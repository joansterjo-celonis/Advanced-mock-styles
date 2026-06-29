# Advanced Mock Styles Figma Importer

This local plugin imports `.figma-export.zip` files downloaded from the prototype.
It does not use Figma REST, OAuth, or access tokens.

## Local Use

1. In Figma Desktop, open `Plugins > Development > Import plugin from manifest`.
2. Select `figma-importer/manifest.json`.
3. Run `Advanced Mock Styles Importer` in a blank Figma design file.
4. Choose the downloaded `.figma-export.zip`.
5. Click `Import into this Figma file`.

## What It Creates

- One Figma frame per exported screen/sub-screen.
- Editable text and shape layers for supported DOM nodes.
- SVG nodes for charts and icons when Figma can parse the SVG.
- Component samples for recurring roles such as cards, buttons, tabs, tables, charts, KPIs, and asset headers.

## Known Approximations

- CSS backdrop blur and advanced glass effects are approximated.
- Complex charts remain vector/SVG-first rather than rebuilt as chart primitives.
- Component samples are generated from first matching layers; imported screens remain editable instead of being forcibly replaced with instances.
