// Work from measured empty gutters, not physical screen width or a fixed breakpoint.
export function sideArtLayout({viewportWidth,mainLeft,mainRight,railRight}) {
  const values=[viewportWidth,mainLeft,mainRight,railRight];
  if(values.some(value=>!Number.isFinite(value))||viewportWidth<=800||mainRight<=mainLeft)return {visible:false,leftWidth:0,rightWidth:0};
  const leftWidth=Math.max(0,mainLeft-railRight-24);
  const rightWidth=Math.max(0,viewportWidth-mainRight-24);
  return {visible:leftWidth>0&&rightWidth>0,leftWidth:Math.max(0,leftWidth),rightWidth:Math.max(0,rightWidth)};
}
