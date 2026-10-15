// The Standard Brushes packs (js/standard-brushes.js) as shipped: the
// built-in copy used offline or when assets/brushes/standard.json can't be
// downloaded. Keep the two identical (test/default-brush-packs.test.js
// checks). Rows use the brush string-grid format: X = full, 1-9 = 10%-90%
// opacity, . = off.

export const DEFAULT_BRUSH_PACKS = [
  {
    id: 'shapes',
    name: 'Shapes',
    brushes: [
      { id: 'triangle', name: 'Triangle', rows: ['...X...', '..XXX..', '..XXX..', '.XXXXX.', '.XXXXX.', 'XXXXXXX'] },
      { id: 'ring', name: 'Ring', rows: ['..XXX..', '.X...X.', 'X.....X', 'X.....X', 'X.....X', '.X...X.', '..XXX..'] },
      { id: 'crescent', name: 'Crescent', rows: ['..XXX..', '.XX....', 'XX.....', 'XX.....', 'XX.....', '.XX....', '..XXX..'] },
      { id: 'arrow', name: 'Arrow', rows: ['...X...', '...XX..', 'XXXXXX.', 'XXXXXXX', 'XXXXXX.', '...XX..', '...X...'] },
      { id: 'lightning', name: 'Lightning', rows: ['..XXX', '.XXX.', '.XX..', 'XXXXX', '..XX.', '..X..', '.X...', 'X....'] },
      { id: 'music-note', name: 'Music Note', rows: ['..XXX', '..X.X', '..X..', '..X..', '.XX..', 'XXX..', 'XXX..', '.X...'] },
      { id: 'sparkle', name: 'Sparkle', rows: ['...X...', '...X...', '..5X5..', 'XXXXXXX', '..5X5..', '...X...', '...X...'] },
    ],
  },
  {
    id: 'nature',
    name: 'Nature',
    brushes: [
      { id: 'grass-tuft', name: 'Grass Tuft', rows: ['X..X..X', '.X.X.X.', '.X.X.X.', '..XXX..', '..XXX..'] },
      { id: 'leaf', name: 'Leaf', rows: ['....XX', '..XXXX', '.XXXXX', 'XXXXX.', 'XXXX..', 'XXX...', 'X.....'] },
      { id: 'flower', name: 'Flower', rows: ['..X.X..', '.XXXXX.', 'XXX.XXX', '.XXXXX.', '..X.X..', '...X...', '...X...'] },
      { id: 'cloud', name: 'Cloud', rows: ['...XXX...', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', '.7777777.'] },
      { id: 'tree', name: 'Tree', rows: ['...X...', '..XXX..', '.XXXXX.', '..XXX..', '.XXXXX.', 'XXXXXXX', '...X...', '...X...'] },
      { id: 'snowflake', name: 'Snowflake', rows: ['X..X..X', '.X.X.X.', '..XXX..', 'XXXXXXX', '..XXX..', '.X.X.X.', 'X..X..X'] },
      { id: 'raindrop', name: 'Raindrop', rows: ['..X..', '..X..', '.XXX.', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'] },
    ],
  },
  {
    id: 'texture',
    name: 'Texture & Dither',
    brushes: [
      { id: 'checker', name: 'Checker 50%', rows: ['X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X'] },
      { id: 'bayer-25', name: 'Bayer 25%', rows: ['X.X.X.X.', '........', 'X.X.X.X.', '........', 'X.X.X.X.', '........', 'X.X.X.X.', '........'] },
      { id: 'bayer-75', name: 'Bayer 75%', rows: ['XXXXXXXX', '.X.X.X.X', 'XXXXXXXX', '.X.X.X.X', 'XXXXXXXX', '.X.X.X.X', 'XXXXXXXX', '.X.X.X.X'] },
      { id: 'hatching', name: 'Hatching', rows: ['X...X...', '.X...X..', '..X...X.', '...X...X', 'X...X...', '.X...X..', '..X...X.', '...X...X'] },
      { id: 'crosshatch', name: 'Crosshatch', rows: ['X...X...', '.X.X.X.X', '..X...X.', '.X.X.X.X', 'X...X...', '.X.X.X.X', '..X...X.', '.X.X.X.X'] },
      { id: 'noise', name: 'Noise', rows: ['3.7..5.2', '.6..X..4', '5..2.8..', '..X...3.', '7.3.6..5', '.4...2.X', '2..9..6.', '.5.3..4.'] },
      { id: 'brick', name: 'Brick', rows: ['XXXXXXXX', '...X....', '...X....', '...X....', 'XXXXXXXX', '.......X', '.......X', '.......X'] },
      { id: 'stipple', name: 'Stipple', rows: ['X.......', '....X...', '......X.', '.X......', '.....X..', '..X.....', '.......X', '...X....'] },
    ],
  },
  {
    id: 'soft',
    name: 'Soft',
    brushes: [
      { id: 'soft-round-s', name: 'Soft Round S', rows: ['.131.', '15851', '38X83', '15851', '.131.'] },
      { id: 'soft-round-m', name: 'Soft Round M', rows: ['...111...', '.1344431.', '.3567653.', '1469X9641', '147XXX741', '1469X9641', '.3567653.', '.1344431.', '...111...'] },
      { id: 'soft-round-l', name: 'Soft Round L', rows: ['.....111.....', '...1233321...', '..234555432..', '.13567776531.', '.24679997642.', '13579XXX97531', '13579XXX97531', '13579XXX97531', '.24679997642.', '.13567776531.', '..234555432..', '...1233321...', '.....111.....'] },
      { id: 'glow', name: 'Glow', rows: ['....121....', '..2355532..', '.246888642.', '.369XXX963.', '158XXXXX851', '258XXXXX852', '158XXXXX851', '.369XXX963.', '.246888642.', '..2355532..', '....121....'] },
      { id: 'soft-square', name: 'Soft Square', rows: ['4444444', '4888884', '48XXX84', '48XXX84', '48XXX84', '4888884', '4444444'] },
      { id: 'feather', name: 'Feather', rows: ['.........', '.11......', '.1441....', '..4751...', '..15X51..', '...1574..', '....1441.', '......11.', '.........'] },
      { id: 'smudge', name: 'Smudge', rows: ['2221111..', '655433211', 'X87654321', '655433211', '2221111..'] },
    ],
  },
  {
    id: 'game',
    name: 'Game & UI',
    brushes: [
      { id: 'coin', name: 'Coin', rows: ['..XXX..', '.X...X.', 'X..X..X', 'X..X..X', 'X..X..X', '.X...X.', '..XXX..'] },
      { id: 'gem', name: 'Gem', rows: ['.XXXXX.', 'X.X.X.X', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'] },
      { id: 'key', name: 'Key', rows: ['.XX......', 'X..X.....', 'X..XXXXXX', 'X..X..X.X', '.XX......'] },
      { id: 'skull', name: 'Skull', rows: ['.XXXXX.', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXX.XXX', '.XXXXX.', '.X.X.X.'] },
      { id: 'sword', name: 'Sword', rows: ['......X', '.....XX', '....XX.', 'X..XX..', '.XXX...', '.XX....', 'X.X....'] },
      { id: 'potion', name: 'Potion', rows: ['..XXX..', '...X...', '..X.X..', '.X...X.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.'] },
      { id: 'hud-heart', name: 'HUD Heart', rows: ['.XX.XX.', 'X..X..X', 'X.....X', '.X...X.', '..X.X..', '...X...'] },
    ],
  },
];
