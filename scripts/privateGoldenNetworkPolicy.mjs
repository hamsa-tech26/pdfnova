/** Private real-document runner: allow local reads and exact OCR engine assets.
 * Do not permit arbitrary GETs to an otherwise trusted CDN: query parameters
 * and unexpected paths could carry PDF-derived data off the device.
 */
const OCR_CDN_PATHS=[
  /^\/npm\/tesseract\.js@v\d+\.\d+\.\d+\/dist\/worker\.min\.js$/,
  /^\/npm\/tesseract\.js-core@v\d+\.\d+\.\d+\/tesseract-core(?:-[a-z]+)*\.wasm(?:\.js)?$/,
  /^\/npm\/@tesseract\.js-data\/eng\/4\.0\.0(?:_best_int)?\/eng\.traineddata(?:\.gz)?$/
];
const PROJECT_NAPTHA_PATH=/^\/4\.0\.0\/eng\.traineddata(?:\.gz)?$/;

export function allowPrivateGoldenRequest(input,method){
  let url;
  try{url=new URL(input);}catch{return false;}
  if(!["GET","HEAD"].includes(method)||url.username||url.password||url.hash)return false;
  if(["127.0.0.1","localhost"].includes(url.hostname))
    return url.protocol==="http:"&&url.port==="3000";
  if(url.protocol!=="https:"||url.port||url.search)return false;
  if(url.hostname==="cdn.jsdelivr.net")
    return OCR_CDN_PATHS.some(pattern=>pattern.test(url.pathname));
  return url.hostname==="tessdata.projectnaptha.com"&&PROJECT_NAPTHA_PATH.test(url.pathname);
}
