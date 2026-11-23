# Welcome animation layers

Cut from the approved master icon (docs/brand/ConSAP_CPeople.png) at 512 px. Never redraw them.
Stacked in this order they rebuild the icon exactly (checked: mean pixel difference < 1/255):

1. layer-tile.png: the gradient tile alone
2. layer-c.png: the C with its square block
3. layer-person-left.png, layer-person-middle.png, layer-person-right.png

The animation ends by switching to icon-final-512.png, so the final frame is the original artwork.

- C sweep: a conic mask centred at 60.5% / 89.06% of the tile, starting at 245deg, swept to 200deg.
- Person pop pivots (transform-origin): left 18.4% 59.2%, middle 41.2% 44.7%, right 68.8% 40%.
