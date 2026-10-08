type Rule={x:number;slope:number;votes:number};

/** Detect long slanted ruled-table borders using consistent dark pixels.
 * Returns [] on uncertain or ordinary upright grids; never guesses text.
 */
export function detectPdfV4SlantedRules(
  pixels: Uint8ClampedArray,width:number,height:number,
):Rule[] {
  if(width<350||height<450||pixels.length!==width*height*4)return [];
  const yStart=Math.floor(height*0.22),yEnd=Math.floor(height*0.76),mid=(yStart+yEnd)/2;
  const step=Math.max(5,Math.floor(height/180));
  const ys:number[]=[];
  for(let y=yStart;y<yEnd;y+=step){
    let dark=0;
    for(let x=0;x<width;x+=4){
      const p=(y*width+x)*4;
      if(pixels[p]<80&&pixels[p+1]<80&&pixels[p+2]<80)dark++;
    }
    // Exclude horizontal black rulings, otherwise the Hough vote is biased.
    if(dark<width*0.04)ys.push(y);
  }
  if(ys.length<24)return [];
  const candidates:Rule[]=[];
  for(let si=-20;si<=20;si++){
    const slope=si*0.004;
    if(Math.abs(slope)<0.008)continue;
    const votes=new Uint16Array(width);
    for(const y of ys){
      for(let x=30;x<width-30;x++){
        const p=(y*width+x)*4;
        if(pixels[p]>=80||pixels[p+1]>=80||pixels[p+2]>=80)continue;
        const origin=Math.round(x-slope*(y-mid));
        if(origin>=30&&origin<width-30)votes[origin]++;
      }
    }
    for(let x=35;x<width-35;x++){
      if(votes[x]>=ys.length*0.67&&votes[x]>=votes[x-1]&&votes[x]>=votes[x+1]){
        candidates.push({x,slope,votes:votes[x]});
      }
    }
  }
  candidates.sort((a,b)=>b.votes-a.votes);
  const lines:Rule[]=[];
  for(const candidate of candidates){
    if(lines.some(line=>Math.abs(line.x-candidate.x)<18))continue;
    lines.push(candidate);
    if(lines.length>=16)break;
  }
  if(lines.length<4)return [];
  const xs=lines.map(line=>line.x);
  if(Math.max(...xs)-Math.min(...xs)<width*0.55)return [];
  return lines.sort((a,b)=>a.x-b.x);
}

export function clearPdfV4SlantedRules(
 pixels:Uint8ClampedArray,width:number,height:number,lines:readonly Rule[],
):Uint8ClampedArray {
  const output=new Uint8ClampedArray(pixels);
  const yStart=Math.floor(height*0.22),yEnd=Math.floor(height*0.76),mid=(yStart+yEnd)/2;
  for(const rule of lines){
    for(let y=yStart;y<yEnd;y++){
      const center=Math.round(rule.x+rule.slope*(y-mid));
      for(let x=center-3;x<=center+3;x++){
        if(x<0||x>=width)continue;
        const offset=(y*width+x)*4;
        if(output[offset]<160&&output[offset+1]<160&&output[offset+2]<160){
          output[offset]=255;output[offset+1]=255;output[offset+2]=255;output[offset+3]=255;
        }
      }
    }
  }
  return output;
}
