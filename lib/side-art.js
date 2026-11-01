// Two disjoint fixed background panels cover the reading area, not only its gutters.
// Main width/scroll position cannot hide the art; the desktop rail stays unobstructed.
export function sideArtLayout({viewportWidth,railRight}) {
  if(!Number.isFinite(viewportWidth)||viewportWidth<=0||!Number.isFinite(railRight))return {visible:false,leftWidth:0,rightWidth:0};
  const leftStart=viewportWidth<=800?0:Math.max(0,Math.min(viewportWidth,railRight));
  const width=(viewportWidth-leftStart)/2;
  return {visible:width>0,leftWidth:width,rightWidth:width,leftStart,rightStart:leftStart+width};
}
