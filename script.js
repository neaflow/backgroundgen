const canvas = document.getElementById('pixels');//make the canvas
const ctx = canvas.getContext('2d');//the thing we actually draw with
const CELL = 11;//square size in pixels
const GAP = 1;//space between squares (grid step is 12)
const backgroundColor = '#131313';//the bg
const dimColor        = '#2b2b2b';//regular squares
const brightColor     = '#3c3c3c';//fancy squares

const seed = Math.floor(Math.random() * 100000);//new random seed every page load so each refresh looks different. picked once though, so the pattern stays put while we draw

//this is a hash
function hash(x, y, salt)  
{
  let n = x * 374761393 + y * 668265263 + salt * 2246822519;//big primes
  n = (n ^ (n >> 13)) * 1274126177;//tiny input change causes wildly different output
  n = n ^ (n >> 16);//second round of bit mushing
  return ((n >>> 0) % 100000) / 100000;//unsigned, squished to 0-99999, then to 0..1
}


function lerp(a, b, t) //t (0..1) of the way from a to b. the workhorse of the whole file
{
  return a + (b - a) * t;
}

function smoothStep(t) //eases t in and out and looks slightly uglier w/o this
{
  return t * t * (3 - 2 * t);
}


function noiseAt(x, y, scale, salt) //smooth noise at any point
{
  const fx = x * scale;//position on the noise grid
  const fy = y * scale;//
  const left = Math.floor(fx);//noise cell's left edge
  const top = Math.floor(fy);//top edge
  const right = left + 1;//
  const bottom = top + 1;//

  const across = smoothStep(fx - left);//how far (0..1) across the cell, eased
  const down = smoothStep(fy - top);//same, top to bottom

  const topLeft = hash(left, top, salt);        //one random value per corner
  const topRight = hash(right, top, salt);      //
  const bottomLeft = hash(left, bottom, salt);  //
  const bottomRight = hash(right, bottom, salt);//

  const topBlend = lerp(topLeft, topRight, across);//blend the top edge
  const bottomBlend = lerp(bottomLeft, bottomRight, across);//and the bottom
  return lerp(topBlend, bottomBlend, down);//then blend those two together
}

function layeredNoise(x, y) //4 noise layers stacked, each finer but quieter than the last. same texture at several zoom levels, added up
{
  let sum = 0;
  let totalWeight = 0;//for normalising back to 0..1 at the end
  let amplitude = 0.55;//this layer's influence
  let scale = 0.045;//starting scale = big blurry blobs

  for (let layer = 0; layer < 4; layer++) {
    sum += noiseAt(x, y, scale, seed + layer * 17) * amplitude;//+layer*17 so the layers don't all roll the same dice
    totalWeight += amplitude;//
    amplitude *= 0.55;//finer layers matter less
    scale *= 2.1;//2.1 not 2, so the layers don't align perfectly
  }

  return sum / totalWeight;//average it back into 0..1
}


function render() {
  const width = window.innerWidth;//window size in css pixels
  const height = window.innerHeight;//
  canvas.width = width * devicePixelRatio;//internal buffer at real screen density so squares stay sharp on hidpi
  canvas.height = height * devicePixelRatio;//
  canvas.style.width = width + 'px';//but display at css size (buffer gets stretched over this)
  canvas.style.height = height + 'px';//
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);//scale the context to match, so below we can just use css pixels

  const cols = Math.ceil(width / (CELL + GAP)) + 1;//squares across (+1 to cover the ragged edge)
  const rows = Math.ceil(height / (CELL + GAP)) + 1;//same for down

  ctx.fillStyle = backgroundColor;//
  ctx.fillRect(0, 0, width, height);//paint the background, which also wipes the last frame

  for (let row = 0; row < rows; row++) 
  {
    for (let col = 0; col < cols; col++) 
    {
      const noiseValue = layeredNoise(col, row);//this square's noise value
      if (noiseValue > 0.5) //below the threshold = background. this cutoff is what makes the blobs
      {
        const pixelX = col * (CELL + GAP);//grid position -> pixel position
        const pixelY = row * (CELL + GAP);//
        if (noiseValue > 0.72) //bright if in middle of noise range
        {
          ctx.fillStyle = brightColor;//
        } 
        else 
        {
          ctx.fillStyle = dimColor;//
        }
        ctx.fillRect(pixelX, pixelY, CELL, CELL);//does the thing
      }
    }
  }
}


let resizeTimer;//the pending timeout id
window.addEventListener('resize', () => //resize fires many times per second while dragging
{
  clearTimeout(resizeTimer);//cancel the previous plan
  resizeTimer = setTimeout(render, 150);//make a new one
});

render();//first draw on page load ironic because it's the last line

