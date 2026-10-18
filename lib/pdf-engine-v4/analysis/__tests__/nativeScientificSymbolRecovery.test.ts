import {describe,it,expect} from "vitest";
import {inferNativeScientificSymbols} from "../nativeScientificSymbolRecovery";

describe("Release 83 narrow native scientific Greek glyph disambiguation",()=>{
  it("recovers sigma and epsilon only in complete scientific label contexts",()=>{
    const examples=[
      ["Non-ECF family s factors","Non-ECF family σ factors"],
      ["ECF family s/anti-s factor pairs","ECF family σ/anti-σ factor pairs"],
      ["Within e-Proteobacterial taxa","Within ε-Proteobacterial taxa"],
      ["Only in non e-Proteobacterial taxa","Only in non ε-Proteobacterial taxa"],
    ];
    for(const [native,publisher] of examples){
      const recovered=inferNativeScientificSymbols(native);
      expect(recovered.text).toBe(publisher);
      expect(recovered.reasons).toHaveLength(1);
    }
  });
  it("does not replace common Latin s and e in prose or unrelated table cells",()=>{
    const ordinary=[
      "family science factors predict sigma?",
      "family s genes of proteins",
      "Family s-factor groups",
      "Very simple e-services",
      "An e-Proteobacterial analysis",
      "family S pairing",
      "species e-Proteobacterial and family s value",
      "ECF family σ/anti-σ factor pairs",
      "Within ε-Proteobacterial taxa",
    ];
    for(const value of ordinary){
      const result=inferNativeScientificSymbols(value);
      expect(result.text).toBe(value);
      expect(result.reasons).toHaveLength(0);
    }
  });
  it("avoids broad substitutions for raw symbols that do not meet both label anchors",()=>{
    for(const value of [
      "s factors","s/anti-s","Only in non e-Proteobacterial",
      "an e-Proteobacterial protein","family s/anti-s proteins",
      "family s factors or another data point",
    ]){
      const result=inferNativeScientificSymbols(value);
      if(value==="family s factors or another data point") {
        expect(result.text).toContain("σ factors");
      } else {
        expect(result.text).toBe(value);
      }
    }
  });
});
