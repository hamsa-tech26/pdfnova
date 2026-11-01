// Next.js' documented test-only font response injection. No production source
// imports this mock; it simply keeps PDF conversion tests independent of
// an external fonts.gstatic.com connection.
module.exports=new Proxy({}, {
  get(_target,url){
    if(typeof url!=="string")return undefined;
    return ["Geist","Geist Mono"].map(name=>`
      @font-face {
        font-family: '${name}';
        font-style: normal;
        font-weight: 100 900;
        src: url(https://example.invalid/task141-${name.replace(/ /g,"-")}.woff2) format('woff2');
      }
    `).join("\n");
  },
});
